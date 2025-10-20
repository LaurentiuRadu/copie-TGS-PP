import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConsolidateRequest {
  sourceUserId: string; // Contul de șters (duplicate)
  targetUserId: string; // Contul corect (destinație)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificare autorizare
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      throw new Error('Invalid authorization token');
    }

    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (rolesError || !roles?.some(r => r.role === 'admin')) {
      throw new Error('User is not authorized. Admin role required.');
    }

    const { sourceUserId, targetUserId }: ConsolidateRequest = await req.json();

    if (!sourceUserId || !targetUserId) {
      throw new Error('Missing required fields: sourceUserId and targetUserId');
    }

    if (sourceUserId === targetUserId) {
      throw new Error('Source and target users cannot be the same');
    }

    console.log(`[consolidate] ${sourceUserId} → ${targetUserId} by admin ${user.id}`);

    let migratedCounts = {
      timeEntries: 0,
      dailyTimesheets: 0,
      weeklySchedules: 0,
      vacationRequests: 0,
      vacationBalances: 0,
      faceVerificationLogs: 0,
      correctionRequests: 0,
      notificationSettings: 0,
      userConsents: 0,
      activeSessions: 0,
    };

    // 1. Migrare time_entries
    const { data: timeEntriesData, error: timeEntriesError } = await supabase
      .from('time_entries')
      .update({ user_id: targetUserId })
      .eq('user_id', sourceUserId)
      .select('id');
    
    if (timeEntriesError) throw new Error(`time_entries: ${timeEntriesError.message}`);
    migratedCounts.timeEntries = timeEntriesData?.length || 0;

    // 2. Migrare daily_timesheets
    const { data: timesheetsData, error: timesheetsError } = await supabase
      .from('daily_timesheets')
      .update({ employee_id: targetUserId })
      .eq('employee_id', sourceUserId)
      .select('id');
    
    if (timesheetsError) throw new Error(`daily_timesheets: ${timesheetsError.message}`);
    migratedCounts.dailyTimesheets = timesheetsData?.length || 0;

    // 3. Migrare weekly_schedules
    const { data: schedulesData, error: schedulesError } = await supabase
      .from('weekly_schedules')
      .update({ user_id: targetUserId })
      .eq('user_id', sourceUserId)
      .select('id');
    
    if (schedulesError) throw new Error(`weekly_schedules: ${schedulesError.message}`);
    migratedCounts.weeklySchedules = schedulesData?.length || 0;

    // 4. Migrare vacation_requests
    const { data: vacReqData, error: vacReqError } = await supabase
      .from('vacation_requests')
      .update({ user_id: targetUserId })
      .eq('user_id', sourceUserId)
      .select('id');
    
    if (vacReqError) throw new Error(`vacation_requests: ${vacReqError.message}`);
    migratedCounts.vacationRequests = vacReqData?.length || 0;

    // 5. Migrare vacation_balances (merge)
    const { data: sourceBalances } = await supabase
      .from('vacation_balances')
      .select('*')
      .eq('user_id', sourceUserId);

    if (sourceBalances && sourceBalances.length > 0) {
      for (const balance of sourceBalances) {
        const { data: targetBalance } = await supabase
          .from('vacation_balances')
          .select('*')
          .eq('user_id', targetUserId)
          .eq('year', balance.year)
          .maybeSingle();

        if (targetBalance) {
          await supabase
            .from('vacation_balances')
            .update({
              used_days: targetBalance.used_days + balance.used_days,
              pending_days: targetBalance.pending_days + balance.pending_days,
            })
            .eq('id', targetBalance.id);
        } else {
          await supabase
            .from('vacation_balances')
            .update({ user_id: targetUserId })
            .eq('id', balance.id);
        }
      }
      migratedCounts.vacationBalances = sourceBalances.length;
    }

    // 6. Migrare face_verification_logs
    const { data: faceLogsData, error: faceLogsError } = await supabase
      .from('face_verification_logs')
      .update({ user_id: targetUserId })
      .eq('user_id', sourceUserId)
      .select('id');
    
    if (faceLogsError) throw new Error(`face_verification_logs: ${faceLogsError.message}`);
    migratedCounts.faceVerificationLogs = faceLogsData?.length || 0;

    // 7. Migrare time_entry_correction_requests
    const { data: corrReqData, error: corrReqError } = await supabase
      .from('time_entry_correction_requests')
      .update({ user_id: targetUserId })
      .eq('user_id', sourceUserId)
      .select('id');
    
    if (corrReqError) throw new Error(`correction_requests: ${corrReqError.message}`);
    migratedCounts.correctionRequests = corrReqData?.length || 0;

    // 8. Migrare notification_settings
    const { data: notifData, error: notifError } = await supabase
      .from('notification_settings')
      .update({ user_id: targetUserId })
      .eq('user_id', sourceUserId)
      .select('id');
    
    if (notifError) throw new Error(`notification_settings: ${notifError.message}`);
    migratedCounts.notificationSettings = notifData?.length || 0;

    // 10. Migrare user_consents
    const { data: consentsData, error: consentsError } = await supabase
      .from('user_consents')
      .update({ user_id: targetUserId })
      .eq('user_id', sourceUserId)
      .select('id');
    
    if (consentsError) throw new Error(`user_consents: ${consentsError.message}`);
    migratedCounts.userConsents = consentsData?.length || 0;

    // 11. Migrare admin_sessions
    const { data: adminSessionsData, error: adminSessionsError } = await supabase
      .from('admin_sessions')
      .update({ user_id: targetUserId })
      .eq('user_id', sourceUserId)
      .select('id');
    
    if (adminSessionsError) throw new Error(`admin_sessions: ${adminSessionsError.message}`);

    // 12. Migrare employee_sessions
    const { data: employeeSessionsData, error: employeeSessionsError } = await supabase
      .from('employee_sessions')
      .update({ user_id: targetUserId })
      .eq('user_id', sourceUserId)
      .select('id');
    
    if (employeeSessionsError) throw new Error(`employee_sessions: ${employeeSessionsError.message}`);

    migratedCounts.activeSessions = 
      (adminSessionsData?.length || 0) + (employeeSessionsData?.length || 0);

    // 12. Ștergere dependencies ale contului source
    await supabase.from('user_password_tracking').delete().eq('user_id', sourceUserId);
    await supabase.from('user_roles').delete().eq('user_id', sourceUserId);
    await supabase.from('profiles').delete().eq('id', sourceUserId);

    // 13. Ștergere cont auth
    const { error: deleteError } = await supabase.auth.admin.deleteUser(sourceUserId);
    if (deleteError) throw new Error(`auth delete: ${deleteError.message}`);

    // Log audit
    await supabase.from('audit_logs').insert({
      user_id: user.id,
      action: 'consolidate_accounts',
      resource_type: 'user_migration',
      resource_id: targetUserId,
      details: {
        sourceUserId,
        targetUserId,
        migratedCounts,
      },
    });

    console.log('[SUCCESS] Consolidare completă:', migratedCounts);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Conturi consolidate cu succes',
        migratedCounts,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('[ERROR]', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
