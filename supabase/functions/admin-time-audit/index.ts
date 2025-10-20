import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AuditRequest {
  username?: string;
  user_id?: string;
  start_date: string;
  end_date: string;
}

interface TimeEntry {
  id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  approval_status: string;
  notes: string | null;
}

interface DailyTimesheet {
  work_date: string;
  hours_regular: number;
  hours_night: number;
  hours_saturday: number;
  hours_sunday: number;
  hours_holiday: number;
  hours_passenger: number;
  hours_driving: number;
  hours_equipment: number;
  notes: string | null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Create admin client with service role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get current user from JWT
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user is admin
    const { data: isAdmin, error: roleError } = await supabaseAdmin.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin',
    });

    if (roleError || !isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden - Admin role required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Parse request body
    const body: AuditRequest = await req.json();
    const { username, user_id, start_date, end_date } = body;

    if (!start_date || !end_date) {
      return new Response(
        JSON.stringify({ error: 'start_date and end_date are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Resolve target user
    let targetUserId = user_id;
    let userProfile: any = null;

    if (username) {
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id, username, full_name')
        .eq('username', username)
        .single();

      if (profileError || !profile) {
        return new Response(
          JSON.stringify({ error: `User with username "${username}" not found` }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      targetUserId = profile.id;
      userProfile = profile;
    } else if (user_id) {
      const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id, username, full_name')
        .eq('id', user_id)
        .single();

      if (profileError || !profile) {
        return new Response(
          JSON.stringify({ error: `User with id "${user_id}" not found` }),
          {
            status: 404,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }

      userProfile = profile;
    } else {
      return new Response(
        JSON.stringify({ error: 'Either username or user_id is required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Fetch time entries
    const { data: entries, error: entriesError } = await supabaseAdmin
      .from('time_entries')
      .select('id, clock_in_time, clock_out_time, approval_status, notes')
      .eq('user_id', targetUserId)
      .gte('clock_in_time', start_date)
      .lte('clock_in_time', `${end_date} 23:59:59`)
      .order('clock_in_time');

    if (entriesError) {
      console.error('Error fetching entries:', entriesError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch time entries' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Fetch daily timesheets
    const { data: timesheets, error: timesheetsError } = await supabaseAdmin
      .from('daily_timesheets')
      .select('work_date, hours_regular, hours_night, hours_saturday, hours_sunday, hours_holiday, hours_passenger, hours_driving, hours_equipment, notes')
      .eq('employee_id', targetUserId)
      .gte('work_date', start_date)
      .lte('work_date', end_date)
      .order('work_date');

    if (timesheetsError) {
      console.error('Error fetching timesheets:', timesheetsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch daily timesheets' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Process and compare data
    const daysMap = new Map<string, any>();

    // Group entries by date
    entries?.forEach((entry: TimeEntry) => {
      const date = entry.clock_in_time.split('T')[0];
      if (!daysMap.has(date)) {
        daysMap.set(date, { entries: [], timesheet: null });
      }

      let durationHours = null;
      if (entry.clock_out_time) {
        const clockIn = new Date(entry.clock_in_time);
        const clockOut = new Date(entry.clock_out_time);
        durationHours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
      }

      daysMap.get(date).entries.push({
        id: entry.id,
        clock_in: entry.clock_in_time,
        clock_out: entry.clock_out_time,
        duration_hours: durationHours,
        status: entry.approval_status,
        notes: entry.notes,
      });
    });

    // Add timesheets
    timesheets?.forEach((ts: DailyTimesheet) => {
      if (!daysMap.has(ts.work_date)) {
        daysMap.set(ts.work_date, { entries: [], timesheet: null });
      }

      const total = 
        (ts.hours_regular || 0) +
        (ts.hours_night || 0) +
        (ts.hours_saturday || 0) +
        (ts.hours_sunday || 0) +
        (ts.hours_holiday || 0) +
        (ts.hours_passenger || 0) +
        (ts.hours_driving || 0) +
        (ts.hours_equipment || 0);

      daysMap.get(ts.work_date).timesheet = {
        hours_regular: ts.hours_regular || 0,
        hours_night: ts.hours_night || 0,
        hours_saturday: ts.hours_saturday || 0,
        hours_sunday: ts.hours_sunday || 0,
        hours_holiday: ts.hours_holiday || 0,
        hours_passenger: ts.hours_passenger || 0,
        hours_driving: ts.hours_driving || 0,
        hours_equipment: ts.hours_equipment || 0,
        total,
        notes: ts.notes,
      };
    });

    // Calculate summary and flags
    let totalEntriesHours = 0;
    let totalTimesheetHours = 0;
    let daysWithDiscrepancies = 0;
    let incompleteEntries = 0;
    let missingTimesheets = 0;

    const days = Array.from(daysMap.entries())
      .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
      .map(([date, data]) => {
        const entriesTotal = data.entries
          .filter((e: any) => e.duration_hours !== null)
          .reduce((sum: number, e: any) => sum + e.duration_hours, 0);

        const timesheetTotal = data.timesheet?.total || 0;
        const delta = Math.round((entriesTotal - timesheetTotal) * 100) / 100;

        const flags: string[] = [];
        if (Math.abs(delta) > 0.1) {
          flags.push('discrepancy');
          daysWithDiscrepancies++;
        }
        if (data.entries.some((e: any) => !e.clock_out)) {
          flags.push('incomplete');
          incompleteEntries += data.entries.filter((e: any) => !e.clock_out).length;
        }
        if (data.entries.length > 0 && !data.timesheet) {
          flags.push('missing_timesheet');
          missingTimesheets++;
        }

        totalEntriesHours += entriesTotal;
        totalTimesheetHours += timesheetTotal;

        return {
          date,
          entries: data.entries,
          entries_total_hours: Math.round(entriesTotal * 100) / 100,
          timesheet: data.timesheet || {},
          delta,
          flags,
        };
      });

    // Generate CSV export
    const csvLines = ['Date,Entries Total (h),Timesheet Total (h),Delta (h),Flags'];
    days.forEach((day) => {
      csvLines.push(
        `${day.date},${day.entries_total_hours.toFixed(2)},${(day.timesheet.total || 0).toFixed(2)},${day.delta > 0 ? '+' : ''}${day.delta.toFixed(2)},${day.flags.join('; ')}`
      );
    });
    csvLines.push(
      `Total,${totalEntriesHours.toFixed(2)},${totalTimesheetHours.toFixed(2)},${(totalEntriesHours - totalTimesheetHours) > 0 ? '+' : ''}${(totalEntriesHours - totalTimesheetHours).toFixed(2)},`
    );

    const csvExport = csvLines.join('\n');

    // Log audit action
    await supabaseAdmin.from('audit_logs').insert({
      user_id: user.id,
      action: 'time_audit_view',
      resource_type: 'time_entries',
      resource_id: targetUserId,
      details: {
        target_username: userProfile.username,
        date_range: { start_date, end_date },
        days_analyzed: days.length,
        summary: {
          total_entries_hours: Math.round(totalEntriesHours * 100) / 100,
          total_timesheet_hours: Math.round(totalTimesheetHours * 100) / 100,
          days_with_discrepancies: daysWithDiscrepancies,
        },
      },
    });

    // Return response
    const response = {
      user: {
        id: userProfile.id,
        username: userProfile.username,
        full_name: userProfile.full_name,
      },
      range: {
        start: start_date,
        end: end_date,
      },
      days,
      summary: {
        total_entries_hours: Math.round(totalEntriesHours * 100) / 100,
        total_timesheet_hours: Math.round(totalTimesheetHours * 100) / 100,
        total_delta: Math.round((totalEntriesHours - totalTimesheetHours) * 100) / 100,
        days_with_discrepancies: daysWithDiscrepancies,
        incomplete_entries: incompleteEntries,
        missing_timesheets: missingTimesheets,
      },
      csv_export: csvExport,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in admin-time-audit:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
