import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

interface UserProfile {
  full_name: string;
}

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
      rateLimitUnblocked: 0,
      emailsSent: 0,
      emailsFailed: 0,
      errors: [] as { user_id: string; error: string }[],
    }

    // First, clear ALL rate limiting entries for employees
    console.log('Clearing rate limiting entries for all employees...')
    const { error: rateLimitError } = await supabaseAdmin
      .from('rate_limit_attempts')
      .delete()
      .like('identifier', 'employee-%')

    if (rateLimitError) {
      console.error('Error clearing rate limits:', rateLimitError)
    } else {
      console.log('Rate limiting entries cleared successfully')
      results.rateLimitUnblocked = 1 // Flag that rate limits were cleared
    }

    for (const userId of userIds) {
      try {
        const { data: userResp, error: getUserErr } = await supabaseAdmin.auth.admin.getUserById(userId)
        if (getUserErr) {
          results.errors.push({ user_id: userId, error: getUserErr.message })
          continue
        }

        const email = userResp.user?.email || ''
        
        // Reset ALL employee accounts, regardless of domain
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

        // Mark password as default and must be changed
        const { error: trackingError } = await supabaseAdmin
          .from('user_password_tracking')
          .upsert(
            {
              user_id: userId,
              must_change_password: true,
              is_default_password: true,
              password_changed_at: new Date().toISOString(),
            },
            { onConflict: 'user_id' }
          )

        if (trackingError) {
          console.error('Error updating password tracking:', trackingError)
        }

        results.updated += 1

        // Send email notification
        try {
          // Get user profile for full name
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('full_name')
            .eq('id', userId)
            .single()

          const fullName = (profile as UserProfile)?.full_name || email.split('@')[0]
          const username = email.split('@')[0]

          // Call send-password-reset-email function
          const emailResult = await fetch(`${supabaseUrl}/functions/v1/send-password-reset-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              email: email,
              fullName: fullName,
              username: username,
              newPassword: targetPassword,
            }),
          })

          if (emailResult.ok) {
            results.emailsSent += 1
            console.log(`Email sent successfully to ${email}`)
          } else {
            results.emailsFailed += 1
            console.error(`Failed to send email to ${email}:`, await emailResult.text())
          }
        } catch (emailError) {
          results.emailsFailed += 1
          console.error(`Error sending email to ${email}:`, emailError)
        }
      } catch (err) {
        results.errors.push({ user_id: userId, error: err instanceof Error ? err.message : 'Unknown error' })
      }
    }

    return new Response(
      JSON.stringify({ 
        count: results.updated, 
        skipped: results.skipped, 
        rateLimitUnblocked: results.rateLimitUnblocked > 0,
        emailsSent: results.emailsSent,
        emailsFailed: results.emailsFailed,
        errors: results.errors 
      }),
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