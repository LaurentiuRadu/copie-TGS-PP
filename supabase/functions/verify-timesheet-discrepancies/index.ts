import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface TimeEntry {
  id: string;
  user_id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  total_hours: number | null;
  status: string;
}

interface DailyTimesheet {
  id: string;
  user_id: string;
  work_date: string;
  total_hours: number;
  status: string;
}

interface Profile {
  id: string;
  full_name: string;
  email: string;
}

interface Discrepancy {
  user_id: string;
  user_name: string;
  user_email: string;
  work_date: string;
  time_entries_total: number;
  daily_timesheet_total: number | null;
  difference: number;
  time_entries_count: number;
  timesheet_exists: boolean;
  entries_details: Array<{
    id: string;
    clock_in: string;
    clock_out: string | null;
    hours: number | null;
    status: string;
  }>;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''));

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: isAdmin } = await supabaseClient.rpc('has_role', {
      _user_id: user.id,
      _role: 'admin',
    });

    if (!isAdmin) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const url = new URL(req.url);
    const startDate = url.searchParams.get('start_date') || '2025-10-17';
    const endDate = url.searchParams.get('end_date') || '2025-10-20';

    console.log(`Verifying timesheet discrepancies from ${startDate} to ${endDate}`);

    const { data: profiles, error: profilesError } = await supabaseClient
      .from('profiles')
      .select('id, full_name, email');

    if (profilesError) {
      throw new Error(`Failed to fetch profiles: ${profilesError.message}`);
    }

    const { data: timeEntries, error: entriesError } = await supabaseClient
      .from('time_entries')
      .select('id, user_id, clock_in_time, clock_out_time, total_hours, status')
      .gte('clock_in_time', `${startDate}T00:00:00`)
      .lte('clock_in_time', `${endDate}T23:59:59`)
      .order('clock_in_time', { ascending: true });

    if (entriesError) {
      throw new Error(`Failed to fetch time entries: ${entriesError.message}`);
    }

    const { data: dailyTimesheets, error: timesheetsError } = await supabaseClient
      .from('daily_timesheets')
      .select('id, user_id, work_date, total_hours, status')
      .gte('work_date', startDate)
      .lte('work_date', endDate)
      .order('work_date', { ascending: true });

    if (timesheetsError) {
      throw new Error(`Failed to fetch daily timesheets: ${timesheetsError.message}`);
    }

    const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
    const timesheetMap = new Map<string, Map<string, DailyTimesheet>>();

    dailyTimesheets?.forEach((ts: DailyTimesheet) => {
      if (!timesheetMap.has(ts.user_id)) {
        timesheetMap.set(ts.user_id, new Map());
      }
      timesheetMap.get(ts.user_id)?.set(ts.work_date, ts);
    });

    const entriesByUserDate = new Map<string, Map<string, TimeEntry[]>>();

    timeEntries?.forEach((entry: TimeEntry) => {
      const date = entry.clock_in_time.split('T')[0];

      if (!entriesByUserDate.has(entry.user_id)) {
        entriesByUserDate.set(entry.user_id, new Map());
      }

      const userDates = entriesByUserDate.get(entry.user_id)!;
      if (!userDates.has(date)) {
        userDates.set(date, []);
      }

      userDates.get(date)!.push(entry);
    });

    const discrepancies: Discrepancy[] = [];

    entriesByUserDate.forEach((dateMap, userId) => {
      const profile = profileMap.get(userId);

      dateMap.forEach((entries, date) => {
        const totalFromEntries = entries.reduce((sum, entry) => {
          return sum + (entry.total_hours || 0);
        }, 0);

        const timesheet = timesheetMap.get(userId)?.get(date);
        const timesheetTotal = timesheet?.total_hours || null;

        const difference = timesheetTotal !== null
          ? Math.abs(totalFromEntries - timesheetTotal)
          : totalFromEntries;

        if (difference > 0.01 || timesheetTotal === null) {
          discrepancies.push({
            user_id: userId,
            user_name: profile?.full_name || 'Unknown',
            user_email: profile?.email || 'Unknown',
            work_date: date,
            time_entries_total: Math.round(totalFromEntries * 100) / 100,
            daily_timesheet_total: timesheetTotal ? Math.round(timesheetTotal * 100) / 100 : null,
            difference: Math.round(difference * 100) / 100,
            time_entries_count: entries.length,
            timesheet_exists: timesheet !== undefined,
            entries_details: entries.map(e => ({
              id: e.id,
              clock_in: e.clock_in_time,
              clock_out: e.clock_out_time || 'N/A',
              hours: e.total_hours ? Math.round(e.total_hours * 100) / 100 : null,
              status: e.status,
            })),
          });
        }
      });
    });

    discrepancies.sort((a, b) => {
      const dateCompare = b.work_date.localeCompare(a.work_date);
      if (dateCompare !== 0) return dateCompare;
      return a.user_name.localeCompare(b.user_name);
    });

    const summary = {
      total_discrepancies: discrepancies.length,
      affected_users: new Set(discrepancies.map(d => d.user_id)).size,
      date_range: { start: startDate, end: endDate },
      missing_timesheets: discrepancies.filter(d => !d.timesheet_exists).length,
      mismatched_hours: discrepancies.filter(d => d.timesheet_exists && d.difference > 0.01).length,
    };

    console.log('Verification completed:', summary);

    return new Response(
      JSON.stringify({
        summary,
        discrepancies,
        timestamp: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  } catch (error) {
    console.error('Error in verify-timesheet-discrepancies:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
