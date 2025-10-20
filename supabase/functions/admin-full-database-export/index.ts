import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    // Verify user is authenticated
    const {
      data: { user },
      error: authError,
    } = await supabaseClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user is admin
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

    console.log('Starting full database export for admin:', user.id);

    // Export all tables
    const [
      { data: profiles },
      { data: userRoles },
      { data: timeEntries },
      { data: dailyTimesheets },
      { data: weeklySchedules },
      { data: vacationRequests },
      { data: vacationBalances },
      { data: workLocations },
      { data: holidays },
      { data: securityAlerts },
      { data: auditLogs },
      { data: faceVerificationLogs },
      { data: notificationPreferences },
      { data: notificationDeliveryLogs },
      { data: scheduleNotifications },
      { data: userConsents },
      { data: gdprRequests },
      { data: adminSessions },
      { data: employeeSessions },
      { data: timeEntrySegments },
      { data: teamTimeDiscrepancies },
      { data: timeEntryCorrectionRequests },
      { data: userPasswordTracking },
      { data: appVersions },
      { data: dataRetentionPolicies },
      { data: rateLimitConfig },
      { data: rateLimitAttempts },
      { data: workHourRules },
      { data: pushSubscriptions },
      { data: locations },
      { data: projects },
      { data: executionItems },
      { data: notificationSettings },
    ] = await Promise.all([
      supabaseClient.from('profiles').select('*'),
      supabaseClient.from('user_roles').select('*'),
      supabaseClient.from('time_entries').select('*').order('clock_in_time', { ascending: false }),
      supabaseClient.from('daily_timesheets').select('*').order('work_date', { ascending: false }),
      supabaseClient.from('weekly_schedules').select('*').order('week_start_date', { ascending: false }),
      supabaseClient.from('vacation_requests').select('*').order('created_at', { ascending: false }),
      supabaseClient.from('vacation_balances').select('*'),
      supabaseClient.from('work_locations').select('*'),
      supabaseClient.from('holidays').select('*').order('date', { ascending: false }),
      supabaseClient.from('security_alerts').select('*').order('created_at', { ascending: false }),
      supabaseClient.from('audit_logs').select('*').order('created_at', { ascending: false }),
      supabaseClient.from('face_verification_logs').select('*').order('created_at', { ascending: false }),
      supabaseClient.from('notification_preferences').select('*'),
      supabaseClient.from('notification_delivery_logs').select('*').order('sent_at', { ascending: false }),
      supabaseClient.from('schedule_notifications').select('*').order('created_at', { ascending: false }),
      supabaseClient.from('user_consents').select('*').order('created_at', { ascending: false }),
      supabaseClient.from('gdpr_requests').select('*').order('created_at', { ascending: false }),
      supabaseClient.from('admin_sessions').select('*').order('created_at', { ascending: false }),
      supabaseClient.from('employee_sessions').select('*').order('created_at', { ascending: false }),
      supabaseClient.from('time_entry_segments').select('*'),
      supabaseClient.from('team_time_discrepancies').select('*').order('created_at', { ascending: false }),
      supabaseClient.from('time_entry_correction_requests').select('*').order('created_at', { ascending: false }),
      supabaseClient.from('user_password_tracking').select('*'),
      supabaseClient.from('app_versions').select('*').order('created_at', { ascending: false }),
      supabaseClient.from('data_retention_policies').select('*'),
      supabaseClient.from('rate_limit_config').select('*'),
      supabaseClient.from('rate_limit_attempts').select('*').order('created_at', { ascending: false }),
      supabaseClient.from('work_hour_rules').select('*'),
      supabaseClient.from('push_subscriptions').select('*'),
      supabaseClient.from('locations').select('*'),
      supabaseClient.from('projects').select('*'),
      supabaseClient.from('execution_items').select('*'),
      supabaseClient.from('notification_settings').select('*'),
    ]);

    const exportData = {
      exportDate: new Date().toISOString(),
      exportedBy: user.id,
      version: '1.0',
      database: {
        profiles: profiles || [],
        user_roles: userRoles || [],
        time_entries: timeEntries || [],
        daily_timesheets: dailyTimesheets || [],
        weekly_schedules: weeklySchedules || [],
        vacation_requests: vacationRequests || [],
        vacation_balances: vacationBalances || [],
        work_locations: workLocations || [],
        holidays: holidays || [],
        security_alerts: securityAlerts || [],
        audit_logs: auditLogs || [],
        face_verification_logs: faceVerificationLogs || [],
        notification_preferences: notificationPreferences || [],
        notification_delivery_logs: notificationDeliveryLogs || [],
        schedule_notifications: scheduleNotifications || [],
        user_consents: userConsents || [],
        gdpr_requests: gdprRequests || [],
        admin_sessions: adminSessions || [],
        employee_sessions: employeeSessions || [],
        time_entry_segments: timeEntrySegments || [],
        team_time_discrepancies: teamTimeDiscrepancies || [],
        time_entry_correction_requests: timeEntryCorrectionRequests || [],
        user_password_tracking: userPasswordTracking || [],
        app_versions: appVersions || [],
        data_retention_policies: dataRetentionPolicies || [],
        rate_limit_config: rateLimitConfig || [],
        rate_limit_attempts: rateLimitAttempts || [],
        work_hour_rules: workHourRules || [],
        push_subscriptions: pushSubscriptions || [],
        locations: locations || [],
        projects: projects || [],
        execution_items: executionItems || [],
        notification_settings: notificationSettings || [],
      },
      statistics: {
        total_profiles: profiles?.length || 0,
        total_time_entries: timeEntries?.length || 0,
        total_daily_timesheets: dailyTimesheets?.length || 0,
        total_schedules: weeklySchedules?.length || 0,
        total_vacation_requests: vacationRequests?.length || 0,
      },
    };

    // Log export action
    await supabaseClient.from('audit_logs').insert({
      user_id: user.id,
      action: 'full_database_export',
      resource_type: 'database',
      details: {
        timestamp: new Date().toISOString(),
        statistics: exportData.statistics,
      },
    });

    console.log('Full database export completed:', exportData.statistics);

    return new Response(
      JSON.stringify(exportData),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="database-full-export-${Date.now()}.json"`,
        },
      }
    );
  } catch (error) {
    console.error('Error in admin-full-database-export:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
