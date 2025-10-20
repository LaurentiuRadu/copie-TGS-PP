import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ResetRequest {
  email: string
  newPassword: string
  secretKey: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { email, newPassword, secretKey } = await req.json() as ResetRequest

    // Verifică token-ul secret (protecție minimă)
    const expectedSecret = 'EMERGENCY_RESET_TGS_2025'
    if (secretKey !== expectedSecret) {
      return new Response(
        JSON.stringify({ error: 'Invalid secret key' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Verifică că este exact email-ul permis
    if (email !== 'laurentiu.radu@tgservices.ro') {
      return new Response(
        JSON.stringify({ error: 'Unauthorized email' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Găsește utilizatorul
    const { data: users } = await supabaseAdmin.auth.admin.listUsers()
    const user = users.users.find(u => u.email === email)

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Resetează parola
    const { error } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    )

    if (error) {
      console.error('Error resetting password:', error)
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`✅ Password reset successful for ${email}`)

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Password reset successfully',
        email: email,
        note: 'Please delete this edge function immediately after use'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in emergency-reset-admin-password:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
