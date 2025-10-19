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
 * ✅ Helper pentru a obține data României în format YYYY-MM-DD
 * IMPORTANT: `d` este deja shifted la ora României (UTC + ROMANIA_OFFSET_MS)
 * Folosim getUTC* pentru a extrage componentele "locale" (care sunt deja RO)
 */
function toRomaniaDateString(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

  // Critical boundaries: 00:00, 06:00, 22:00
  // Boundaries must be STRICTLY after currentTime to avoid zero-length segments
  
  // Before 06:00 → go to 06:00
  if (totalSeconds < 6 * 3600) {
    result.setHours(6, 0, 0, 0);
    return result;
  }
  
  // Between 06:00 and 22:00 → go to 22:00
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
 * ✅ FIXED: Folosește toRomaniaDateString pentru consistență timezone
 */
function isLegalHoliday(date: Date, holidayDates: Set<string>): boolean {
  const dateStr = toRomaniaDateString(date);
  return holidayDates.has(dateStr);
}

/**
 * Convertește un Date object la ora României (UTC+2/UTC+3)
 * ✅ FIX: Folosește timezone-ul României pentru classificare corectă Zi/Noapte
 */
function toRomaniaHour(date: Date): number {
  const offsetMs = getRomaniaOffsetMs(date);
  const romaniaTime = new Date(date.getTime() + offsetMs);
  return romaniaTime.getUTCHours();
}

/**
 * Determină tipul de ore bazat pe interval orar, ziua săptămânii și sărbători
 * ✅ UPDATED: Logică explicită pentru Duminică 00:00-06:00 → hours_saturday
 * PRIORITATE REGULI (de sus în jos):
 * 1. Sărbătoare 06:00 → 23:59:59 = hours_holiday (prioritate absolută)
 * 2. Sâmbătă 06:00 → 23:59:59 = hours_saturday
 * 3. Duminică 06:00 → 23:59:59 = hours_sunday
 * 4. Duminică 00:00 → 05:59:59 = hours_saturday (weekend continuu)
 * 5. Orice altă zi 00:00 → 05:59:59 SAU 22:00 → 23:59:59 = hours_night
 * 6. Restul = hours_regular
 */
function determineHoursType(
  segmentStartUTC: Date,
  segmentEndUTC: Date,
  holidayDates: Set<string>
): string {
  // ✅ Conversie SINGURĂ de la UTC → România
  const romaniaDate = new Date(segmentStartUTC.getTime() + getRomaniaOffsetMs(segmentStartUTC));
  const hour = romaniaDate.getUTCHours();
  const roDateString = toRomaniaDateString(romaniaDate);
  const dateObj = new Date(roDateString + 'T12:00:00Z');
  const dayOfWeek = dateObj.getUTCDay(); // 0=Duminică, 6=Sâmbătă
  
  // PRIORITATE 1: Sărbătoare legală (06:00 → 23:59:59)
  if (isLegalHoliday(romaniaDate, holidayDates) && hour >= 6) {
    return 'hours_holiday';
  }
  
  // PRIORITATE 2: Sâmbătă (06:00 → 23:59:59)
  if (dayOfWeek === 6 && hour >= 6) {
    return 'hours_saturday';
  }
  
  // PRIORITATE 3: Duminică (06:00 → 23:59:59)
  if (dayOfWeek === 0 && hour >= 6) {
    return 'hours_sunday';
  }
  
  // PRIORITATE 4: Noapte (00:00 → 05:59:59 SAU 22:00 → 23:59:59)
  // ✅ SPECIAL: Duminică 00:00-06:00 → hours_saturday (weekend continuu)
  if (hour < 6) {
    if (dayOfWeek === 0) {
      return 'hours_saturday';
    }
    return 'hours_night';
  }
  
  if (hour >= 22) {
    return 'hours_night';
  }
  
  // PRIORITATE 5: Zi normală (06:00 → 21:59:59)
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
  // ✅ DUAL AXIS: UTC for persistence, Local RO for logic
  const startUTC = new Date(shift.startTime);
  const endUTC = new Date(shift.endTime);
  const ROMANIA_OFFSET_MS = getRomaniaOffsetMs(startUTC);
  const startLocal = new Date(startUTC.getTime() + ROMANIA_OFFSET_MS);
  const endLocal = new Date(endUTC.getTime() + ROMANIA_OFFSET_MS);
  
  console.log(`[Timezone] UTC → România: ${startUTC.toISOString()} → ${startLocal.toISOString()} (offset: ${ROMANIA_OFFSET_MS / 3600000}h)`);
  
  const timesheets: TimesheetEntry[] = [];
  
  const shiftType = shift.shiftType || 'normal';
  console.log(`[Segment] Processing shift type: ${shiftType}`);
  
  // ✅ LOGICĂ DIFERITĂ pentru tipuri speciale vs normal
  const isSpecialShift = ['condus', 'pasager', 'utilaj'].includes(shiftType);
  
  // ✅ NEW: Track min/max UTC boundaries per work_date
  const dayBoundaries = new Map<string, { minStartUTC: Date, maxEndUTC: Date }>();
  
  // Track both UTC and Local in parallel
  let currentSegmentStartLocal = new Date(startLocal);
  let currentSegmentStartUTC = new Date(startUTC);
  
  while (currentSegmentStartLocal < endLocal) {
    let currentSegmentEndLocal: Date;
    
    if (isSpecialShift) {
      // ✅ Pentru condus/pasager/utilaj: segmentare DOAR la midnight
      const nextMidnight = getNextMidnight(currentSegmentStartLocal);
      currentSegmentEndLocal = nextMidnight < endLocal ? nextMidnight : endLocal;
    } else {
      // ✅ Pentru normal: segmentare complexă (00:00, 06:00, 22:00)
      const nextCriticalTime = getNextCriticalTime(currentSegmentStartLocal);
      currentSegmentEndLocal = nextCriticalTime < endLocal ? nextCriticalTime : endLocal;
    }
    
    const durationMs = currentSegmentEndLocal.getTime() - currentSegmentStartLocal.getTime();
    const hoursInSegment = durationMs / 3600000;
    
    // ✅ CORECT: Convert nextBoundaryLocal back to UTC
    const nextBoundaryUTC = new Date(currentSegmentEndLocal.getTime() - getRomaniaOffsetMs(currentSegmentEndLocal));
    const currentSegmentEndUTC = (nextBoundaryUTC <= endUTC) ? nextBoundaryUTC : endUTC;
    
    // ✅ SINGLE-TRACK CORECT: Shift-uri speciale (Condus/Pasager/Utilaj) → PRIORITATE ABSOLUTĂ
    // Regula: Condus pe Duminică = hours_driving (tarif unic per șofer)
    //         Normal pe Duminică = hours_sunday
    let hoursType: string;
    
    if (shiftType === 'condus') {
      hoursType = 'hours_driving';
      console.log(`[Segment] → hours_driving (${hoursInSegment}h) [tarif unic condus]`);
    } else if (shiftType === 'pasager') {
      hoursType = 'hours_passenger';
      console.log(`[Segment] → hours_passenger (${hoursInSegment}h) [tarif unic pasager]`);
    } else if (shiftType === 'utilaj') {
      hoursType = 'hours_equipment';
      console.log(`[Segment] → hours_equipment (${hoursInSegment}h) [tarif unic utilaj]`);
    } else {
      // DOAR pentru shift-uri normale ("zi" / "noapte") → aplică reguli sărbători/ore
      // ✅ FIXED: Trimitem timestamp-uri UTC, nu locale
      hoursType = determineHoursType(currentSegmentStartUTC, currentSegmentEndUTC, holidayDates);
      console.log(`[Segment] → ${hoursType} (${hoursInSegment}h) [shift normal - include weekend]`);
    }
    
    // ✅ FIXED: Găsește sau creează pontaj pentru această zi (ora României)
    const workDate = toRomaniaDateString(currentSegmentStartLocal);
    
    // ✅ NEW: Update day boundaries for this workDate
    if (!dayBoundaries.has(workDate)) {
      dayBoundaries.set(workDate, {
        minStartUTC: currentSegmentStartUTC,
        maxEndUTC: currentSegmentEndUTC
      });
    } else {
      const bounds = dayBoundaries.get(workDate)!;
      if (currentSegmentStartUTC < bounds.minStartUTC) {
        bounds.minStartUTC = currentSegmentStartUTC;
      }
      if (currentSegmentEndUTC > bounds.maxEndUTC) {
        bounds.maxEndUTC = currentSegmentEndUTC;
      }
    }
    
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
        start_time: currentSegmentStartUTC,  // Temporary, will be updated after loop
        end_time: currentSegmentEndUTC        // Temporary, will be updated after loop
      };
      timesheets.push(existingTimesheet);
    }
    
    // Adaugă orele la o singură categorie
    (existingTimesheet as any)[hoursType] += hoursInSegment;
    
    // ✅ Debug log pentru segment
    console.log(`[Segment→${workDate}] ${currentSegmentStartLocal.toISOString()}..${currentSegmentEndLocal.toISOString()} → ${hoursType} (${hoursInSegment.toFixed(3)}h)`);
    
    // Avansează la următorul segment (both axes)
    currentSegmentStartLocal = new Date(currentSegmentEndLocal);
    currentSegmentStartUTC = currentSegmentEndUTC; // ✅ CORECT: already in UTC
  }
  
  // ✅ NEW: Update all timesheets with correct UTC boundaries per day
  timesheets.forEach(t => {
    const bounds = dayBoundaries.get(t.work_date)!;
    t.start_time = bounds.minStartUTC;
    t.end_time = bounds.maxEndUTC;
    console.log(`[Segment Boundaries] ${t.work_date}: ${bounds.minStartUTC.toISOString()} → ${bounds.maxEndUTC.toISOString()}`);
  });
  
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
  
  // ✅ FIX CRITICAL: Validare durată minimă
  const totalWorkHours = 
    timesheet.hours_regular +
    timesheet.hours_night +
    timesheet.hours_saturday +
    timesheet.hours_sunday +
    timesheet.hours_holiday +
    timesheet.hours_passenger +
    timesheet.hours_driving +
    timesheet.hours_equipment;
  
  const totalLeaveHours = timesheet.hours_leave + timesheet.hours_medical_leave;
  
  // Pentru ore NORMALE: minimum 10 min (0.17h)
  if (totalWorkHours > 0 && totalWorkHours < 0.17) {
    const minutes = Math.round(totalWorkHours * 60);
    errors.push(
      `⚠️ Durata prea scurtă: ${minutes} min (minim: 10 min). ` +
      `Pontajul nu va fi adăugat în fise pontaj.`
    );
  }
  
  // Pentru LEAVE: minimum 4 ore (0.5 zile)
  if (totalLeaveHours > 0 && totalLeaveHours < 4) {
    errors.push(
      `⚠️ Durata leave prea scurtă: ${totalLeaveHours.toFixed(2)}h (minim: 4h = 0.5 zile)`
    );
  }
  
  // 1. Total ore/zi <= 24h
  const totalHours = totalWorkHours + totalLeaveHours;
  
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
    'hours_driving', 'hours_equipment', 'hours_leave', 'hours_medical_leave'
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

    let { 
      user_id, 
      time_entry_id, 
      clock_in_time, 
      clock_out_time, 
      notes, 
      previous_shift_type, 
      current_shift_type, 
      isIntermediateCalculation 
    } = await req.json();

    console.log('Processing time entry:', { user_id, time_entry_id, clock_in_time, clock_out_time, notes, isIntermediateCalculation });

    // ✅ FIX: Fetch missing data from DB if not provided in body
    if (!user_id || !clock_in_time || !clock_out_time) {
      console.log('[Auto-fetch] Missing data in body, fetching from DB...');
      const { data: entry, error: fetchError } = await supabase
        .from('time_entries')
        .select('user_id, clock_in_time, clock_out_time, notes')
        .eq('id', time_entry_id)
        .single();

      if (fetchError) {
        console.error('[Auto-fetch] Error fetching time entry:', fetchError);
        throw new Error(`Could not fetch time entry: ${fetchError.message}`);
      }

      user_id = user_id || entry.user_id;
      clock_in_time = clock_in_time || entry.clock_in_time;
      clock_out_time = clock_out_time || entry.clock_out_time;
      notes = notes || entry.notes;
      console.log('[Auto-fetch] ✅ Data fetched from DB:', { user_id, clock_in_time, clock_out_time });
    }

    // ✅ STEP 0: Detectează dacă e recalculare intermediară sau finalizare prin flag explicit
    const isIntermediateRecalc = isIntermediateCalculation === true;
    console.log(`[Mode] ${isIntermediateRecalc ? '🔄 INTERMEDIATE' : '✅ FINAL'} recalculation (flag: ${isIntermediateCalculation})`);
    
    // ✅ REMOVED: Approval check eliminat - orele trebuie calculate ÎNAINTE de aprobare
    // pentru ca adminii să poată verifica datele în pagina de verificare
    
    if (isIntermediateRecalc) {
      // ✅ RECALCULARE INTERMEDIARĂ: Salvează doar segmentul curent în time_entry_segments
      console.log('[Intermediate] Saving segment to time_entry_segments...');
      
      // ✅ CRUCIAL: Folosește previous_shift_type pentru segment intermediar
      // (când user-ul schimbă tipul, segmentul care se salvează e pentru tipul ANTERIOR)
      let shiftType: string;
      if (previous_shift_type) {
        // Folosește shift-ul anterior dacă e disponibil
        shiftType = previous_shift_type.toLowerCase();
        console.log(`[Intermediate] Using previous_shift_type: ${previous_shift_type} → ${shiftType}`);
      } else {
        // Fallback: extrage din notes (pentru cazuri edge)
        const shiftTypeMatch = notes?.match(/Tip:\s*(Condus Utilaj|Utilaj|Condus|Pasager|Normal)/i);
        shiftType = shiftTypeMatch ? shiftTypeMatch[1].toLowerCase() : 'normal';
        console.log(`[Intermediate] Fallback to notes: ${notes} → ${shiftType}`);
      }
      
      if (shiftType === 'condus utilaj') shiftType = 'utilaj';
      
      // Preia ultimul segment salvat pentru a ști când a început tipul curent
      const { data: lastSegment } = await supabase
        .from('time_entry_segments')
        .select('end_time')
        .eq('time_entry_id', time_entry_id)
        .order('end_time', { ascending: false })
        .limit(1)
        .single();
      
      const segmentStart = lastSegment?.end_time || clock_in_time;
      const segmentEnd = clock_out_time; // Timestamp intermediar
      const durationHours = (new Date(segmentEnd).getTime() - new Date(segmentStart).getTime()) / 3600000;
      
      // ✅ Mapare tip → segment_type CORECT pentru time_entry_segments
      let segmentType: string;
      if (shiftType === 'condus') {
        segmentType = 'hours_driving';
      } else if (shiftType === 'pasager') {
        segmentType = 'hours_passenger';
      } else if (shiftType === 'utilaj') {
        segmentType = 'hours_equipment';
      } else {
        // Pentru 'normal': determină tipul exact de ore bazat pe timp
        const { data: holidays } = await supabase
          .from('holidays')
          .select('date')
          .gte('date', new Date(segmentStart).toISOString().split('T')[0])
          .lte('date', new Date(segmentEnd).toISOString().split('T')[0]);
        
        const holidayDates = new Set(holidays?.map(h => h.date) || []);
        const startDate = new Date(segmentStart);
        const endDate = new Date(segmentEnd);
        segmentType = determineHoursType(startDate, endDate, holidayDates);
      }
      
      console.log(`[Intermediate] Segment: ${segmentStart} → ${segmentEnd} (${durationHours.toFixed(3)}h, ${segmentType})`);
      
      // Salvează segment intermediar
      const { error: segmentError } = await supabase
        .from('time_entry_segments')
        .insert({
          time_entry_id,
          segment_type: segmentType,
          start_time: segmentStart,
          end_time: segmentEnd,
          hours_decimal: durationHours,
          multiplier: 1.0
        });
      
      if (segmentError) {
        console.error('[Intermediate] ❌ Error saving segment:', segmentError);
        throw segmentError;
      }
      
      console.log('[Intermediate] ✅ Segment saved successfully. Waiting for final clock-out...');
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          mode: 'intermediate',
          message: 'Segment intermediar salvat. Agregare la ieșire finală.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // ✅ STEP 3: Pentru fiecare entry, CALCULEAZĂ și SALVEAZĂ segmentele (dacă nu există SAU dacă e marcat pentru recalculare)
    for (const entry of (allTimeEntries || [])) {
      const { data: existingSegs } = await supabase
        .from('time_entry_segments')
        .select('id')
        .eq('time_entry_id', entry.id)
        .limit(1);
      
      // Dacă entry-ul NU are segmente salvate SAU este marcat pentru recalculare, calculează-le
      const needsCalculation = !existingSegs || existingSegs.length === 0;
      
      if (needsCalculation) {
        console.log(`[CalculateSegments] Entry ${entry.id} has NO segments - calculating now...`);
      } else {
        // Entry-ul are deja segmente - ștergem doar dacă e același entry ca cel procesat acum (recalculare)
        if (entry.id === time_entry_id) {
          console.log(`[CalculateSegments] Entry ${entry.id} is being recalculated - cleaning up old segments first...`);
          const { error: deleteError } = await supabase
            .from('time_entry_segments')
            .delete()
            .eq('time_entry_id', entry.id);
          
          if (deleteError) {
            console.error(`[CalculateSegments] ❌ Failed to cleanup old segments:`, deleteError);
          } else {
            console.log(`[CalculateSegments] ✅ Cleaned up ${existingSegs.length} old segments before recalculation`);
          }
        } else {
          console.log(`[CalculateSegments] Entry ${entry.id} already has segments - skipping`);
          continue;
        }
      }
      
      // Continuăm cu calculul (fie că nu avea segmente, fie că le-am șters pentru recalculare)
      if (needsCalculation || entry.id === time_entry_id) {
        
        // Extrage shift type
        const entryShiftTypeMatch = entry.notes?.match(/Tip:\s*(Condus Utilaj|Utilaj|Condus|Pasager|Normal)/i);
        let entryShiftType = entryShiftTypeMatch ? entryShiftTypeMatch[1].toLowerCase() : 'normal';
        if (entryShiftType === 'condus utilaj') entryShiftType = 'utilaj';
        
        // Calculează segmentele
        const entryShift: Shift = {
          startTime: entry.clock_in_time,
          endTime: entry.clock_out_time!,
          employeeId: entry.user_id,
          notes: entry.notes,
          shiftType: entryShiftType
        };
        
        const calculatedTimesheets = segmentShiftIntoTimesheets(entryShift, holidayDates);
        
        // Transformă în segmente cu limite corecte per zi
        const segmentsToSave: any[] = [];
        for (const timesheet of calculatedTimesheets) {
          const hoursMap = {
            hours_driving: 'hours_driving',
            hours_passenger: 'hours_passenger',
            hours_equipment: 'hours_equipment',
            hours_regular: 'hours_regular',
            hours_night: 'hours_night',
            hours_saturday: 'hours_saturday',
            hours_sunday: 'hours_sunday',
            hours_holiday: 'hours_holiday'
          };
          
          for (const [hoursField, segmentType] of Object.entries(hoursMap)) {
            const hoursValue = (timesheet as any)[hoursField];
            if (hoursValue > 0) {
              segmentsToSave.push({
                time_entry_id: entry.id,
                segment_type: segmentType,
                start_time: timesheet.start_time,  // ✅ FIXED: Use day-specific boundaries from dayBoundaries
                end_time: timesheet.end_time,      // ✅ FIXED: Use day-specific boundaries from dayBoundaries
                hours_decimal: hoursValue,
                multiplier: 1.0
              });
              console.log(`[Save Segment] ${timesheet.work_date} ${segmentType}: ${(timesheet.start_time as Date).toISOString()} → ${(timesheet.end_time as Date).toISOString()} (${hoursValue}h)`);
            }
          }
        }
        
        // ✅ GUARD INVARIANTS: Force snap-to-boundary (anti-regression)
        if (segmentsToSave.length > 0) {
          // Force first segment start = exact clock_in_time (UTC)
          const firstSegment = segmentsToSave[0];
          const expectedStart = new Date(entry.clock_in_time);
          const actualStart = new Date(firstSegment.start_time);
          const startDiffSec = Math.abs((actualStart.getTime() - expectedStart.getTime()) / 1000);
          
          if (startDiffSec > 1) {
            console.warn(`[Guard] ⚠️ First segment start mismatch for ${entry.id}: ${startDiffSec}s diff - CORRECTING`);
            firstSegment.start_time = entry.clock_in_time;
          }
          
          // Force last segment end = exact clock_out_time (UTC)
          const lastSegment = segmentsToSave[segmentsToSave.length - 1];
          const expectedEnd = new Date(entry.clock_out_time!);
          const actualEnd = new Date(lastSegment.end_time);
          const endDiffSec = Math.abs((actualEnd.getTime() - expectedEnd.getTime()) / 1000);
          
          if (endDiffSec > 1) {
            console.warn(`[Guard] ⚠️ Last segment end mismatch for ${entry.id}: ${endDiffSec}s diff - CORRECTING`);
            lastSegment.end_time = entry.clock_out_time;
          }
          
          const { error: saveError } = await supabase
            .from('time_entry_segments')
            .insert(segmentsToSave);
          
          if (saveError) {
            console.error(`[CalculateSegments] ❌ Error saving segments for entry ${entry.id}:`, saveError);
          } else {
            console.log(`[CalculateSegments] ✅ Saved ${segmentsToSave.length} segments for entry ${entry.id} (with boundary guards)`);
          }
        }
      }
    }

    // ✅ STEP 4: AGREGARE BAZATĂ DOAR PE SEGMENTE SALVATE
    const aggregatedTimesheets = new Map<string, TimesheetEntry>();

    for (const entry of (allTimeEntries || [])) {
      // Fetch toate segmentele salvate pentru acest entry
      const { data: savedSegments } = await supabase
        .from('time_entry_segments')
        .select('*')
        .eq('time_entry_id', entry.id)
        .order('start_time', { ascending: true });
      
      if (!savedSegments || savedSegments.length === 0) {
        console.warn(`[Aggregate] ⚠️ Entry ${entry.id} has NO saved segments - skipping`);
        continue;
      }
      
      console.log(`[Aggregate] Entry ${entry.id} has ${savedSegments.length} saved segments`);
      
      // Procesează fiecare segment salvat
      for (const segment of savedSegments) {
        const segmentStartUTC = new Date(segment.start_time);
        const offset = getRomaniaOffsetMs(segmentStartUTC);
        const local = new Date(segmentStartUTC.getTime() + offset);
        const workDate = toRomaniaDateString(local);  // ✅ Derivă workDate din segment.start_time (nu din clock_in_time global)
        
        console.log(`[Aggregate] Segment ${segment.id}: ${segment.segment_type} (${segment.hours_decimal}h) | start_time=${segmentStartUTC.toISOString()} → workDate=${workDate}`);
        
        let existing = aggregatedTimesheets.get(workDate);
        if (!existing) {
          existing = {
            employee_id: entry.user_id,
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
            notes: entry.notes || null
          };
          aggregatedTimesheets.set(workDate, existing);
        }
        
        // ✅ Mapare segment_type → coloană daily_timesheets
        // IMPORTANT: Keys trebuie să matcheze exact cum sunt salvate segmentele (cu prefix 'hours_')
        const segmentTypeToColumn: Record<string, string> = {
          'hours_driving': 'hours_driving',
          'hours_passenger': 'hours_passenger',
          'hours_equipment': 'hours_equipment',
          'hours_regular': 'hours_regular',
          'hours_night': 'hours_night',
          'hours_saturday': 'hours_saturday',
          'hours_sunday': 'hours_sunday',
          'hours_holiday': 'hours_holiday'
        };
        const columnName = segmentTypeToColumn[segment.segment_type] || 'hours_regular';
        
        // Adaugă orele din segment la categoria corespunzătoare
        (existing as any)[columnName] += segment.hours_decimal;
        console.log(`[Aggregate] → ${workDate}: ${segment.segment_type} → ${columnName} +${segment.hours_decimal.toFixed(3)}h`);
      }
      
      // ✅ PĂSTREAZĂ segmentele - NU ȘTERGE după agregare!
      // Segmentele trebuie să rămână pentru audit, debugging și vizualizare
      console.log(`[Aggregate] ✅ Keeping ${savedSegments.length} segments for entry ${entry.id} (audit trail)`);
    }

    // ✅ ELIMINAT: Weekend aggregation nu mai este necesar
    // Segmentele sunt acum clasificate corect direct în determineHoursType()
    // hours_saturday și hours_sunday sunt populate automat din segmente

    // ✅ STEP 6: Rotunjire finală și validare
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
      
      // ✅ FIX: Log explicit pentru debugging când validarea eșuează
      if (errors.length > 0) {
        const totalHours = 
          timesheet.hours_regular +
          timesheet.hours_night +
          timesheet.hours_saturday +
          timesheet.hours_sunday +
          timesheet.hours_holiday +
          timesheet.hours_passenger +
          timesheet.hours_driving +
          timesheet.hours_equipment +
          timesheet.hours_leave +
          timesheet.hours_medical_leave;
        
        console.error('❌ [Validation Failed]', {
          user_id: user_id,
          date: timesheet.work_date,
          errors: errors,
          hours_total: totalHours.toFixed(2),
          breakdown: {
            regular: timesheet.hours_regular,
            night: timesheet.hours_night,
            driving: timesheet.hours_driving,
            passenger: timesheet.hours_passenger,
            equipment: timesheet.hours_equipment,
            leave: timesheet.hours_leave,
            medical_leave: timesheet.hours_medical_leave
          }
        });
      }
      
      allErrors.push(...errors);
    });

    if (allErrors.length > 0) {
      console.error('Validation errors:', allErrors);
      return new Response(
        JSON.stringify({ 
          error: 'Erori de validare', 
          details: allErrors,
          segments_saved: true,
          timesheet_saved: false
        }),
        { 
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // ✅ STEP 6: RECONCILIATION & UPSERT
    // ✅ PROTECȚIE: Exclude perioada < 13.10.2025 (Payroll manual extern)
    const PROTECTED_PERIOD_START = '2025-10-13';
    
    // Filtrează doar datele >= 13.10.2025
    const filteredTimesheets = finalTimesheets.filter(ts => {
      const isProtected = ts.work_date < PROTECTED_PERIOD_START;
      if (isProtected) {
        console.log(`[Protected Period] ⚠️ Skipping ${ts.work_date} (< ${PROTECTED_PERIOD_START})`);
      }
      return !isProtected;
    });

    // Verifică dacă toate au fost filtrate
    if (filteredTimesheets.length === 0) {
      console.log(`[Protected Period] All ${finalTimesheets.length} timesheets are in protected range - no upsert needed`);
      return new Response(
        JSON.stringify({
          success: true,
          message: `All timesheets before ${PROTECTED_PERIOD_START} - protected from overwrite`,
          protected: true,
          skipped_count: finalTimesheets.length
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Protected Period] Processing ${filteredTimesheets.length}/${finalTimesheets.length} timesheets (skipped ${finalTimesheets.length - filteredTimesheets.length} protected entries)`);
    
    // Șterge datele importate (marcate cu [IMPORT]) pentru zilele care urmează să fie recalculate
    const workDates = filteredTimesheets.map(t => t.work_date);
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

    // UPSERT doar timesheets-urile filtrate (>= 13.10.2025)
    for (const timesheet of filteredTimesheets) {
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