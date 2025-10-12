import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WithdrawVacationRequest {
  request_id: string;
  reason?: string;
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
      console.error('[Withdraw Vacation] ❌ Missing authorization header');
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
      console.error('[Withdraw Vacation] ❌ Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Withdraw Vacation] ✅ Auth OK - User:', user.id);

    // Parse request body
    const { request_id, reason }: WithdrawVacationRequest = await req.json();

    if (!request_id) {
      return new Response(
        JSON.stringify({ error: 'Missing request_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Withdraw Vacation] 📥 Processing withdrawal for request:', request_id);

    // Fetch cererea
    const { data: vacationRequest, error: fetchError } = await supabaseAdmin
      .from('vacation_requests')
      .select('*')
      .eq('id', request_id)
      .single();

    if (fetchError || !vacationRequest) {
      console.error('[Withdraw Vacation] ❌ Request not found:', fetchError);
      return new Response(
        JSON.stringify({ error: 'Request not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificăm permisiunile: admin SAU proprietarul cererii
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();

    const isAdmin = !!roles;
    const isOwner = vacationRequest.user_id === user.id;

    if (!isAdmin && !isOwner) {
      console.error('[Withdraw Vacation] ❌ Permission denied');
      return new Response(
        JSON.stringify({ error: 'Permission denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validăm statusul
    if (vacationRequest.status !== 'approved') {
      console.error('[Withdraw Vacation] ❌ Request not approved:', vacationRequest.status);
      return new Response(
        JSON.stringify({ error: 'Only approved requests can be withdrawn' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (vacationRequest.type !== 'vacation') {
      console.error('[Withdraw Vacation] ❌ Not a vacation request:', vacationRequest.type);
      return new Response(
        JSON.stringify({ error: 'Only vacation (CO) requests can be withdrawn' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Withdraw Vacation] ✅ Validation passed, processing dates:', {
      start: vacationRequest.start_date,
      end: vacationRequest.end_date,
      days: vacationRequest.days_count
    });

    // Generăm lista TUTUROR zilelor din interval (inclusiv weekend-uri)
    const startDate = new Date(vacationRequest.start_date);
    const endDate = new Date(vacationRequest.end_date);
    const dateList: string[] = [];
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      dateList.push(d.toISOString().split('T')[0]);
    }

    console.log(`[Withdraw Vacation] 📅 Generated ${dateList.length} total days (including weekends):`, dateList);

    // Ștergem/resetăm zilele din daily_timesheets
    let daysRemoved = 0;
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
          console.log(`[Withdraw Vacation] ⚠️ No timesheet entry for ${workDate}`);
          continue;
        }

        // Verificăm dacă are hours_leave > 0
        if (existingEntry.hours_leave === 0) {
          console.log(`[Withdraw Vacation] ⚠️ Entry for ${workDate} has no leave hours`);
          continue;
        }

        // Ștergem înregistrarea (sau resetăm la 0)
        const { error: deleteError } = await supabaseAdmin
          .from('daily_timesheets')
          .delete()
          .eq('id', existingEntry.id);

        if (deleteError) {
          console.error(`[Withdraw Vacation] ❌ Failed to delete ${workDate}:`, deleteError);
          failedDates.push(workDate);
        } else {
          console.log(`[Withdraw Vacation] ✅ Removed leave hours for ${workDate}`);
          daysRemoved++;
          removedDates.push(workDate);
        }
      } catch (err) {
        console.error(`[Withdraw Vacation] ❌ Exception for ${workDate}:`, err);
        failedDates.push(workDate);
      }
    }

    console.log(`[Withdraw Vacation] 📊 Deletion summary: ${daysRemoved} removed, ${failedDates.length} failed`);

    // CRITICAL: Verificăm dacă am reușit să ștergem măcar o zi
    if (daysRemoved === 0) {
      console.error('[Withdraw Vacation] ❌ No days were removed from timesheet');
      return new Response(
        JSON.stringify({ 
          error: 'Nu s-au putut șterge zilele din pontaj. Verificați dacă cererea are zile în pontaj.',
          days_removed: 0,
          total_days: dateList.length,
          failed_dates: failedDates
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // DOAR DUPĂ CE AM ȘTERS CU SUCCES ZILELE, actualizăm statusul
    const { error: updateError } = await supabaseAdmin
      .from('vacation_requests')
      .update({
        status: 'withdrawn',
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        admin_notes: reason || 'Retras automat'
      })
      .eq('id', request_id);

    if (updateError) {
      console.error('[Withdraw Vacation] ❌ Failed to update request:', updateError);
      return new Response(
        JSON.stringify({ error: 'Zilele au fost șterse, dar nu s-a putut actualiza statusul cererii' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Withdraw Vacation] ✅ Request status updated to withdrawn');
    
    // Trigger-ul update_vacation_balance_on_request_change() va actualiza automat soldul

    const result = {
      success: true,
      days_removed: daysRemoved,
      days_failed: failedDates.length,
      total_days: dateList.length,
      removed_dates: removedDates,
      failed_dates: failedDates,
    };

    console.log('[Withdraw Vacation] ✅ Withdrawal complete:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Withdraw Vacation] ❌ Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
