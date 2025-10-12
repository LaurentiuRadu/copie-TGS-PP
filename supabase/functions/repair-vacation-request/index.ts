import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RepairVacationRequest {
  request_id: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    // Service role client pentru operațiuni admin
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verificăm autentificarea
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[Repair Vacation] ❌ Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !user) {
      console.error('[Repair Vacation] ❌ Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificăm că user-ul e admin
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    if (!roles) {
      console.error('[Repair Vacation] ❌ Not an admin');
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Repair Vacation] ✅ Admin authenticated:', user.id);

    // Parse request body
    const { request_id }: RepairVacationRequest = await req.json();

    if (!request_id) {
      return new Response(
        JSON.stringify({ error: 'Missing request_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Repair Vacation] 📥 Repairing request:', request_id);

    // Fetch cererea
    const { data: vacationRequest, error: fetchError } = await supabaseAdmin
      .from('vacation_requests')
      .select('*')
      .eq('id', request_id)
      .single();

    if (fetchError || !vacationRequest) {
      console.error('[Repair Vacation] ❌ Request not found:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Request not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificăm că e withdrawn
    if (vacationRequest.status !== 'withdrawn') {
      console.error('[Repair Vacation] ❌ Request not withdrawn:', vacationRequest.status);
      return new Response(
        JSON.stringify({ error: 'Only withdrawn requests can be repaired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Repair Vacation] ✅ Processing dates:', {
      start: vacationRequest.start_date,
      end: vacationRequest.end_date,
      days: vacationRequest.days_count,
      user: vacationRequest.user_id
    });

    // Generăm lista TUTUROR zilelor din interval (inclusiv weekend-uri)
    const startDate = new Date(vacationRequest.start_date);
    const endDate = new Date(vacationRequest.end_date);
    const dateList: string[] = [];
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      dateList.push(d.toISOString().split('T')[0]);
    }

    console.log(`[Repair Vacation] 📅 Processing ${dateList.length} total days (including weekends)`);

    // Ștergem zilele din daily_timesheets
    let daysRemoved = 0;
    let daysNotFound = 0;
    let daysNoLeave = 0;
    const removedDates: string[] = [];
    const failedDates: string[] = [];

    for (const workDate of dateList) {
      try {
        // Căutăm înregistrarea
        const { data: existingEntry } = await supabaseAdmin
          .from('daily_timesheets')
          .select('*')
          .eq('employee_id', vacationRequest.user_id)
          .eq('work_date', workDate)
          .maybeSingle();

        if (!existingEntry) {
          console.log(`[Repair Vacation] ⚠️ No entry for ${workDate}`);
          daysNotFound++;
          continue;
        }

        // Verificăm dacă are hours_leave > 0
        if (existingEntry.hours_leave === 0) {
          console.log(`[Repair Vacation] ⚠️ Entry for ${workDate} has no leave hours`);
          daysNoLeave++;
          continue;
        }

        // Ștergem înregistrarea
        const { error: deleteError } = await supabaseAdmin
          .from('daily_timesheets')
          .delete()
          .eq('id', existingEntry.id);

        if (deleteError) {
          console.error(`[Repair Vacation] ❌ Failed to delete ${workDate}:`, deleteError);
          failedDates.push(workDate);
        } else {
          console.log(`[Repair Vacation] ✅ Removed ${workDate} (${existingEntry.hours_leave}h)`);
          daysRemoved++;
          removedDates.push(workDate);
        }
      } catch (err) {
        console.error(`[Repair Vacation] ❌ Exception for ${workDate}:`, err);
        failedDates.push(workDate);
      }
    }

    const result = {
      success: true,
      request_id,
      employee_id: vacationRequest.user_id,
      date_range: {
        start: vacationRequest.start_date,
        end: vacationRequest.end_date
      },
      days_processed: dateList.length,
      days_removed: daysRemoved,
      days_not_found: daysNotFound,
      days_no_leave: daysNoLeave,
      days_failed: failedDates.length,
      removed_dates: removedDates,
      failed_dates: failedDates,
      message: daysRemoved > 0 
        ? `✅ Reparat: ${daysRemoved} zile șterse din pontaj`
        : '⚠️ Nicio zi nu a fost găsită pentru ștergere'
    };

    console.log('[Repair Vacation] ✅ Repair complete:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Repair Vacation] ❌ Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
