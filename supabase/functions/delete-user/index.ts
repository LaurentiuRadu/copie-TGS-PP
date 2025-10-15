import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface DeleteUserRequest {
  userId: string
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

    const { userId } = await req.json() as DeleteUserRequest

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('Deleting user and associated data:', userId)

    // Șterge toate datele asociate utilizatorului înainte de a șterge user-ul
    // 1. Obține ID-urile time entries pentru user
    const { data: timeEntryIds } = await supabaseAdmin
      .from('time_entries')
      .select('id')
      .eq('user_id', userId)
    
    // 2. Șterge time entry segments
    if (timeEntryIds && timeEntryIds.length > 0) {
      const { error: segmentsError } = await supabaseAdmin
        .from('time_entry_segments')
        .delete()
        .in('time_entry_id', timeEntryIds.map(e => e.id))
      
      if (segmentsError) {
        console.log('Warning deleting segments:', segmentsError.message)
      }
    }

    // 4. Șterge time entries
    const { error: timeEntriesError } = await supabaseAdmin
      .from('time_entries')
      .delete()
      .eq('user_id', userId)
    
    if (timeEntriesError) {
      console.log('Warning deleting time entries:', timeEntriesError.message)
    }

    // 6. Șterge daily timesheets
    const { error: timesheetsError } = await supabaseAdmin
      .from('daily_timesheets')
      .delete()
      .eq('employee_id', userId)
    
    if (timesheetsError) {
      console.log('Warning deleting timesheets:', timesheetsError.message)
    }

    // 7. Șterge weekly schedules
    const { error: schedulesError } = await supabaseAdmin
      .from('weekly_schedules')
      .delete()
      .eq('user_id', userId)
    
    if (schedulesError) {
      console.log('Warning deleting schedules:', schedulesError.message)
    }

    // 5. Șterge vacation requests
    const { error: vacationError } = await supabaseAdmin
      .from('vacation_requests')
      .delete()
      .eq('user_id', userId)
    
    if (vacationError) {
      console.log('Warning deleting vacation requests:', vacationError.message)
    }

    // 6. Șterge vacation balances
    const { error: balanceError } = await supabaseAdmin
      .from('vacation_balances')
      .delete()
      .eq('user_id', userId)
    
    if (balanceError) {
      console.log('Warning deleting vacation balances:', balanceError.message)
    }

    // 7. Șterge correction requests
    const { error: correctionsError } = await supabaseAdmin
      .from('time_entry_correction_requests')
      .delete()
      .eq('user_id', userId)
    
    if (correctionsError) {
      console.log('Warning deleting correction requests:', correctionsError.message)
    }

    // 9. Șterge face verification logs
    const { error: faceLogsError } = await supabaseAdmin
      .from('face_verification_logs')
      .delete()
      .eq('user_id', userId)
    
    if (faceLogsError) {
      console.log('Warning deleting face verification logs:', faceLogsError.message)
    }

    // 10. Șterge user consents
    const { error: consentsError } = await supabaseAdmin
      .from('user_consents')
      .delete()
      .eq('user_id', userId)
    
    if (consentsError) {
      console.log('Warning deleting consents:', consentsError.message)
    }

    // 11. Șterge active sessions
    const { error: sessionsError } = await supabaseAdmin
      .from('active_sessions')
      .delete()
      .eq('user_id', userId)
    
    if (sessionsError) {
      console.log('Warning deleting sessions:', sessionsError.message)
    }

    // 12. Șterge notification settings
    const { error: notifError } = await supabaseAdmin
      .from('notification_settings')
      .delete()
      .eq('user_id', userId)
    
    if (notifError) {
      console.log('Warning deleting notification settings:', notifError.message)
    }

    // 13. Șterge password tracking
    const { error: passwordError } = await supabaseAdmin
      .from('user_password_tracking')
      .delete()
      .eq('user_id', userId)
    
    if (passwordError) {
      console.log('Warning deleting password tracking:', passwordError.message)
    }

    // Delete user from auth (this will cascade delete from profiles and user_roles due to foreign keys)
    const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

    if (deleteError) {
      console.error('Error deleting user from auth:', deleteError)
      return new Response(
        JSON.stringify({ error: deleteError.message }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('User and all associated data deleted successfully:', userId)

    return new Response(
      JSON.stringify({ success: true, message: 'User deleted successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error in delete-user:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
