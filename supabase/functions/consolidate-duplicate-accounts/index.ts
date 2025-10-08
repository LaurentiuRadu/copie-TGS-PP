import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DuplicatePair {
  adminId: string;
  adminUsername: string;
  employeeId: string;
  employeeUsername: string;
  employeeFullName: string;
}

interface MigrationResult {
  pair: DuplicatePair;
  success: boolean;
  migratedCounts: {
    timeEntries: number;
    dailyTimesheets: number;
    weeklySchedules: number;
    vacationRequests: number;
    vacationBalances: number;
    faceVerificationLogs: number;
    correctionRequests: number;
    tardinessReports: number;
    notificationSettings: number;
    userConsents: number;
    activeSessions: number;
  };
  error?: string;
}

const DUPLICATE_PAIRS: DuplicatePair[] = [
  {
    adminId: '444cfecc-fb2d-46f3-8050-0c762b308850',
    adminUsername: 'laurentiuradu',
    employeeId: '206c6175-6bdc-49fa-8e75-65e9c9e81dfa',
    employeeUsername: 'radulaurentiu',
    employeeFullName: 'IOAN LAURENTIU RADU'
  },
  {
    adminId: '8a5f5c8e-6d4e-4c3b-9a2e-1f8e9d7c6b5a',
    adminUsername: 'catalinaapostu',
    employeeId: 'b6c7d8e9-f0a1-2b3c-4d5e-6f7a8b9c0d1e',
    employeeUsername: 'apostucatalina',
    employeeFullName: 'APOSTU CATALINA'
  },
  {
    adminId: 'c8d9e0f1-a2b3-4c5d-6e7f-8a9b0c1d2e3f',
    adminUsername: 'florincostache',
    employeeId: 'd0e1f2a3-b4c5-6d7e-8f9a-0b1c2d3e4f5a',
    employeeUsername: 'costacheflorin',
    employeeFullName: 'COSTACHE FLORIN'
  },
  {
    adminId: 'e2f3a4b5-c6d7-8e9f-0a1b-2c3d4e5f6a7b',
    adminUsername: 'madalinaghintuiala',
    employeeId: 'f4a5b6c7-d8e9-0f1a-2b3c-4d5e6f7a8b9c',
    employeeUsername: 'ghintuialamadalina',
    employeeFullName: 'GHINTUIALA MADALINA'
  }
];

async function migratePair(
  supabase: any,
  pair: DuplicatePair,
  dryRun: boolean = false
): Promise<MigrationResult> {
  const result: MigrationResult = {
    pair,
    success: false,
    migratedCounts: {
      timeEntries: 0,
      dailyTimesheets: 0,
      weeklySchedules: 0,
      vacationRequests: 0,
      vacationBalances: 0,
      faceVerificationLogs: 0,
      correctionRequests: 0,
      tardinessReports: 0,
      notificationSettings: 0,
      userConsents: 0,
      activeSessions: 0,
    },
  };

  try {
    console.log(`[${dryRun ? 'DRY-RUN' : 'LIVE'}] Migrare început: ${pair.adminUsername} <- ${pair.employeeUsername}`);

    if (!dryRun) {
      // 1. Migrare time_entries
      const { data: timeEntriesData, error: timeEntriesError } = await supabase
        .from('time_entries')
        .update({ user_id: pair.adminId })
        .eq('user_id', pair.employeeId)
        .select('id');
      
      if (timeEntriesError) throw new Error(`time_entries: ${timeEntriesError.message}`);
      result.migratedCounts.timeEntries = timeEntriesData?.length || 0;

      // 2. Migrare daily_timesheets
      const { data: timesheetsData, error: timesheetsError } = await supabase
        .from('daily_timesheets')
        .update({ employee_id: pair.adminId })
        .eq('employee_id', pair.employeeId)
        .select('id');
      
      if (timesheetsError) throw new Error(`daily_timesheets: ${timesheetsError.message}`);
      result.migratedCounts.dailyTimesheets = timesheetsData?.length || 0;

      // 3. Migrare weekly_schedules
      const { data: schedulesData, error: schedulesError } = await supabase
        .from('weekly_schedules')
        .update({ user_id: pair.adminId })
        .eq('user_id', pair.employeeId)
        .select('id');
      
      if (schedulesError) throw new Error(`weekly_schedules: ${schedulesError.message}`);
      result.migratedCounts.weeklySchedules = schedulesData?.length || 0;

      // 4. Migrare vacation_requests
      const { data: vacReqData, error: vacReqError } = await supabase
        .from('vacation_requests')
        .update({ user_id: pair.adminId })
        .eq('user_id', pair.employeeId)
        .select('id');
      
      if (vacReqError) throw new Error(`vacation_requests: ${vacReqError.message}`);
      result.migratedCounts.vacationRequests = vacReqData?.length || 0;

      // 5. Migrare vacation_balances
      const { data: vacBalData, error: vacBalError } = await supabase
        .from('vacation_balances')
        .update({ user_id: pair.adminId })
        .eq('user_id', pair.employeeId)
        .select('id');
      
      if (vacBalError) throw new Error(`vacation_balances: ${vacBalError.message}`);
      result.migratedCounts.vacationBalances = vacBalData?.length || 0;

      // 6. Migrare face_verification_logs
      const { data: faceLogsData, error: faceLogsError } = await supabase
        .from('face_verification_logs')
        .update({ user_id: pair.adminId })
        .eq('user_id', pair.employeeId)
        .select('id');
      
      if (faceLogsError) throw new Error(`face_verification_logs: ${faceLogsError.message}`);
      result.migratedCounts.faceVerificationLogs = faceLogsData?.length || 0;

      // 7. Migrare time_entry_correction_requests
      const { data: corrReqData, error: corrReqError } = await supabase
        .from('time_entry_correction_requests')
        .update({ user_id: pair.adminId })
        .eq('user_id', pair.employeeId)
        .select('id');
      
      if (corrReqError) throw new Error(`time_entry_correction_requests: ${corrReqError.message}`);
      result.migratedCounts.correctionRequests = corrReqData?.length || 0;

      // 8. Migrare tardiness_reports
      const { data: tardReportsData, error: tardReportsError } = await supabase
        .from('tardiness_reports')
        .update({ user_id: pair.adminId })
        .eq('user_id', pair.employeeId)
        .select('id');
      
      if (tardReportsError) throw new Error(`tardiness_reports: ${tardReportsError.message}`);
      result.migratedCounts.tardinessReports = tardReportsData?.length || 0;

      // 9. Migrare notification_settings
      const { data: notifData, error: notifError } = await supabase
        .from('notification_settings')
        .update({ user_id: pair.adminId })
        .eq('user_id', pair.employeeId)
        .select('id');
      
      if (notifError) throw new Error(`notification_settings: ${notifError.message}`);
      result.migratedCounts.notificationSettings = notifData?.length || 0;

      // 10. Migrare user_consents
      const { data: consentsData, error: consentsError } = await supabase
        .from('user_consents')
        .update({ user_id: pair.adminId })
        .eq('user_id', pair.employeeId)
        .select('id');
      
      if (consentsError) throw new Error(`user_consents: ${consentsError.message}`);
      result.migratedCounts.userConsents = consentsData?.length || 0;

      // 11. Migrare active_sessions
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('active_sessions')
        .update({ user_id: pair.adminId })
        .eq('user_id', pair.employeeId)
        .select('id');
      
      if (sessionsError) throw new Error(`active_sessions: ${sessionsError.message}`);
      result.migratedCounts.activeSessions = sessionsData?.length || 0;

      // 12. Actualizare full_name în profilul admin
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: pair.employeeFullName })
        .eq('id', pair.adminId);
      
      if (profileError) throw new Error(`profiles update: ${profileError.message}`);

      // 13. Ștergere rol employee din user_roles
      const { error: roleDeleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', pair.employeeId)
        .eq('role', 'employee');
      
      if (roleDeleteError) throw new Error(`user_roles delete: ${roleDeleteError.message}`);

      // 14. Ștergere profil employee (cascade delete automat)
      const { error: profileDeleteError } = await supabase
        .from('profiles')
        .delete()
        .eq('id', pair.employeeId);
      
      if (profileDeleteError) throw new Error(`profiles delete: ${profileDeleteError.message}`);

      console.log(`[SUCCES] Migrare completă: ${pair.adminUsername} <- ${pair.employeeUsername}`);
      console.log(`  - time_entries: ${result.migratedCounts.timeEntries}`);
      console.log(`  - daily_timesheets: ${result.migratedCounts.dailyTimesheets}`);
      console.log(`  - weekly_schedules: ${result.migratedCounts.weeklySchedules}`);
      console.log(`  - vacation_requests: ${result.migratedCounts.vacationRequests}`);
      console.log(`  - vacation_balances: ${result.migratedCounts.vacationBalances}`);
      console.log(`  - face_verification_logs: ${result.migratedCounts.faceVerificationLogs}`);
      console.log(`  - correction_requests: ${result.migratedCounts.correctionRequests}`);
      console.log(`  - tardiness_reports: ${result.migratedCounts.tardinessReports}`);
      console.log(`  - notification_settings: ${result.migratedCounts.notificationSettings}`);
      console.log(`  - user_consents: ${result.migratedCounts.userConsents}`);
      console.log(`  - active_sessions: ${result.migratedCounts.activeSessions}`);
    } else {
      // Dry-run: doar numără înregistrările
      const { count: teCount } = await supabase
        .from('time_entries')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', pair.employeeId);
      result.migratedCounts.timeEntries = teCount || 0;

      const { count: dtCount } = await supabase
        .from('daily_timesheets')
        .select('*', { count: 'exact', head: true })
        .eq('employee_id', pair.employeeId);
      result.migratedCounts.dailyTimesheets = dtCount || 0;

      const { count: wsCount } = await supabase
        .from('weekly_schedules')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', pair.employeeId);
      result.migratedCounts.weeklySchedules = wsCount || 0;

      console.log(`[DRY-RUN] ${pair.employeeUsername} -> ${pair.adminUsername}: ${result.migratedCounts.timeEntries} time_entries`);
    }

    result.success = true;
  } catch (error: any) {
    console.error(`[EROARE] Migrare eșuată pentru ${pair.adminUsername}:`, error.message);
    result.error = error.message;
    result.success = false;
  }

  return result;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verificare autorizare
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificare dacă user-ul este admin
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

    console.log(`[INFO] Migrare inițiată de admin: ${user.email}`);

    // Parsare body pentru dry-run flag
    const { dryRun = false } = await req.json().catch(() => ({ dryRun: false }));

    if (dryRun) {
      console.log('[INFO] Rulare în mod DRY-RUN (fără modificări reale)');
    } else {
      console.log('[INFO] Rulare în mod LIVE (modificări permanente)');
    }

    // Procesare toate perechile
    const results: MigrationResult[] = [];
    
    for (const pair of DUPLICATE_PAIRS) {
      const result = await migratePair(supabase, pair, dryRun);
      results.push(result);
    }

    // Calculare statistici totale
    const totalStats = results.reduce((acc, r) => ({
      timeEntries: acc.timeEntries + r.migratedCounts.timeEntries,
      dailyTimesheets: acc.dailyTimesheets + r.migratedCounts.dailyTimesheets,
      weeklySchedules: acc.weeklySchedules + r.migratedCounts.weeklySchedules,
      vacationRequests: acc.vacationRequests + r.migratedCounts.vacationRequests,
      vacationBalances: acc.vacationBalances + r.migratedCounts.vacationBalances,
      faceVerificationLogs: acc.faceVerificationLogs + r.migratedCounts.faceVerificationLogs,
      correctionRequests: acc.correctionRequests + r.migratedCounts.correctionRequests,
      tardinessReports: acc.tardinessReports + r.migratedCounts.tardinessReports,
      notificationSettings: acc.notificationSettings + r.migratedCounts.notificationSettings,
      userConsents: acc.userConsents + r.migratedCounts.userConsents,
      activeSessions: acc.activeSessions + r.migratedCounts.activeSessions,
    }), {
      timeEntries: 0,
      dailyTimesheets: 0,
      weeklySchedules: 0,
      vacationRequests: 0,
      vacationBalances: 0,
      faceVerificationLogs: 0,
      correctionRequests: 0,
      tardinessReports: 0,
      notificationSettings: 0,
      userConsents: 0,
      activeSessions: 0,
    });

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    // Log audit
    if (!dryRun) {
      await supabase.from('audit_logs').insert({
        user_id: user.id,
        action: 'consolidate_duplicate_accounts',
        resource_type: 'user_migration',
        resource_id: null,
        details: {
          totalPairs: DUPLICATE_PAIRS.length,
          successCount,
          failureCount,
          totalStats,
          results: results.map(r => ({
            pair: `${r.pair.adminUsername} <- ${r.pair.employeeUsername}`,
            success: r.success,
            error: r.error,
          })),
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        dryRun,
        message: dryRun 
          ? 'Dry-run completat cu succes (fără modificări reale)'
          : 'Migrare completată cu succes',
        totalPairs: DUPLICATE_PAIRS.length,
        successCount,
        failureCount,
        totalStats,
        results,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('[EROARE CRITICĂ]', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
