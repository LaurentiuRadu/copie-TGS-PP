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
 * Găsește următorul moment critic de segmentare (00:00, 06:00, 22:00)
 */
function getNextCriticalTime(currentTime: Date): Date {
  const result = new Date(currentTime);
  const currentHour = result.getHours();
  const currentMinute = result.getMinutes();
  
  // Dacă suntem înainte de 06:00, mergi la 06:00 aceeași zi
  if (currentHour < 6 || (currentHour === 6 && currentMinute === 0)) {
    result.setHours(6, 0, 0, 0);
    return result;
  }
  
  // Dacă suntem între 06:00 și 22:00, mergi la 22:00 aceeași zi
  if (currentHour < 22 || (currentHour === 22 && currentMinute === 0)) {
    result.setHours(22, 0, 0, 0);
    return result;
  }
  
  // Dacă suntem după 22:00, mergi la 00:00 ziua următoare
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
 * - Noapte 22:01 → 06:00 = hours_night (1.25x)
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
  
  // NOAPTE (22:01 → 06:00) - oricare zi (Luni-Vineri)
  if (startHour >= 22 && (startHour > 22 || startMinute >= 1)) {
    return 'hours_night';
  }
  
  if (startHour < 6 || (startHour === 6 && startMinute === 0)) {
    return 'hours_night';
  }
  
  // ORE NORMALE (06:01 → 22:00) - Luni-Vineri
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
  const shiftStart = new Date(shift.clock_in_time);
  const shiftEnd = new Date(shift.clock_out_time);

  // ✅ Detectează tipul de tură din notes (default: 'normal')
  const shiftType = shift.shiftType || 'normal';
  console.log(`[Migrate Segment] Processing shift type: ${shiftType}`);

  let currentTime = new Date(shiftStart);

  while (currentTime < shiftEnd) {
    const nextCritical = getNextCriticalTime(currentTime);
    const segmentEnd = nextCritical > shiftEnd ? shiftEnd : nextCritical;

    const hoursDecimal = (segmentEnd.getTime() - currentTime.getTime()) / (1000 * 60 * 60);
    const roundedHours = Math.round(hoursDecimal * 100) / 100;

    if (roundedHours > 0) {
      const workDate = currentTime.toISOString().split('T')[0];
      
      // ✅ LOGICĂ NOUĂ: Determină coloana bazat pe tipul de tură
      let hoursType: string;
      
      if (shiftType === 'condus') {
        hoursType = 'hours_driving';  // Toate orele → Condus
      } else if (shiftType === 'pasager') {
        hoursType = 'hours_passenger';  // Toate orele → Pasager
      } else if (shiftType === 'utilaj') {
        hoursType = 'hours_equipment';  // Toate orele → Utilaj
      } else {
        // Doar pentru "normal" → fragmentare bazată pe timp
        hoursType = determineHoursType(currentTime, segmentEnd, holidayDates);
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

      (existingEntry as any)[hoursType] = 
        ((existingEntry as any)[hoursType] as number) + roundedHours;

      // Round all values to 2 decimals
      existingEntry.hours_regular = Math.round(existingEntry.hours_regular * 100) / 100;
      existingEntry.hours_night = Math.round(existingEntry.hours_night * 100) / 100;
      existingEntry.hours_saturday = Math.round(existingEntry.hours_saturday * 100) / 100;
      existingEntry.hours_sunday = Math.round(existingEntry.hours_sunday * 100) / 100;
      existingEntry.hours_holiday = Math.round(existingEntry.hours_holiday * 100) / 100;
    }

    currentTime = segmentEnd;
  }

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
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse request body for optional parameters
    const body = await req.json().catch(() => ({}));
    const processLast24h = body.process_last_24h || false;
    
    console.log(`[Migration] Starting timesheet migration (last 24h mode: ${processLast24h})...`);

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

    // 3. Process each time entry
    let processedCount = 0;
    let generatedCount = 0;
    let errorCount = 0;
    const allTimesheets: TimesheetEntry[] = [];

    for (const entry of timeEntries) {
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
            errorCount++;
          } else {
            allTimesheets.push(timesheet);
            generatedCount++;
          }
        }

        processedCount++;
      } catch (error) {
        console.error(`[Migration] Error processing entry ${entry.id}:`, error);
        errorCount++;
      }
    }

    console.log(`[Migration] Processed ${processedCount} entries, generated ${generatedCount} timesheets`);

    // 4. Aggregate timesheets by employee_id + work_date before upserting
    // This prevents "ON CONFLICT DO UPDATE command cannot affect row a second time" error
    // which occurs when multiple shifts generate timesheets for the same employee + date
    if (allTimesheets.length > 0) {
      console.log(`[Migration] Aggregating ${allTimesheets.length} timesheet entries...`);
      
      const aggregatedMap = new Map<string, TimesheetEntry>();
      
      for (const sheet of allTimesheets) {
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
      console.log(`[Migration] Aggregated into ${aggregatedTimesheets.length} unique timesheets`);

      // 5. Upsert aggregated timesheets to database
      console.log('[Migration] Upserting timesheets to database...');
      const { error: upsertError } = await supabase
        .from('daily_timesheets')
        .upsert(aggregatedTimesheets, {
          onConflict: 'employee_id,work_date',
        });

      if (upsertError) {
        throw new Error(`Failed to upsert timesheets: ${upsertError.message}`);
      }
      
      console.log(`[Migration] Successfully upserted ${aggregatedTimesheets.length} timesheets`);
    }

    console.log('[Migration] Migration completed successfully!');

    return new Response(
      JSON.stringify({
        success: true,
        message: `Migration completed: ${processedCount} entries processed, ${generatedCount} timesheets generated`,
        stats: {
          processed: processedCount,
          generated: generatedCount,
          errors: errorCount,
        },
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
