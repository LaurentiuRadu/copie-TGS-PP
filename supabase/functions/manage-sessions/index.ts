import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface LogoutAllRequest {
  userId?: string; // Admin can logout other users
  excludeCurrentSession?: boolean;
  reason?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Verify the requesting user is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { action } = await req.json() as { action: string } & LogoutAllRequest

    // Handle different actions
    switch (action) {
      case 'list':
        return await handleListSessions(supabaseAdmin, user.id, corsHeaders)
      
      case 'logout-all':
        const logoutData = await req.json() as LogoutAllRequest
        return await handleLogoutAll(supabaseAdmin, user, logoutData, corsHeaders)
      
      case 'logout-single':
        const { sessionId } = await req.json() as { sessionId: string }
        return await handleLogoutSingle(supabaseAdmin, user.id, sessionId, corsHeaders)
      
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
  } catch (error) {
    console.error('Error in manage-sessions:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

async function handleListSessions(supabaseAdmin: any, userId: string, corsHeaders: any) {
  const { data: sessions, error } = await supabaseAdmin
    .from('active_sessions')
    .select('*')
    .eq('user_id', userId)
    .is('invalidated_at', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error listing sessions:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({ sessions }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handleLogoutAll(
  supabaseAdmin: any, 
  user: any, 
  request: LogoutAllRequest,
  corsHeaders: any
) {
  // Check if user is admin for cross-user logout
  const { data: roles } = await supabaseAdmin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .single()

  const isAdmin = !!roles
  const targetUserId = request.userId && isAdmin ? request.userId : user.id

  // Get current session to exclude if requested
  let currentSessionId: string | null = null
  if (request.excludeCurrentSession) {
    const { data: currentSession } = await supabaseAdmin.auth.getSession()
    currentSessionId = currentSession?.session?.access_token || null
  }

  // Build query
  let query = supabaseAdmin
    .from('active_sessions')
    .update({
      invalidated_at: new Date().toISOString(),
      invalidation_reason: request.reason || 'user_requested_logout_all'
    })
    .eq('user_id', targetUserId)
    .is('invalidated_at', null)

  // Exclude current session if requested
  if (currentSessionId) {
    query = query.neq('session_id', currentSessionId)
  }

  const { data, error, count } = await query.select('*', { count: 'exact' })

  if (error) {
    console.error('Error invalidating sessions:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Log the action
  await supabaseAdmin.rpc('log_sensitive_data_access', {
    _action: 'logout_all_sessions',
    _resource_type: 'active_sessions',
    _resource_id: null,
    _details: {
      target_user_id: targetUserId,
      sessions_invalidated: count || 0,
      reason: request.reason || 'user_requested',
      excluded_current: request.excludeCurrentSession
    }
  })

  return new Response(
    JSON.stringify({ 
      success: true,
      message: `${count || 0} sesiuni au fost închise`,
      count: count || 0
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function handleLogoutSingle(
  supabaseAdmin: any,
  userId: string,
  sessionId: string,
  corsHeaders: any
) {
  const { data, error } = await supabaseAdmin
    .from('active_sessions')
    .update({
      invalidated_at: new Date().toISOString(),
      invalidation_reason: 'user_requested_logout_single'
    })
    .eq('user_id', userId)
    .eq('session_id', sessionId)
    .is('invalidated_at', null)
    .select()
    .single()

  if (error) {
    console.error('Error invalidating session:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({ success: true, message: 'Sesiune închisă cu succes' }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}
