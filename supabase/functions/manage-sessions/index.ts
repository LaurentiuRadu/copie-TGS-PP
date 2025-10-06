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

    const { action, sessionId } = await req.json();

    console.log('Session management action:', action, 'for user:', user.id);

    if (action === 'list') {
      // List all active sessions for user
      const { data: sessions, error } = await supabaseClient
        .from('active_sessions')
        .select('*')
        .eq('user_id', user.id)
        .is('invalidated_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ sessions: sessions || [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'logout-single' && sessionId) {
      // Invalidate specific session
      const { error } = await supabaseClient
        .from('active_sessions')
        .update({
          invalidated_at: new Date().toISOString(),
          invalidation_reason: 'user_requested_logout',
        })
        .eq('session_id', sessionId)
        .eq('user_id', user.id);

      if (error) throw error;

      console.log('Session invalidated:', sessionId);

      return new Response(
        JSON.stringify({ success: true, message: 'Sesiune închisă cu succes' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'logout-all') {
      // Invalidate all sessions except current one
      const { error } = await supabaseClient
        .from('active_sessions')
        .update({
          invalidated_at: new Date().toISOString(),
          invalidation_reason: 'user_requested_logout_all',
        })
        .eq('user_id', user.id)
        .is('invalidated_at', null);

      if (error) throw error;

      console.log('All sessions invalidated for user:', user.id);

      return new Response(
        JSON.stringify({ success: true, message: 'Toate sesiunile au fost închise cu succes' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in manage-sessions:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
