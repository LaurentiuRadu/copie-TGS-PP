import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    // Verify the requesting user is an admin
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

    // Check if user is admin
    const { data: roles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single()

    if (!roles) {
      return new Response(
        JSON.stringify({ error: 'Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get all users
    const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers()

    if (usersError) {
      console.error('Error fetching users:', usersError)
      return new Response(
        JSON.stringify({ error: usersError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get all user roles
    const { data: userRoles } = await supabaseAdmin
      .from('user_roles')
      .select('user_id, role')

    // Get profiles for names/usernames
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, username, full_name')

    const profileMap = new Map((profiles || []).map(p => [p.id, p]))

    // Combine user data with roles and profiles
    const usersWithRoles = users.map(u => {
      const profile = profileMap.get(u.id)
      return {
        id: u.id,
        email: u.email,
        username: (u.user_metadata?.username as string | undefined) || profile?.username || '',
        fullName: (u.user_metadata?.full_name as string | undefined) || profile?.full_name || '',
        roles: (userRoles || []).filter(r => r.user_id === u.id).map(r => r.role) || [],
        createdAt: u.created_at
      }
    })

    // Sortare alfabetică după fullName
    usersWithRoles.sort((a, b) => {
      const nameA = a.fullName.toLowerCase().trim()
      const nameB = b.fullName.toLowerCase().trim()
      return nameA.localeCompare(nameB, 'ro')
    })

    return new Response(
      JSON.stringify({ users: usersWithRoles }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in list-users:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
