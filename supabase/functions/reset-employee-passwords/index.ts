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
        persistSession: false,
      },
    })

    const targetPassword = '123456'

    // Fetch ALL users (not just employees)
    const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers()

    if (usersError) {
      console.error('Error fetching users:', usersError)
      return new Response(
        JSON.stringify({ error: usersError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get all user IDs
    const userIds = (users || []).map((u: any) => u.id)

    const results = {
      updated: 0,
      skipped: 0,
      errors: [] as { user_id: string; error: string }[],
    }

    for (const userId of userIds) {
      try {
        const { data: userResp, error: getUserErr } = await supabaseAdmin.auth.admin.getUserById(userId)
        if (getUserErr) {
          results.errors.push({ user_id: userId, error: getUserErr.message })
          continue
        }

        const email = userResp.user?.email || ''
        
        // Reset ALL accounts to 123456
        // Also migrate old @employee.local accounts to @company.local
        const updates: any = { password: targetPassword }
        
        if (email.endsWith('@employee.local')) {
          const username = email.replace('@employee.local', '')
          updates.email = `${username}@company.local`
        }

        const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, updates)

        if (updateErr) {
          results.errors.push({ user_id: userId, error: updateErr.message })
          continue
        }

        // Update user_password_tracking
        const { error: trackingError } = await supabaseAdmin
          .from('user_password_tracking')
          .upsert({
            user_id: userId,
            is_default_password: true,
            must_change_password: true,
            password_changed_at: new Date().toISOString()
          }, {
            onConflict: 'user_id'
          })

        if (trackingError) {
          console.error('Error updating password tracking:', trackingError)
          // Don't fail the whole operation, just log
        }

        results.updated += 1
      } catch (err) {
        results.errors.push({ user_id: userId, error: err instanceof Error ? err.message : 'Unknown error' })
      }
    }

    return new Response(
      JSON.stringify({ count: results.updated, skipped: results.skipped, errors: results.errors }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in reset-employee-passwords:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})