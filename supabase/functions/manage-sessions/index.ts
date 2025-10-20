import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RequestBody {
  action: 'list' | 'logout-single' | 'logout-all';
  sessionId?: string;
  includeTimeEntries?: boolean;
  excludeCurrentSession?: boolean;
  reason?: string;
}

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

    // Authenticate user
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      console.error('[manage-sessions] Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's role
    const { data: roleData, error: roleError } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (roleError || !roleData) {
      console.error('[manage-sessions] Role fetch error:', roleError);
      return new Response(
        JSON.stringify({ error: 'Role not found' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userRole = roleData.role as 'admin' | 'employee';
    const tableName = userRole === 'admin' ? 'admin_sessions' : 'employee_sessions';

    const body: RequestBody = await req.json();
    const { action, sessionId, includeTimeEntries, excludeCurrentSession, reason } = body;

    console.log(`[manage-sessions] Action: ${action}, User: ${user.id}, Role: ${userRole}`);

    // ACTION: List active sessions
    if (action === 'list') {
      const { data: sessions, error } = await supabaseClient
        .from(tableName)
        .select('*')
        .eq('user_id', user.id)
        .is('invalidated_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Optionally include active time entries
      if (includeTimeEntries && sessions && sessions.length > 0) {
        const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        
        const sessionsWithEntries = await Promise.all(
          sessions.map(async (session) => {
            const { data: timeEntry } = await supabaseClient
              .from('time_entries')
              .select('id, clock_in_time, clock_out_time, approval_status')
              .eq('user_id', user.id)
              .or(`clock_out_time.is.null,clock_out_time.gte.${cutoffTime}`)
              .order('clock_in_time', { ascending: false })
              .limit(1)
              .maybeSingle();
            
            return {
              ...session,
              active_time_entry: timeEntry || null
            };
          })
        );
        
        return new Response(
          JSON.stringify({ sessions: sessionsWithEntries }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ sessions: sessions || [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION: Logout single session
    if (action === 'logout-single' && sessionId) {
      const { error } = await supabaseClient
        .from(tableName)
        .update({
          invalidated_at: new Date().toISOString(),
          invalidation_reason: reason || 'user_requested_logout',
        })
        .eq('session_id', sessionId)
        .eq('user_id', user.id);

      if (error) throw error;

      console.log(`[manage-sessions] ${userRole} session invalidated:`, sessionId);

      return new Response(
        JSON.stringify({ success: true, message: 'Sesiune închisă cu succes' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ACTION: Logout all sessions
    if (action === 'logout-all') {
      const currentSessionId = excludeCurrentSession ? req.headers.get('X-Session-ID') : null;

      const { data, error } = await supabaseClient.rpc('invalidate_sessions_by_role', {
        _user_id: user.id,
        _role: userRole,
        _reason: reason || 'user_requested_logout_all',
        _exclude_session_id: currentSessionId
      });

      if (error) {
        console.error('[manage-sessions] RPC error:', error);
        throw error;
      }

      const invalidatedCount = data || 0;
      console.log(`[manage-sessions] ${invalidatedCount} ${userRole} session(s) invalidated for user:`, user.id);

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: invalidatedCount > 0 
            ? `Toate sesiunile au fost închise cu succes (${invalidatedCount})`
            : 'Nu au fost găsite sesiuni active de închis'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[manage-sessions] Unhandled error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
