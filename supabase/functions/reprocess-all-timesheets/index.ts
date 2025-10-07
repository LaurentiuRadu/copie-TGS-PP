import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TimesheetEntry {
  work_date: string;
  employee_id: string;
  hours_regular: number;
  hours_night: number;
  hours_saturday: number;
  hours_sunday: number;
  hours_holiday: number;
  hours_driving: number;
  hours_passenger: number;
  hours_equipment: number;
  notes: string;
}

interface Shift {
  id: string;
  user_id: string;
  clock_in_time: string;
  clock_out_time: string;
  notes: string | null;
}

// Helper: România timezone offset (+2h EET / +3h EEST)
function getRomaniaOffsetMs(date: Date): number {
  const year = date.getUTCFullYear();
  const lastSundayMarch = new Date(Date.UTC(year, 2, 31));
  lastSundayMarch.setUTCDate(31 - lastSundayMarch.getUTCDay());
  lastSundayMarch.setUTCHours(1, 0, 0, 0);

  const lastSundayOctober = new Date(Date.UTC(year, 9, 31));
  lastSundayOctober.setUTCDate(31 - lastSundayOctober.getUTCDay());
  lastSundayOctober.setUTCHours(1, 0, 0, 0);

  const isDST = date >= lastSundayMarch && date < lastSundayOctober;
  return isDST ? 3 * 3600 * 1000 : 2 * 3600 * 1000;
}

function getNextMidnight(currentTime: Date): Date {
  const offsetMs = getRomaniaOffsetMs(currentTime);
  const localMs = currentTime.getTime() + offsetMs;
  const localDate = new Date(localMs);
  const nextMidnightLocal = new Date(
    Date.UTC(
      localDate.getUTCFullYear(),
      localDate.getUTCMonth(),
      localDate.getUTCDate() + 1,
      0, 0, 0, 0
    )
  );
  return new Date(nextMidnightLocal.getTime() - offsetMs);
}

function getNextCriticalTime(currentTime: Date): Date {
  const offsetMs = getRomaniaOffsetMs(currentTime);
  const localMs = currentTime.getTime() + offsetMs;
  const localDate = new Date(localMs);

  const hour = localDate.getUTCHours();
  const minute = localDate.getUTCMinutes();

  let nextHour: number;
  let nextMinute = 0;

  if (hour < 6) {
    nextHour = 6;
  } else if (hour === 6 && minute === 0) {
    nextHour = 6;
    nextMinute = 1;
  } else if (hour < 22) {
    nextHour = 22;
  } else {
    const tomorrow = new Date(localMs);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    return new Date(tomorrow.getTime() - offsetMs);
  }

  const nextCriticalLocal = new Date(
    Date.UTC(
      localDate.getUTCFullYear(),
      localDate.getUTCMonth(),
      localDate.getUTCDate(),
      nextHour,
      nextMinute,
      0,
      0
    )
  );

  return new Date(nextCriticalLocal.getTime() - offsetMs);
}

function isLegalHoliday(date: Date, holidayDates: Set<string>): boolean {
  const offsetMs = getRomaniaOffsetMs(date);
  const localMs = date.getTime() + offsetMs;
  const localDate = new Date(localMs);
  const dateStr = localDate.toISOString().split('T')[0];
  return holidayDates.has(dateStr);
}

function determineHoursType(
  date: Date,
  holidayDates: Set<string>
): 'regular' | 'night' | 'saturday' | 'sunday' | 'holiday' {
  if (isLegalHoliday(date, holidayDates)) {
    return 'holiday';
  }

  const offsetMs = getRomaniaOffsetMs(date);
  const localMs = date.getTime() + offsetMs;
  const localDate = new Date(localMs);
  const dayOfWeek = localDate.getUTCDay();
  const hour = localDate.getUTCHours();

  if (dayOfWeek === 0) return 'sunday';
  if (dayOfWeek === 6) return 'saturday';

  if (hour >= 22 || hour < 6) {
    return 'night';
  }

  return 'regular';
}

function segmentShiftIntoTimesheets(shift: Shift, holidayDates: Set<string>): TimesheetEntry[] {
  const startUTC = new Date(shift.clock_in_time);
  const endUTC = new Date(shift.clock_out_time);

  const startOffsetMs = getRomaniaOffsetMs(startUTC);
  const startLocalMs = startUTC.getTime() + startOffsetMs;
  const startLocal = new Date(startLocalMs);
  const startDateStr = startLocal.toISOString().split('T')[0];

  console.log(`[Migration Timezone] UTC → România: ${startUTC.toISOString()} → ${startLocal.toISOString()} (offset: ${startOffsetMs / 3600000}h)`);

  const shiftType = shift.notes?.toLowerCase() || '';
  const isSpecialShift = ['condus', 'pasager', 'utilaj'].some(t => shiftType.includes(t));

  const dailyMap = new Map<string, TimesheetEntry>();

  if (isSpecialShift) {
    const durationMs = endUTC.getTime() - startUTC.getTime();
    const durationHours = durationMs / (1000 * 3600);

    let hoursField: keyof TimesheetEntry = 'hours_driving';
    if (shiftType.includes('pasager')) hoursField = 'hours_passenger';
    else if (shiftType.includes('utilaj')) hoursField = 'hours_equipment';

    const entry: TimesheetEntry = {
      work_date: startDateStr,
      employee_id: shift.user_id,
      hours_regular: 0,
      hours_night: 0,
      hours_saturday: 0,
      hours_sunday: 0,
      hours_holiday: 0,
      hours_driving: 0,
      hours_passenger: 0,
      hours_equipment: 0,
      notes: shift.notes || '',
    };
    entry[hoursField] = parseFloat(durationHours.toFixed(2));
    dailyMap.set(startDateStr, entry);
  } else {
    let currentTime = startUTC;

    while (currentTime < endUTC) {
      const nextCritical = getNextCriticalTime(currentTime);
      const segmentEnd = nextCritical < endUTC ? nextCritical : endUTC;

      const segmentDurationMs = segmentEnd.getTime() - currentTime.getTime();
      const segmentDurationHours = segmentDurationMs / (1000 * 3600);

      const midpointTime = new Date(currentTime.getTime() + segmentDurationMs / 2);
      const hoursType = determineHoursType(midpointTime, holidayDates);

      const offsetMs = getRomaniaOffsetMs(currentTime);
      const localMs = currentTime.getTime() + offsetMs;
      const localDate = new Date(localMs);
      const workDateStr = localDate.toISOString().split('T')[0];

      if (!dailyMap.has(workDateStr)) {
        dailyMap.set(workDateStr, {
          work_date: workDateStr,
          employee_id: shift.user_id,
          hours_regular: 0,
          hours_night: 0,
          hours_saturday: 0,
          hours_sunday: 0,
          hours_holiday: 0,
          hours_driving: 0,
          hours_passenger: 0,
          hours_equipment: 0,
          notes: shift.notes || '',
        });
      }

      const entry = dailyMap.get(workDateStr)!;
      switch (hoursType) {
        case 'regular':
          entry.hours_regular += segmentDurationHours;
          break;
        case 'night':
          entry.hours_night += segmentDurationHours;
          break;
        case 'saturday':
          entry.hours_saturday += segmentDurationHours;
          break;
        case 'sunday':
          entry.hours_sunday += segmentDurationHours;
          break;
        case 'holiday':
          entry.hours_holiday += segmentDurationHours;
          break;
      }

      currentTime = segmentEnd;
    }
  }

  const results: TimesheetEntry[] = [];

  for (const [dateStr, entry] of dailyMap.entries()) {
    const totalDayHours = entry.hours_regular + entry.hours_saturday + entry.hours_sunday + entry.hours_holiday;
    const totalNightHours = entry.hours_night;

    if (totalDayHours >= 4.0) {
      const breakHours = 0.5;
      const proportions = {
        regular: entry.hours_regular / totalDayHours,
        saturday: entry.hours_saturday / totalDayHours,
        sunday: entry.hours_sunday / totalDayHours,
        holiday: entry.hours_holiday / totalDayHours,
      };

      const deductions = {
        regular: breakHours * proportions.regular,
        saturday: breakHours * proportions.saturday,
        sunday: breakHours * proportions.sunday,
        holiday: breakHours * proportions.holiday,
      };

      console.log(
        `[Migration Break Day] ✅ Pauză 30 min pentru ${dateStr}: ` +
        `regular -${deductions.regular.toFixed(2)}h, ` +
        `saturday -${deductions.saturday.toFixed(2)}h, ` +
        `sunday -${deductions.sunday.toFixed(2)}h, ` +
        `holiday -${deductions.holiday.toFixed(2)}h`
      );

      entry.hours_regular = Math.max(0, entry.hours_regular - deductions.regular);
      entry.hours_saturday = Math.max(0, entry.hours_saturday - deductions.saturday);
      entry.hours_sunday = Math.max(0, entry.hours_sunday - deductions.sunday);
      entry.hours_holiday = Math.max(0, entry.hours_holiday - deductions.holiday);
    } else if (totalDayHours > 0) {
      console.log(
        `[Migration Break Day] ⚠️ SKIP pauză zi pentru ${dateStr} - ` +
        `total day hours (${totalDayHours.toFixed(2)}h) < 4.0h`
      );
    }

    if (totalNightHours >= 4.0) {
      const nightBreak = 0.25;
      entry.hours_night = Math.max(0, entry.hours_night - nightBreak);
      console.log(`[Migration Break Night] ✅ Pauză 15 min pentru ${dateStr}: night -${nightBreak.toFixed(2)}h`);
    } else if (totalNightHours > 0) {
      console.log(
        `[Migration Break Night] ⚠️ SKIP pauză noapte pentru ${dateStr} - ` +
        `hours_night (${totalNightHours.toFixed(2)}h) < 4.0h`
      );
    }

    entry.hours_regular = parseFloat(entry.hours_regular.toFixed(2));
    entry.hours_night = parseFloat(entry.hours_night.toFixed(2));
    entry.hours_saturday = parseFloat(entry.hours_saturday.toFixed(2));
    entry.hours_sunday = parseFloat(entry.hours_sunday.toFixed(2));
    entry.hours_holiday = parseFloat(entry.hours_holiday.toFixed(2));
    entry.hours_driving = parseFloat(entry.hours_driving.toFixed(2));
    entry.hours_passenger = parseFloat(entry.hours_passenger.toFixed(2));
    entry.hours_equipment = parseFloat(entry.hours_equipment.toFixed(2));

    results.push(entry);
  }

  return results;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { mode = 'all', user_ids, entry_ids, start_date, end_date, dry_run = false } = await req.json();

    console.log(`[Reprocess] Starting with mode: ${mode}, dry_run: ${dry_run}`);

    // Fetch holidays
    const { data: holidays, error: holidaysError } = await supabase
      .from('holidays')
      .select('date');

    if (holidaysError) throw holidaysError;

    const holidayDates = new Set<string>(
      holidays?.map(h => new Date(h.date).toISOString().split('T')[0]) || []
    );

    // Build query for time_entries
    let query = supabase
      .from('time_entries')
      .select('*')
      .not('clock_out_time', 'is', null)
      .order('clock_in_time', { ascending: true });

    if (mode === 'selective') {
      if (user_ids && user_ids.length > 0) {
        query = query.in('user_id', user_ids);
      }
      if (entry_ids && entry_ids.length > 0) {
        query = query.in('id', entry_ids);
      }
    }

    if (start_date) {
      query = query.gte('clock_in_time', `${start_date}T00:00:00Z`);
    }
    if (end_date) {
      query = query.lte('clock_in_time', `${end_date}T23:59:59Z`);
    }

    const { data: timeEntries, error: entriesError } = await query;

    if (entriesError) throw entriesError;

    console.log(`[Reprocess] Found ${timeEntries?.length || 0} time entries`);

    if (!timeEntries || timeEntries.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: 'No time entries found for the specified criteria',
          processed: 0,
          generated: 0,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete existing daily_timesheets if not dry_run
    if (!dry_run) {
      const deleteQuery = supabase.from('daily_timesheets').delete();
      
      if (start_date && end_date) {
        deleteQuery.gte('work_date', start_date).lte('work_date', end_date);
      } else if (start_date) {
        deleteQuery.gte('work_date', start_date);
      } else if (end_date) {
        deleteQuery.lte('work_date', end_date);
      }

      if (mode === 'selective' && user_ids && user_ids.length > 0) {
        deleteQuery.in('employee_id', user_ids);
      }

      const { error: deleteError } = await deleteQuery;
      if (deleteError) {
        console.error('[Reprocess] Error deleting existing timesheets:', deleteError);
      } else {
        console.log('[Reprocess] Deleted existing timesheets for the period');
      }
    }

    // Process entries in batches
    const BATCH_SIZE = 50;
    const batches = Math.ceil(timeEntries.length / BATCH_SIZE);
    let totalProcessed = 0;
    let totalGenerated = 0;
    const errors: any[] = [];

    for (let i = 0; i < batches; i++) {
      const batchStart = i * BATCH_SIZE;
      const batchEnd = Math.min((i + 1) * BATCH_SIZE, timeEntries.length);
      const batch = timeEntries.slice(batchStart, batchEnd);

      console.log(`[Reprocess] Processing batch ${i + 1}/${batches} (${batch.length} entries)`);

      const aggregatedMap = new Map<string, TimesheetEntry>();

      for (const entry of batch) {
        try {
          const shift: Shift = {
            id: entry.id,
            user_id: entry.user_id,
            clock_in_time: entry.clock_in_time,
            clock_out_time: entry.clock_out_time,
            notes: entry.notes,
          };

          const timesheets = segmentShiftIntoTimesheets(shift, holidayDates);

          for (const ts of timesheets) {
            const key = `${ts.employee_id}_${ts.work_date}`;
            if (!aggregatedMap.has(key)) {
              aggregatedMap.set(key, { ...ts });
            } else {
              const existing = aggregatedMap.get(key)!;
              existing.hours_regular += ts.hours_regular;
              existing.hours_night += ts.hours_night;
              existing.hours_saturday += ts.hours_saturday;
              existing.hours_sunday += ts.hours_sunday;
              existing.hours_holiday += ts.hours_holiday;
              existing.hours_driving += ts.hours_driving;
              existing.hours_passenger += ts.hours_passenger;
              existing.hours_equipment += ts.hours_equipment;
            }
          }

          totalProcessed++;
        } catch (error) {
          console.error(`[Reprocess] Error processing entry ${entry.id}:`, error);
          errors.push({ 
            entry_id: entry.id, 
            error: error instanceof Error ? error.message : String(error) 
          });
        }
      }

      // Upsert aggregated timesheets for this batch
      if (!dry_run && aggregatedMap.size > 0) {
        const timesheetsToUpsert = Array.from(aggregatedMap.values()).map(ts => ({
          ...ts,
          hours_regular: parseFloat(ts.hours_regular.toFixed(2)),
          hours_night: parseFloat(ts.hours_night.toFixed(2)),
          hours_saturday: parseFloat(ts.hours_saturday.toFixed(2)),
          hours_sunday: parseFloat(ts.hours_sunday.toFixed(2)),
          hours_holiday: parseFloat(ts.hours_holiday.toFixed(2)),
          hours_driving: parseFloat(ts.hours_driving.toFixed(2)),
          hours_passenger: parseFloat(ts.hours_passenger.toFixed(2)),
          hours_equipment: parseFloat(ts.hours_equipment.toFixed(2)),
        }));

        const { error: upsertError } = await supabase
          .from('daily_timesheets')
          .upsert(timesheetsToUpsert, {
            onConflict: 'employee_id,work_date',
          });

        if (upsertError) {
          console.error('[Reprocess] Error upserting timesheets:', upsertError);
          errors.push({ batch: i + 1, error: upsertError.message });
        } else {
          totalGenerated += timesheetsToUpsert.length;
          console.log(`[Reprocess] Upserted ${timesheetsToUpsert.length} timesheets for batch ${i + 1}`);
        }
      } else if (dry_run) {
        totalGenerated += aggregatedMap.size;
        console.log(`[Reprocess DRY-RUN] Would upsert ${aggregatedMap.size} timesheets for batch ${i + 1}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        mode,
        dry_run,
        processed: totalProcessed,
        generated: totalGenerated,
        errors: errors.length > 0 ? errors : undefined,
        message: dry_run
          ? `Dry-run complete: ${totalProcessed} entries would generate ${totalGenerated} timesheets`
          : `Successfully processed ${totalProcessed} entries and generated ${totalGenerated} timesheets`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Reprocess] Fatal error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
