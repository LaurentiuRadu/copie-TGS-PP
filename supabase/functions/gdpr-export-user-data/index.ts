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
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

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

    console.log('Exporting data for user:', user.id);

    // Fetch user profile
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    // Fetch user roles
    const { data: roles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    // Fetch time entries
    const { data: timeEntries } = await supabaseClient
      .from('time_entries')
      .select('*')
      .eq('user_id', user.id)
      .order('clock_in_time', { ascending: false });

    // Fetch vacation requests
    const { data: vacations } = await supabaseClient
      .from('vacation_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    // Fetch weekly schedules
    const { data: schedules } = await supabaseClient
      .from('weekly_schedules')
      .select('*')
      .eq('user_id', user.id)
      .order('week_start_date', { ascending: false });

    // Fetch user consents
    const { data: consents } = await supabaseClient
      .from('user_consents')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    // Fetch GDPR requests
    const { data: gdprRequests } = await supabaseClient
      .from('gdpr_requests')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    // Fetch active sessions
    const { data: sessions } = await supabaseClient
      .from('active_sessions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    const exportData = {
      exportDate: new Date().toISOString(),
      user: {
        id: user.id,
        email: user.email,
        created_at: user.created_at,
      },
      profile,
      roles: roles?.map(r => r.role) || [],
      timeEntries: timeEntries || [],
      vacations: vacations || [],
      schedules: schedules || [],
      consents: consents || [],
      gdprRequests: gdprRequests || [],
      activeSessions: sessions || [],
    };

    // Log GDPR request
    await supabaseClient.from('gdpr_requests').insert({
      user_id: user.id,
      request_type: 'export',
      status: 'completed',
      processed_at: new Date().toISOString(),
    });

    console.log('Data export completed for user:', user.id);

    return new Response(
      JSON.stringify(exportData),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="gdpr-export-${user.id}-${Date.now()}.json"`,
        },
      }
    );
  } catch (error) {
    console.error('Error in gdpr-export-user-data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
