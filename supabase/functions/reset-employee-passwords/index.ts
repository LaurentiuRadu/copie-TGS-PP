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

    // Fetch all employee user IDs
    const { data: roleRows, error: rolesError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id, role')
      .eq('role', 'employee')

    if (rolesError) {
      console.error('Error fetching employee roles:', rolesError)
      return new Response(
        JSON.stringify({ error: rolesError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Deduplicate user IDs
    const userIds = Array.from(new Set((roleRows || []).map((r: any) => r.user_id)))

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
        // Only reset for employee accounts created for time tracking
        if (!email.endsWith('@company.local')) {
          results.skipped += 1
          continue
        }

        const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
          password: targetPassword,
        })

        if (updateErr) {
          results.errors.push({ user_id: userId, error: updateErr.message })
          continue
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