import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ✅ Conditional logging pentru producție
const isDev = Deno.env.get('DENO_ENV') === 'development';

// Log helpers - doar console.log e condiționat, warn/error sunt mereu active
const log = {
  info: (...args: any[]) => { if (isDev) console.log(...args); },
  warn: (...args: any[]) => console.warn(...args),
  error: (...args: any[]) => console.error(...args),
};

interface TimesheetEntry {
  employee_id: string;
  work_date: string;
  hours_regular: number;
  hours_night: number;
  hours_saturday: number;
  hours_sunday: number;
  hours_holiday: number;
  hours_passenger: number;
  hours_driving: number;
  hours_equipment: number;
  hours_leave: number;
  hours_medical_leave: number;
  notes: string | null;
  start_time?: Date;  // Pentru detectare corectă interval 00:00-06:00
  end_time?: Date;
}

interface Shift {
  startTime: string;
  endTime: string;
  employeeId: string;
  notes?: string;
  shiftType?: string; // condus, pasager, utilaj, normal
}

/**
 * Calculează offsetul României (UTC+2 sau UTC+3 pentru DST) în milisecunde
 */
function getRomaniaOffsetMs(date: Date): number {
  // România: UTC+2 (iarnă) sau UTC+3 (vară - DST)
  // DST: ultimul duminică din martie 03:00 → ultimul duminică din octombrie 04:00
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth(); // 0=Ian, 2=Mar, 9=Oct
  
  // DST activ: martie (după ultimul duminică) până octombrie (înainte de ultimul duminică)
  if (month > 2 && month < 9) {
    return 3 * 60 * 60 * 1000; // UTC+3
  }
  if (month < 2 || month > 9) {
    return 2 * 60 * 60 * 1000; // UTC+2
  }
  
  // Pentru martie și octombrie, verificăm data exactă
  const lastSundayMarch = new Date(Date.UTC(year, 2, 31));
  lastSundayMarch.setUTCDate(31 - lastSundayMarch.getUTCDay());
  
  const lastSundayOct = new Date(Date.UTC(year, 9, 31));
  lastSundayOct.setUTCDate(31 - lastSundayOct.getUTCDay());
  
  if (month === 2 && date >= lastSundayMarch) {
    return 3 * 60 * 60 * 1000; // UTC+3
  }
  if (month === 9 && date < lastSundayOct) {
    return 3 * 60 * 60 * 1000; // UTC+3
  }
  
  return 2 * 60 * 60 * 1000; // UTC+2
}

/**
 * Găsește următorul midnight (00:00) - folosit pentru condus/pasager/utilaj
 */
function getNextMidnight(currentTime: Date): Date {
  const result = new Date(currentTime);
  result.setDate(result.getDate() + 1);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Găsește următorul moment critic de segmentare (00:00, 06:00, 06:01, 22:00)
 * Folosit DOAR pentru turele "normal"
 */
function getNextCriticalTime(currentTime: Date): Date {
  const result = new Date(currentTime);
  const h = result.getHours();
  const m = result.getMinutes();
  const s = result.getSeconds();
  const totalSeconds = h * 3600 + m * 60 + s;

  // Boundaries must be STRICTLY after currentTime to avoid zero-length segments
  
  // Before 06:00 → go to 06:00
  if (totalSeconds < 6 * 3600) {
    result.setHours(6, 0, 0, 0);
    return result;
  }
  
  // At 06:00:00 exactly → go to 06:01:00 (critical for Saturday/Sunday/Holiday transitions)
  if (totalSeconds === 6 * 3600) {
    result.setHours(6, 1, 0, 0);
    return result;
  }
  
  // Between 06:00:01 and 22:00 → go to 22:00
  if (totalSeconds < 22 * 3600) {
    result.setHours(22, 0, 0, 0);
    return result;
  }

  // >= 22:00 → next day 00:00
  result.setDate(result.getDate() + 1);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Verifică dacă o dată este sărbătoare legală românească
 */
function isLegalHoliday(date: Date, holidayDates: Set<string>): boolean {
  const dateStr = date.toISOString().split('T')[0];
  return holidayDates.has(dateStr);
}

/**
 * Determină tipul de ore bazat pe ziua săptămânii și interval orar
 * Conform pseudo-cod:
 * - Sărbătoare 06:01 → 24:00 = hours_holiday (2.0x)
 * - Sărbătoare 00:00 → 06:00 = hours_night (1.25x)
 * - Sâmbătă 06:01 → Duminică 06:00 = hours_saturday (1.50x)
 * - Duminică 06:01 → 24:00 = hours_sunday (2.0x)
 * - Noapte 22:00 → 06:00 = hours_night (1.25x)
 * - Normal 06:01 → 22:00 = hours_regular (1.0x)
 */
function determineHoursType(
  segmentStart: Date,
  segmentEnd: Date,
  holidayDates: Set<string>
): string {
  const dayOfWeek = segmentStart.getDay(); // 0=Duminică, 1=Luni, ..., 6=Sâmbătă
  const startHour = segmentStart.getHours();
  const startMinute = segmentStart.getMinutes();
  
  // Verifică dacă este sărbătoare legală
  if (isLegalHoliday(segmentStart, holidayDates)) {
    // Sărbătoare 06:01 → 24:00
    if (startHour > 6 || (startHour === 6 && startMinute >= 1)) {
      return 'hours_holiday';
    }
    // Sărbătoare 00:00 → 06:00
    if (startHour < 6 || (startHour === 6 && startMinute === 0)) {
      return 'hours_night';
    }
  }
  
  // SÂMBĂTĂ-DUMINICĂ (Sâmbătă 06:01 → Duminică 06:00)
  if (
    (dayOfWeek === 6 && (startHour > 6 || (startHour === 6 && startMinute >= 1))) || // Sâmbătă de la 06:01
    (dayOfWeek === 0 && (startHour < 6 || (startHour === 6 && startMinute === 0)))  // Duminică până la 06:00
  ) {
    return 'hours_saturday';
  }
  
  // DUMINICĂ (Duminică 06:01 → 24:00)
  if (dayOfWeek === 0 && (startHour > 6 || (startHour === 6 && startMinute >= 1))) {
    return 'hours_sunday';
  }
  
  // NOAPTE (22:00 → 06:00) - oricare zi (Luni-Vineri)
  if (startHour >= 22) {
    return 'hours_night';
  }
  
  if (startHour < 6 || (startHour === 6 && startMinute === 0)) {
    return 'hours_night';
  }
  
  // ORE NORMALE (06:01 → 21:59:59) - Luni-Vineri
  return 'hours_regular';
}

/**
 * Segmentează o tură de lucru în pontaje zilnice separate
 * ✅ REGULI:
 * - Pentru condus/pasager/utilaj: segmentare DOAR la 00:00 (midnight)
 * - Pentru normal: segmentare complexă la 00:00, 06:00, 22:00
 */
function segmentShiftIntoTimesheets(
  shift: Shift,
  holidayDates: Set<string>
): TimesheetEntry[] {
  // ✅ FIX TIMEZONE: Convertim UTC → România (UTC+2/UTC+3)
  const startUTC = new Date(shift.startTime);
  const endUTC = new Date(shift.endTime);
  const ROMANIA_OFFSET_MS = getRomaniaOffsetMs(startUTC);
  const start = new Date(startUTC.getTime() + ROMANIA_OFFSET_MS);
  const end = new Date(endUTC.getTime() + ROMANIA_OFFSET_MS);
  
  console.log(`[Timezone] UTC → România: ${startUTC.toISOString()} → ${start.toISOString()} (offset: ${ROMANIA_OFFSET_MS / 3600000}h)`);
  
  const timesheets: TimesheetEntry[] = [];
  
  const shiftType = shift.shiftType || 'normal';
  console.log(`[Segment] Processing shift type: ${shiftType}`);
  
  // ✅ LOGICĂ DIFERITĂ pentru tipuri speciale vs normal
  const isSpecialShift = ['condus', 'pasager', 'utilaj'].includes(shiftType);
  
  let currentSegmentStart = new Date(start);
  
  while (currentSegmentStart < end) {
    let currentSegmentEnd: Date;
    
    if (isSpecialShift) {
      // ✅ Pentru condus/pasager/utilaj: segmentare DOAR la midnight
      const nextMidnight = getNextMidnight(currentSegmentStart);
      currentSegmentEnd = nextMidnight < end ? nextMidnight : end;
    } else {
      // ✅ Pentru normal: segmentare complexă (00:00, 06:00, 22:00)
      const nextCriticalTime = getNextCriticalTime(currentSegmentStart);
      currentSegmentEnd = nextCriticalTime < end ? nextCriticalTime : end;
    }
    
    const hoursInSegment = (currentSegmentEnd.getTime() - currentSegmentStart.getTime()) / 3600000;
    
    // ❗ SINGLE-TRACK: fiecare pontaj merge într-o singură categorie
    // Dacă e condus/pasager/utilaj → folosește categoria specială
    // Altfel → determină tipul de ore normale (zi/noapte/weekend/sărbătoare)
    let hoursType: string;
    if (shiftType === 'condus') {
      hoursType = 'hours_driving';
      console.log(`[Segment] → hours_driving (${hoursInSegment}h)`);
    } else if (shiftType === 'pasager') {
      hoursType = 'hours_passenger';
      console.log(`[Segment] → hours_passenger (${hoursInSegment}h)`);
    } else if (shiftType === 'utilaj') {
      hoursType = 'hours_equipment';
      console.log(`[Segment] → hours_equipment (${hoursInSegment}h)`);
    } else {
      hoursType = determineHoursType(currentSegmentStart, currentSegmentEnd, holidayDates);
      console.log(`[Segment] → ${hoursType} (${hoursInSegment}h)`);
    }
    
    // Găsește sau creează pontaj pentru această zi
    const workDate = currentSegmentStart.toISOString().split('T')[0];
    let existingTimesheet = timesheets.find(t => t.work_date === workDate);
    
    if (!existingTimesheet) {
      existingTimesheet = {
        employee_id: shift.employeeId,
        work_date: workDate,
        hours_regular: 0,
        hours_night: 0,
        hours_saturday: 0,
        hours_sunday: 0,
        hours_holiday: 0,
        hours_passenger: 0,
        hours_driving: 0,
        hours_equipment: 0,
        hours_leave: 0,
        hours_medical_leave: 0,
        notes: shift.notes || null,
        start_time: currentSegmentStart,
        end_time: currentSegmentEnd
      };
      timesheets.push(existingTimesheet);
    }
    
    // Adaugă orele la o singură categorie
    (existingTimesheet as any)[hoursType] += hoursInSegment;
    
    // Avansează la următorul segment
    currentSegmentStart = new Date(currentSegmentEnd);
  }
  
  // ✅ REGULI NOI PAUZĂ
  timesheets.forEach(t => {
    // REGULA 1: Pauză 30 min pentru ore de zi (regular + saturday + sunday + holiday)
    const totalDayHours = t.hours_regular + t.hours_saturday + t.hours_sunday + t.hours_holiday;
    
    if (totalDayHours >= 4.0) {
      const dayBreak = 0.5; // 30 min
      
      // Deducere proporțională din fiecare categorie
      if (totalDayHours > 0) {
        const regularRatio = t.hours_regular / totalDayHours;
        const saturdayRatio = t.hours_saturday / totalDayHours;
        const sundayRatio = t.hours_sunday / totalDayHours;
        const holidayRatio = t.hours_holiday / totalDayHours;
        
        const regularDeduction = dayBreak * regularRatio;
        const saturdayDeduction = dayBreak * saturdayRatio;
        const sundayDeduction = dayBreak * sundayRatio;
        const holidayDeduction = dayBreak * holidayRatio;
        
        t.hours_regular -= regularDeduction;
        t.hours_saturday -= saturdayDeduction;
        t.hours_sunday -= sundayDeduction;
        t.hours_holiday -= holidayDeduction;
        
        console.log(`[Break Day] ✅ Pauză 30 min pentru ${t.work_date}: regular -${regularDeduction.toFixed(2)}h, saturday -${saturdayDeduction.toFixed(2)}h, sunday -${sundayDeduction.toFixed(2)}h, holiday -${holidayDeduction.toFixed(2)}h`);
      }
    } else {
      console.log(`[Break Day] ⚠️ SKIP pauză zi pentru ${t.work_date} - total day hours (${totalDayHours.toFixed(2)}h) < 4.0h`);
    }
    
    // REGULA 2: Pauză 15 min pentru ore de noapte
    if (t.hours_night >= 4.0) {
      const nightBreak = 0.25; // 15 min
      t.hours_night -= nightBreak;
      console.log(`[Break Night] ✅ Pauză 15 min pentru ${t.work_date}: night -${nightBreak.toFixed(2)}h`);
    } else {
      console.log(`[Break Night] ⚠️ SKIP pauză noapte pentru ${t.work_date} - hours_night (${t.hours_night.toFixed(2)}h) < 4.0h`);
    }
    
    // ⚠️ NU SE SCADE PAUZĂ DIN: hours_driving, hours_passenger, hours_equipment
    
    // Rotunjește toate orele la 2 zecimale
    t.hours_regular = Math.round(t.hours_regular * 100) / 100;
    t.hours_night = Math.round(t.hours_night * 100) / 100;
    t.hours_saturday = Math.round(t.hours_saturday * 100) / 100;
    t.hours_sunday = Math.round(t.hours_sunday * 100) / 100;
    t.hours_holiday = Math.round(t.hours_holiday * 100) / 100;
    t.hours_passenger = Math.round(t.hours_passenger * 100) / 100;
    t.hours_driving = Math.round(t.hours_driving * 100) / 100;
    t.hours_equipment = Math.round(t.hours_equipment * 100) / 100;
    t.hours_leave = Math.round(t.hours_leave * 100) / 100;
    t.hours_medical_leave = Math.round(t.hours_medical_leave * 100) / 100;
  });
  
  return timesheets;
}

/**
 * Validează un pontaj înainte de trimitere
 */
function validateTimesheet(timesheet: TimesheetEntry): string[] {
  const errors: string[] = [];
  
  // 1. Total ore/zi <= 24h
  const totalHours = 
    timesheet.hours_regular +
    timesheet.hours_night +
    timesheet.hours_saturday +
    timesheet.hours_sunday +
    timesheet.hours_holiday +
    timesheet.hours_passenger +
    timesheet.hours_driving +
    timesheet.hours_equipment +
    timesheet.hours_leave;
  
  if (totalHours > 24) {
    errors.push(`Total ore (${totalHours}h) depășește 24h pentru ${timesheet.work_date}`);
  }
  
  // 2. work_date nu în viitor
  const today = new Date().toISOString().split('T')[0];
  if (timesheet.work_date > today) {
    errors.push(`Data ${timesheet.work_date} este în viitor`);
  }
  
  // 3. Toate orele >= 0
  const hourFields: (keyof TimesheetEntry)[] = [
    'hours_regular', 'hours_night', 'hours_saturday', 
    'hours_sunday', 'hours_holiday', 'hours_passenger',
    'hours_driving', 'hours_equipment', 'hours_leave'
  ];
  
  hourFields.forEach(field => {
    const value = timesheet[field];
    if (typeof value === 'number' && value < 0) {
      errors.push(`${field} nu poate fi negativ`);
    }
  });
  
  return errors;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let { user_id, time_entry_id, clock_in_time, clock_out_time, notes } = await req.json();

    console.log('Processing time entry:', { user_id, time_entry_id, clock_in_time, clock_out_time, notes });

    // ✅ VALIDARE: Pontaj max 24h (previne timeout)
    const durationMs = new Date(clock_out_time).getTime() - new Date(clock_in_time).getTime();
    const durationHours = durationMs / (1000 * 60 * 60);

    if (durationHours > 24) {
      console.warn(`[Validation] ⚠️ Pontaj suspect: ${durationHours.toFixed(2)}h - limitare automată la 24h`);
      
      // Limitează automat la 24h de la clock_in
      const maxClockOut = new Date(new Date(clock_in_time).getTime() + 24 * 60 * 60 * 1000);
      clock_out_time = maxClockOut.toISOString();
      
      // ✅ FIX: UPDATE în DB pentru persistență
      const { error: updateError } = await supabase
        .from('time_entries')
        .update({ 
          clock_out_time,
          needs_reprocessing: true 
        })
        .eq('id', time_entry_id);
      
      if (updateError) {
        console.error('[Validation] DB update failed:', updateError);
      }
      
      // Creează alertă de securitate
      const { error: alertError } = await supabase.from('security_alerts').insert({
        alert_type: 'excessive_duration',
        severity: 'high',
        message: `Pontaj ${durationHours.toFixed(2)}h redus automat la 24h`,
        user_id,
        time_entry_id,
        details: { 
          original_duration_hours: durationHours,
          corrected_duration_hours: 24,
          auto_corrected: true 
        }
      });

      if (alertError) {
        console.error('[Validation] Alert creation failed:', alertError);
      }
    }

    // ✅ Extrage tipul de tură din notes (ex: "Tip: Condus")
    // IMPORTANT: "Condus Utilaj" TREBUIE să fie primul în regex pentru a nu fi confundat cu "Condus"
    const shiftTypeMatch = notes?.match(/Tip:\s*(Condus Utilaj|Utilaj|Condus|Pasager|Normal)/i);
    let shiftType = shiftTypeMatch ? shiftTypeMatch[1].toLowerCase() : 'normal';
    
    // Mapping explicit pentru "Condus Utilaj" → 'utilaj'
    if (shiftType === 'condus utilaj') {
      shiftType = 'utilaj';
      console.log(`[Main] ✅ Parsed "Condus Utilaj" → shiftType=utilaj`);
    } else {
      console.log(`[Main] Detected shift type: ${shiftType}`);
    }

    // Fetch holidays
    const { data: holidays } = await supabase
      .from('holidays')
      .select('date');
    
    const holidayDates = new Set((holidays || []).map(h => h.date));

    // ✅ STEP 1: Identifică zilele afectate de acest time_entry
    const startUTC = new Date(clock_in_time);
    const endUTC = new Date(clock_out_time);
    const ROMANIA_OFFSET_MS = getRomaniaOffsetMs(startUTC);
    const start = new Date(startUTC.getTime() + ROMANIA_OFFSET_MS);
    const end = new Date(endUTC.getTime() + ROMANIA_OFFSET_MS);
    
    const startDate = start.toISOString().split('T')[0];
    const endDate = end.toISOString().split('T')[0];
    
    // Creează lista de zile afectate
    const affectedDates = new Set<string>([startDate]);
    if (endDate !== startDate) {
      affectedDates.add(endDate);
      
      // Dacă pontajul se întinde pe mai multe zile, adaugă toate zilele între ele
      const current = new Date(start);
      while (current.toISOString().split('T')[0] < endDate) {
        current.setDate(current.getDate() + 1);
        affectedDates.add(current.toISOString().split('T')[0]);
      }
    }
    
    console.log(`[Aggregate] Affected dates: ${Array.from(affectedDates).join(', ')}`);

    // ✅ STEP 2: Găsește TOATE pontajele finalizate pentru user pentru zilele afectate
    const { data: allTimeEntries, error: fetchError } = await supabase
      .from('time_entries')
      .select('id, user_id, clock_in_time, clock_out_time, notes')
      .eq('user_id', user_id)
      .not('clock_out_time', 'is', null)
      .gte('clock_in_time', `${Array.from(affectedDates).sort()[0]}T00:00:00Z`)
      .lte('clock_in_time', `${Array.from(affectedDates).sort().pop()}T23:59:59Z`);

    if (fetchError) {
      console.error('[Aggregate] Error fetching time entries:', fetchError);
      throw fetchError;
    }

    console.log(`[Aggregate] Found ${allTimeEntries?.length || 0} finalized time entries for affected dates`);

    // ✅ STEP 3: Procesează toate pontajele și agregează rezultatele per zi
    const aggregatedTimesheets = new Map<string, TimesheetEntry>();

    for (const entry of (allTimeEntries || [])) {
      // IMPORTANT: "Condus Utilaj" TREBUIE să fie primul în regex
      const entryShiftTypeMatch = entry.notes?.match(/Tip:\s*(Condus Utilaj|Utilaj|Condus|Pasager|Normal)/i);
      let entryShiftType = entryShiftTypeMatch ? entryShiftTypeMatch[1].toLowerCase() : 'normal';
      
      // Mapping explicit pentru "Condus Utilaj" → 'utilaj'
      if (entryShiftType === 'condus utilaj') {
        entryShiftType = 'utilaj';
      }
      
      const shift: Shift = {
        startTime: entry.clock_in_time,
        endTime: entry.clock_out_time!,
        employeeId: entry.user_id,
        notes: entry.notes,
        shiftType: entryShiftType
      };

      console.log(`[Aggregate] Processing entry ${entry.id} (${entryShiftType}): ${entry.clock_in_time} → ${entry.clock_out_time}`);

      // Segmentează pontajul
      const timesheets = segmentShiftIntoTimesheets(shift, holidayDates);

      // Agregare: adună orele pentru fiecare zi cu CORECȚIE pentru ore noapte 00:00-06:00
      for (const timesheet of timesheets) {
        let adjustedWorkDate = timesheet.work_date;
        
        // REGULĂ CRITICĂ: Ore noapte 00:00-06:00 aparțin zilei PRECEDENTE
        // Exemplu: Joi 00:00-06:00 → "noaptea de Miercuri" → work_date = Miercuri
        if (timesheet.hours_night > 0 && timesheet.start_time) {
          const segmentHour = timesheet.start_time.getUTCHours();
          
          // Verifică dacă segmentul EFECTIV începe în 00:00-06:00
          if (segmentHour >= 0 && segmentHour < 6) {
            const workDate = new Date(timesheet.work_date + 'T00:00:00Z');
            const previousDay = new Date(workDate);
            previousDay.setUTCDate(previousDay.getUTCDate() - 1);
            adjustedWorkDate = previousDay.toISOString().split('T')[0];
            console.log(`[Night Rule] Adjusted ${timesheet.work_date} → ${adjustedWorkDate} (segment ${segmentHour}:00, ${timesheet.hours_night}h night)`);
          }
        }
        
        // REGULĂ WEEKEND: Duminică 00:00-06:00 → "sâmbăta noapte" → work_date = Sâmbătă
        if (timesheet.hours_saturday > 0 && timesheet.start_time) {
          const segmentHour = timesheet.start_time.getUTCHours();
          const dayOfWeek = timesheet.start_time.getUTCDay();
          
          if (dayOfWeek === 0 && segmentHour >= 0 && segmentHour < 6) { // Duminică 00:00-06:00
            const workDate = new Date(timesheet.work_date + 'T00:00:00Z');
            const saturday = new Date(workDate);
            saturday.setUTCDate(saturday.getUTCDate() - 1);
            adjustedWorkDate = saturday.toISOString().split('T')[0];
            console.log(`[Weekend Rule] Adjusted ${timesheet.work_date} → ${adjustedWorkDate} (segment ${segmentHour}:00, ${timesheet.hours_saturday}h saturday)`);
          }
        }
        
        const existing = aggregatedTimesheets.get(adjustedWorkDate);
        
        if (!existing) {
          aggregatedTimesheets.set(adjustedWorkDate, { ...timesheet, work_date: adjustedWorkDate });
        } else {
          // Agregare ore
          existing.hours_regular += timesheet.hours_regular;
          existing.hours_night += timesheet.hours_night;
          existing.hours_saturday += timesheet.hours_saturday;
          existing.hours_sunday += timesheet.hours_sunday;
          existing.hours_holiday += timesheet.hours_holiday;
          existing.hours_passenger += timesheet.hours_passenger;
          existing.hours_driving += timesheet.hours_driving;
          existing.hours_equipment += timesheet.hours_equipment;
          existing.hours_leave += timesheet.hours_leave;
          existing.hours_medical_leave += timesheet.hours_medical_leave;
          
          // Combină notele dacă sunt diferite
          if (timesheet.notes && !existing.notes?.includes(timesheet.notes)) {
            existing.notes = existing.notes 
              ? `${existing.notes}; ${timesheet.notes}`
              : timesheet.notes;
          }
        }
      }
    }

    // ✅ STEP 4: Rotunjire finală și validare
    const finalTimesheets = Array.from(aggregatedTimesheets.values());
    
    finalTimesheets.forEach(t => {
      t.hours_regular = Math.round(t.hours_regular * 100) / 100;
      t.hours_night = Math.round(t.hours_night * 100) / 100;
      t.hours_saturday = Math.round(t.hours_saturday * 100) / 100;
      t.hours_sunday = Math.round(t.hours_sunday * 100) / 100;
      t.hours_holiday = Math.round(t.hours_holiday * 100) / 100;
      t.hours_passenger = Math.round(t.hours_passenger * 100) / 100;
      t.hours_driving = Math.round(t.hours_driving * 100) / 100;
      t.hours_equipment = Math.round(t.hours_equipment * 100) / 100;
      t.hours_leave = Math.round(t.hours_leave * 100) / 100;
      t.hours_medical_leave = Math.round(t.hours_medical_leave * 100) / 100;
      
      console.log(`[Aggregate] Final for ${t.work_date}: regular=${t.hours_regular}h, night=${t.hours_night}h, driving=${t.hours_driving}h, passenger=${t.hours_passenger}h, equipment=${t.hours_equipment}h`);
    });

    // Validate all timesheets
    const allErrors: string[] = [];
    finalTimesheets.forEach(timesheet => {
      const errors = validateTimesheet(timesheet);
      allErrors.push(...errors);
    });

    if (allErrors.length > 0) {
      console.error('Validation errors:', allErrors);
      return new Response(
        JSON.stringify({ error: 'Erori de validare', details: allErrors }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // ✅ STEP 5: RECONCILIATION & UPSERT
    // Șterge datele importate (marcate cu [IMPORT]) pentru zilele care urmează să fie recalculate
    const workDates = finalTimesheets.map(t => t.work_date);
    if (workDates.length > 0) {
      const { error: deleteError, count: deletedCount } = await supabase
        .from('daily_timesheets')
        .delete({ count: 'exact' })
        .eq('employee_id', user_id)
        .in('work_date', workDates)
        .like('notes', '[IMPORT]%');

      if (deleteError) {
        console.warn('[Reconciliation] Warning: Could not delete imported data:', deleteError);
      } else if (deletedCount && deletedCount > 0) {
        console.log(`[Reconciliation] ✅ Deleted ${deletedCount} imported timesheets for dates: ${workDates.join(', ')}`);
      }
    }

    // UPSERT agregat - exclude start_time/end_time (nu există în tabel)
    for (const timesheet of finalTimesheets) {
      const { start_time, end_time, ...timesheetData } = timesheet;
      
      const { error: upsertError } = await supabase
        .from('daily_timesheets')
        .upsert(timesheetData, {
          onConflict: 'employee_id,work_date'
        });

      if (upsertError) {
        console.error('Error upserting timesheet:', upsertError);
        throw upsertError;
      }
    }

    console.log(`[Aggregate] Successfully upserted ${finalTimesheets.length} aggregated daily timesheets`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        timesheets: finalTimesheets,
        message: `Procesate și agregate ${finalTimesheets.length} pontaje zilnice`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});