import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AdminStats {
  totalEmployees: number;
  activeToday: number;
  pendingVacations: number;
  pendingCorrections: number;
  avgHours: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    console.log('[get-admin-stats] Starting batch query...');

    // ✅ Batch all 5 queries in parallel
    const [
      totalEmployeesResult,
      activeTodayResult,
      pendingVacationsResult,
      pendingCorrectionsResult,
      avgHoursResult,
    ] = await Promise.all([
      // Total employees
      supabaseClient
        .from('profiles')
        .select('*', { count: 'exact', head: true }),

      // Active today (clocked in, not clocked out)
      supabaseClient
        .from('time_entries')
        .select('*', { count: 'exact', head: true })
        .gte('clock_in_time', `${new Date().toISOString().split('T')[0]}T00:00:00`)
        .is('clock_out_time', null),

      // Pending vacation requests
      supabaseClient
        .from('vacation_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),

      // Pending correction requests
      supabaseClient
        .from('time_entry_correction_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),

      // Average hours per day (current week)
      (async () => {
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay() + 1);
        const startDate = startOfWeek.toISOString().split('T')[0];

        const { data, error } = await supabaseClient
          .from('daily_timesheets')
          .select('hours_regular, hours_night, work_date')
          .gte('work_date', startDate);

        if (error) throw error;
        if (!data || data.length === 0) return '0.0';

        const totalHours = data.reduce(
          (sum, entry) => sum + (entry.hours_regular || 0) + (entry.hours_night || 0),
          0
        );
        const uniqueDays = new Set(data.map((entry) => entry.work_date)).size;
        return uniqueDays > 0 ? (totalHours / uniqueDays).toFixed(1) : '0.0';
      })(),
    ]);

    // Check for errors
    if (totalEmployeesResult.error) throw totalEmployeesResult.error;
    if (activeTodayResult.error) throw activeTodayResult.error;
    if (pendingVacationsResult.error) throw pendingVacationsResult.error;
    if (pendingCorrectionsResult.error) throw pendingCorrectionsResult.error;

    const stats: AdminStats = {
      totalEmployees: totalEmployeesResult.count || 0,
      activeToday: activeTodayResult.count || 0,
      pendingVacations: pendingVacationsResult.count || 0,
      pendingCorrections: pendingCorrectionsResult.count || 0,
      avgHours: avgHoursResult as string,
    };

    console.log('[get-admin-stats] ✅ Batch query complete:', stats);

    return new Response(JSON.stringify(stats), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('[get-admin-stats] ❌ Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: 'Failed to fetch admin statistics',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
