import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ============ HELPER FUNCTIONS (copiați din calculate-time-segments) ============

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
  notes?: string;
}

interface Shift {
  user_id: string;
  clock_in_time: string;
  clock_out_time: string;
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
 * Găsește următorul moment critic de segmentare (00:00, 06:00, 06:01, 22:00)
 * ✅ FIXED: Adăugat 06:01 pentru a detecta corect tranziția Sâmbătă/Duminică/Sărbătoare
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
 * Check if a date is a legal holiday
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
 * Segment a shift into daily timesheets with proper hour classification
 * Handles shifts that span multiple days and classifies hours correctly
 * ✅ LOGICĂ NOUĂ: Respectă tipul de tură (Condus/Pasager/Utilaj/Normal)
 */
function segmentShiftIntoTimesheets(
  shift: Shift,
  holidayDates: Set<string>
): TimesheetEntry[] {
  const timesheets: TimesheetEntry[] = [];
  
  // ✅ FIX TIMEZONE: Convertim UTC → România (UTC+2/UTC+3)
  const shiftStartUTC = new Date(shift.clock_in_time);
  const shiftEndUTC = new Date(shift.clock_out_time);
  const ROMANIA_OFFSET_MS = getRomaniaOffsetMs(shiftStartUTC);
  const shiftStart = new Date(shiftStartUTC.getTime() + ROMANIA_OFFSET_MS);
  const shiftEnd = new Date(shiftEndUTC.getTime() + ROMANIA_OFFSET_MS);
  
  console.log(`[Migration Timezone] UTC → România: ${shiftStartUTC.toISOString()} → ${shiftStart.toISOString()} (offset: ${ROMANIA_OFFSET_MS / 3600000}h)`);

  // ✅ Detectează tipul de tură din notes (default: 'normal')
  const shiftType = shift.shiftType || 'normal';

  let currentTime = new Date(shiftStart);

  while (currentTime < shiftEnd) {
    const nextCritical = getNextCriticalTime(currentTime);
    const segmentEnd = nextCritical > shiftEnd ? shiftEnd : nextCritical;

    const hoursDecimal = (segmentEnd.getTime() - currentTime.getTime()) / (1000 * 60 * 60);
    const roundedHours = Math.round(hoursDecimal * 100) / 100;

    if (roundedHours > 0) {
      const workDate = currentTime.toISOString().split('T')[0];
      
      // ✅ LOGICĂ CORECTATĂ: Determină tipul de ore bazat pe ziua săptămânii ȘI tipul de tură
      // Mai întâi, determinăm coloana bazată pe ziua săptămânii (saturday/sunday/holiday/night/regular)
      const timeBasedHoursType = determineHoursType(currentTime, segmentEnd, holidayDates);
      
      // Apoi, determinăm coloana suplimentară bazată pe tipul turei (doar pentru condus/pasager/utilaj)
      let shiftBasedHoursType: string | null = null;
      
      if (shiftType === 'condus') {
        shiftBasedHoursType = 'hours_driving';
      } else if (shiftType === 'pasager') {
        shiftBasedHoursType = 'hours_passenger';
      } else if (shiftType === 'utilaj') {
        shiftBasedHoursType = 'hours_equipment';
      }

      let existingEntry = timesheets.find((entry) => entry.work_date === workDate);

      if (!existingEntry) {
        existingEntry = {
          employee_id: shift.user_id,
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
          notes: shift.notes,
        };
        timesheets.push(existingEntry);
      }

      // ✅ Adăugăm orele în coloana bazată pe timp (saturday/sunday/holiday/night/regular)
      (existingEntry as any)[timeBasedHoursType] = 
        ((existingEntry as any)[timeBasedHoursType] as number) + roundedHours;
      
      // ✅ SUPLIMENTAR: Dacă este tură specială (condus/pasager/utilaj), adăugăm orele și în coloana specifică
      if (shiftBasedHoursType) {
        (existingEntry as any)[shiftBasedHoursType] = 
          ((existingEntry as any)[shiftBasedHoursType] as number) + roundedHours;
      }

      // Round all values to 2 decimals
      existingEntry.hours_regular = Math.round(existingEntry.hours_regular * 100) / 100;
      existingEntry.hours_night = Math.round(existingEntry.hours_night * 100) / 100;
      existingEntry.hours_saturday = Math.round(existingEntry.hours_saturday * 100) / 100;
      existingEntry.hours_sunday = Math.round(existingEntry.hours_sunday * 100) / 100;
      existingEntry.hours_holiday = Math.round(existingEntry.hours_holiday * 100) / 100;
    }

    currentTime = segmentEnd;
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
        
        console.log(`[Migration Break Day] ✅ Pauză 30 min pentru ${t.work_date}: regular -${regularDeduction.toFixed(2)}h, saturday -${saturdayDeduction.toFixed(2)}h, sunday -${sundayDeduction.toFixed(2)}h, holiday -${holidayDeduction.toFixed(2)}h`);
      }
    } else {
      console.log(`[Migration Break Day] ⚠️ SKIP pauză zi pentru ${t.work_date} - total day hours (${totalDayHours.toFixed(2)}h) < 4.0h`);
    }
    
    // REGULA 2: Pauză 15 min pentru ore de noapte
    if (t.hours_night >= 4.0) {
      const nightBreak = 0.25; // 15 min
      t.hours_night -= nightBreak;
      console.log(`[Migration Break Night] ✅ Pauză 15 min pentru ${t.work_date}: night -${nightBreak.toFixed(2)}h`);
    } else {
      console.log(`[Migration Break Night] ⚠️ SKIP pauză noapte pentru ${t.work_date} - hours_night (${t.hours_night.toFixed(2)}h) < 4.0h`);
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
 * Validate a timesheet entry for logical consistency
 */
function validateTimesheet(timesheet: TimesheetEntry): string[] {
  const errors: string[] = [];

  // Check total hours
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

  if (totalHours > 24) {
    errors.push(`Total hours (${totalHours}) exceeds 24 hours for ${timesheet.work_date}`);
  }

  // Check for future dates
  const workDate = new Date(timesheet.work_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (workDate > today) {
    errors.push(`Work date ${timesheet.work_date} is in the future`);
  }

  // Check for negative values
  const hourFields = [
    'hours_regular',
    'hours_night',
    'hours_saturday',
    'hours_sunday',
    'hours_holiday',
    'hours_passenger',
    'hours_driving',
    'hours_equipment',
    'hours_leave',
    'hours_medical_leave',
  ];

  for (const field of hourFields) {
    const value = (timesheet as any)[field];
    if (typeof value === 'number' && value < 0) {
      errors.push(`${field} cannot be negative`);
    }
  }

  return errors;
}

// ============ MAIN MIGRATION LOGIC ============

/**
 * Edge Function: migrate-historical-timesheets
 * 
 * Purpose: Process time_entries and populate daily_timesheets for payroll export
 * 
 * Usage:
 * 1. Full migration (initial run): POST with empty body or { "process_last_24h": false }
 * 2. Daily cron job: POST with { "process_last_24h": true }
 * 
 * Daily cron runs at 06:15 AM to ensure timesheets are ready by 08:00 AM for payroll.
 * Processes entries from the "timesheet day" (06:01 AM previous day - 06:00 AM current day)
 * 
 * ✅ OPTIMIZED: Processes in batches of 10 to avoid CPU timeout
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body for optional parameters
    const body = await req.json().catch(() => ({}));
    const processLast24h = body.process_last_24h || false;
    const limit = Math.max(1, Math.min(30, Number(body.limit) || (processLast24h ? 15 : 15)));
    const offset = Math.max(0, Number(body.offset) || 0);
    
    console.log(`[Migration] Starting timesheet migration (last 24h mode: ${processLast24h}, limit: ${limit}, offset: ${offset})...`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1. Fetch holidays
    console.log('[Migration] Fetching holidays...');
    const { data: holidays, error: holidaysError } = await supabase
      .from('holidays')
      .select('date');

    if (holidaysError) {
      throw new Error(`Failed to fetch holidays: ${holidaysError.message}`);
    }

    const holidayDates = new Set(holidays?.map((h: any) => h.date) || []);
    console.log(`[Migration] Loaded ${holidayDates.size} holidays`);

    // 2. Fetch complete time entries with optional date filtering
    console.log('[Migration] Fetching complete time entries...');
    
    // Build query with optional date filter for daily cron job
    let query = supabase
      .from('time_entries')
      .select('id, user_id, clock_in_time, clock_out_time, notes')
      .not('clock_out_time', 'is', null)
      .order('clock_in_time', { ascending: true });
    
    // For daily cron: process entries from last 30 hours (24h + 6h buffer for timesheet day logic)
    // Timesheet day = 06:01 AM - 06:00 AM next day
    if (processLast24h) {
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - 30);
      query = query.gte('clock_out_time', cutoffTime.toISOString());
      console.log(`[Migration] Filtering entries with clock_out >= ${cutoffTime.toISOString()}`);
    }
    
    query = query.range(offset, offset + limit - 1);
    const { data: timeEntries, error: entriesError } = await query;

    if (entriesError) {
      throw new Error(`Failed to fetch time entries: ${entriesError.message}`);
    }

    if (!timeEntries || timeEntries.length === 0) {
      console.log('[Migration] No complete time entries found');
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No complete time entries to migrate',
          stats: { processed: 0, generated: 0, errors: 0 },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Migration] Found ${timeEntries.length} complete time entries`);

    // 3. Process in BATCHES to avoid CPU timeout
    const BATCH_SIZE = 3; // ✅ Redus pentru a evita CPU timeout
    const totalBatches = Math.ceil(timeEntries.length / BATCH_SIZE);
    
    let totalProcessedCount = 0;
    let totalGeneratedCount = 0;
    let totalErrorCount = 0;

    console.log(`[Migration] Processing ${timeEntries.length} entries in ${totalBatches} batches of ${BATCH_SIZE}...`);

    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const batchStart = batchIndex * BATCH_SIZE;
      const batchEnd = Math.min(batchStart + BATCH_SIZE, timeEntries.length);
      const batch = timeEntries.slice(batchStart, batchEnd);

      try {
        const batchTimesheets: TimesheetEntry[] = [];

        // Process each entry in the batch
        for (const entry of batch) {
          try {
            // ✅ Extrage tipul de tură din notes (ex: "Tip: Condus")
            const shiftTypeMatch = entry.notes?.match(/Tip:\s*(Condus|Pasager|Normal|Utilaj)/i);
            const shiftType = shiftTypeMatch ? shiftTypeMatch[1].toLowerCase() : 'normal';
            
            const shift: Shift = {
              user_id: entry.user_id,
              clock_in_time: entry.clock_in_time,
              clock_out_time: entry.clock_out_time,
              notes: entry.notes,
              shiftType  // ✅ Pasează tipul de tură
            };

            const timesheets = segmentShiftIntoTimesheets(shift, holidayDates);

            // Validate each timesheet
            for (const timesheet of timesheets) {
              const errors = validateTimesheet(timesheet);
              if (errors.length > 0) {
                console.error(`[Migration] Validation errors for entry ${entry.id}:`, errors);
                totalErrorCount++;
              } else {
                batchTimesheets.push(timesheet);
                totalGeneratedCount++;
              }
            }

            totalProcessedCount++;
          } catch (error) {
            console.error(`[Migration] Error processing entry ${entry.id}:`, error);
            totalErrorCount++;
          }
        }

        // 4. Aggregate batch timesheets by employee_id + work_date
        if (batchTimesheets.length > 0) {
          
          const aggregatedMap = new Map<string, TimesheetEntry>();
          
          for (const sheet of batchTimesheets) {
            const key = `${sheet.employee_id}_${sheet.work_date}`;
            
            if (aggregatedMap.has(key)) {
              // Sum hours with existing entry for same employee + date
              const existing = aggregatedMap.get(key)!;
              existing.hours_regular += sheet.hours_regular;
              existing.hours_night += sheet.hours_night;
              existing.hours_saturday += sheet.hours_saturday;
              existing.hours_sunday += sheet.hours_sunday;
              existing.hours_holiday += sheet.hours_holiday;
              existing.hours_passenger += sheet.hours_passenger;
              existing.hours_driving += sheet.hours_driving;
              existing.hours_equipment += sheet.hours_equipment;
              existing.hours_leave += sheet.hours_leave;
              existing.hours_medical_leave += sheet.hours_medical_leave;
              
              // Combine notes if both exist
              if (sheet.notes && existing.notes) {
                existing.notes = `${existing.notes}; ${sheet.notes}`;
              } else if (sheet.notes) {
                existing.notes = sheet.notes;
              }
            } else {
              // First entry for this employee + date combination
              aggregatedMap.set(key, { ...sheet });
            }
          }
          
          const aggregatedTimesheets = Array.from(aggregatedMap.values());

          // 5. Upsert batch timesheets to database
          const { error: upsertError } = await supabase
            .from('daily_timesheets')
            .upsert(aggregatedTimesheets, {
              onConflict: 'employee_id,work_date',
            });

          if (upsertError) {
            throw new Error(`Batch ${batchIndex + 1} upsert failed: ${upsertError.message}`);
          }
        }

      } catch (batchError) {
        console.error(`[Migration] Batch ${batchIndex + 1} failed:`, batchError);
        totalErrorCount++;
        // Continue with next batch even if this one failed
      }
    }

    console.log(`[Migration] All batches completed! Total: ${totalProcessedCount} entries processed, ${totalGeneratedCount} timesheets generated, ${totalErrorCount} errors`);

    console.log('[Migration] Migration completed successfully!');

    return new Response(
      JSON.stringify({
        success: true,
        message: `Migration completed: ${totalProcessedCount} entries processed, ${totalGeneratedCount} timesheets generated`,
        stats: {
          processed: totalProcessedCount,
          generated: totalGeneratedCount,
          errors: totalErrorCount,
        },
        page: {
          limit,
          offset,
          returned: Array.isArray(timeEntries) ? timeEntries.length : 0,
          has_more: Array.isArray(timeEntries) ? timeEntries.length === limit : false
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Migration] Fatal error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage,
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});