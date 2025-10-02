import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Employee {
  fullName: string
  username: string
  isAdmin: boolean
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

    const { employees } = await req.json() as { employees: Employee[] }

    const results = {
      success: [] as string[],
      errors: [] as { username: string; error: string }[]
    }

    const defaultPassword = '123456'

    for (const employee of employees) {
      try {
        const email = `${employee.username}@company.local`
        
        // Check if user already exists
        const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers()
        const existingUser = existingUsers.users.find(u => u.email === email)

        if (existingUser) {
          // UPDATE existing user
          const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
            existingUser.id,
            {
              password: defaultPassword,
              user_metadata: {
                username: employee.username,
                full_name: employee.fullName
              }
            }
          )

          if (updateError) {
            results.errors.push({ username: employee.username, error: updateError.message })
            continue
          }

          // Delete old roles
          await supabaseAdmin
            .from('user_roles')
            .delete()
            .eq('user_id', existingUser.id)

          // Insert new roles
          const rolesToInsert = [{ user_id: existingUser.id, role: 'employee' }]
          if (employee.isAdmin) {
            rolesToInsert.push({ user_id: existingUser.id, role: 'admin' })
          }

          const { error: rolesError } = await supabaseAdmin
            .from('user_roles')
            .insert(rolesToInsert)

          if (rolesError) {
            console.error(`Error updating roles for ${employee.username}:`, rolesError)
          }

          results.success.push(`${employee.username} (updated)`)
        } else {
          // CREATE new user
          const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: defaultPassword,
            email_confirm: true,
            user_metadata: {
              username: employee.username,
              full_name: employee.fullName
            }
          })

          if (authError) {
            results.errors.push({ username: employee.username, error: authError.message })
            continue
          }

          // Add roles
          const rolesToInsert = [{ user_id: authData.user.id, role: 'employee' }]
          if (employee.isAdmin) {
            rolesToInsert.push({ user_id: authData.user.id, role: 'admin' })
          }

          const { error: rolesError } = await supabaseAdmin
            .from('user_roles')
            .insert(rolesToInsert)

          if (rolesError) {
            console.error(`Error adding roles for ${employee.username}:`, rolesError)
          }

          results.success.push(`${employee.username} (created)`)
        }
      } catch (error) {
        results.errors.push({ 
          username: employee.username, 
          error: error instanceof Error ? error.message : 'Unknown error' 
        })
      }
    }

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in bulk-create-users:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
