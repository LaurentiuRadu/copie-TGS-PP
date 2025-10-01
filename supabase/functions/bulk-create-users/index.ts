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

    const defaultPassword = 'ChangeMe123!'

    for (const employee of employees) {
      try {
        // Create user in auth.users
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: `${employee.username}@company.local`,
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

        // Add employee role
        const { error: employeeRoleError } = await supabaseAdmin
          .from('user_roles')
          .insert({
            user_id: authData.user.id,
            role: 'employee'
          })

        if (employeeRoleError) {
          console.error(`Error adding employee role for ${employee.username}:`, employeeRoleError)
        }

        // Add admin role if applicable
        if (employee.isAdmin) {
          const { error: adminRoleError } = await supabaseAdmin
            .from('user_roles')
            .insert({
              user_id: authData.user.id,
              role: 'admin'
            })

          if (adminRoleError) {
            console.error(`Error adding admin role for ${employee.username}:`, adminRoleError)
          }
        }

        results.success.push(employee.username)
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
