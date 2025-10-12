import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WithdrawMedicalRequest {
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
      console.error('[Withdraw Medical] ❌ Missing authorization header');
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
      console.error('[Withdraw Medical] ❌ Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Withdraw Medical] ✅ Auth OK - User:', user.id);

    // Parse request body
    const { request_id, reason }: WithdrawMedicalRequest = await req.json();

    if (!request_id) {
      return new Response(
        JSON.stringify({ error: 'Missing request_id' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Withdraw Medical] 📥 Processing withdrawal for request:', request_id);

    // Fetch cererea
    const { data: medicalRequest, error: fetchError } = await supabaseAdmin
      .from('vacation_requests')
      .select('*')
      .eq('id', request_id)
      .single();

    if (fetchError || !medicalRequest) {
      console.error('[Withdraw Medical] ❌ Request not found:', fetchError);
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
    const isOwner = medicalRequest.user_id === user.id;

    if (!isAdmin && !isOwner) {
      console.error('[Withdraw Medical] ❌ Permission denied');
      return new Response(
        JSON.stringify({ error: 'Permission denied' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validăm statusul
    if (medicalRequest.status !== 'approved') {
      console.error('[Withdraw Medical] ❌ Request not approved:', medicalRequest.status);
      return new Response(
        JSON.stringify({ error: 'Only approved requests can be withdrawn' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (medicalRequest.type !== 'sick') {
      console.error('[Withdraw Medical] ❌ Not a medical request:', medicalRequest.type);
      return new Response(
        JSON.stringify({ error: 'Only medical (CM) requests can be withdrawn' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Withdraw Medical] ✅ Validation passed, processing dates:', {
      start: medicalRequest.start_date,
      end: medicalRequest.end_date,
      days: medicalRequest.days_count
    });

    // Generăm lista de zile, EXCLUDING weekends
    const startDate = new Date(medicalRequest.start_date);
    const endDate = new Date(medicalRequest.end_date);
    const dateList: string[] = [];
    let weekendsSkipped = 0;
    
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
      const dayOfWeek = d.getDay();
      
      // Skip Saturday (6) and Sunday (0)
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        dateList.push(d.toISOString().split('T')[0]);
      } else {
        weekendsSkipped++;
      }
    }

    console.log(`[Withdraw Medical] 📅 Generated ${dateList.length} weekdays (${weekendsSkipped} weekends skipped):`, dateList);

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
          .eq('employee_id', medicalRequest.user_id)
          .eq('work_date', workDate)
          .maybeSingle();

        if (!existingEntry) {
          console.log(`[Withdraw Medical] ⚠️ No timesheet entry for ${workDate}`);
          continue;
        }

        // Verificăm dacă are hours_medical_leave > 0
        if (existingEntry.hours_medical_leave === 0) {
          console.log(`[Withdraw Medical] ⚠️ Entry for ${workDate} has no medical leave hours`);
          continue;
        }

        // Ștergem înregistrarea (sau resetăm la 0)
        const { error: deleteError } = await supabaseAdmin
          .from('daily_timesheets')
          .delete()
          .eq('id', existingEntry.id);

        if (deleteError) {
          console.error(`[Withdraw Medical] ❌ Failed to delete ${workDate}:`, deleteError);
          failedDates.push(workDate);
        } else {
          console.log(`[Withdraw Medical] ✅ Removed medical leave hours for ${workDate}`);
          daysRemoved++;
          removedDates.push(workDate);
        }
      } catch (err) {
        console.error(`[Withdraw Medical] ❌ Exception for ${workDate}:`, err);
        failedDates.push(workDate);
      }
    }

    // Actualizăm cererea
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
      console.error('[Withdraw Medical] ❌ Failed to update request:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update request status' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[Withdraw Medical] ✅ Request status updated to withdrawn');

    const result = {
      success: true,
      days_removed: daysRemoved,
      days_failed: failedDates.length,
      total_days: dateList.length,
      removed_dates: removedDates,
      failed_dates: failedDates,
    };

    console.log('[Withdraw Medical] ✅ Withdrawal complete:', result);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Withdraw Medical] ❌ Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
