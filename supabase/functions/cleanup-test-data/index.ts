import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { user_id, work_date } = await req.json()

    console.log(`[Cleanup Test Data] Starting cleanup for user ${user_id} on ${work_date}`)

    // 1. Get time_entry IDs for this date
    const { data: timeEntries } = await supabase
      .from('time_entries')
      .select('id')
      .eq('user_id', user_id)
      .gte('clock_in_time', `${work_date}T00:00:00Z`)
      .lt('clock_in_time', `${work_date}T23:59:59Z`)

    const timeEntryIds = timeEntries?.map(e => e.id) || []

    // 2. Delete time_entry_segments for these entries
    if (timeEntryIds.length > 0) {
      const { error: segmentsError } = await supabase
        .from('time_entry_segments')
        .delete()
        .in('time_entry_id', timeEntryIds)

      if (segmentsError) {
        console.error('[Cleanup] Error deleting segments:', segmentsError)
      } else {
        console.log('[Cleanup] ✅ Deleted time_entry_segments')
      }
    }

    // 3. Delete time_entries for this date
    const { data: deletedEntries, error: entriesError } = await supabase
      .from('time_entries')
      .delete()
      .eq('user_id', user_id)
      .gte('clock_in_time', `${work_date}T00:00:00Z`)
      .lt('clock_in_time', `${work_date}T23:59:59Z`)
      .select()

    if (entriesError) {
      throw new Error(`Error deleting time_entries: ${entriesError.message}`)
    }

    console.log(`[Cleanup] ✅ Deleted ${deletedEntries?.length || 0} time_entries`)

    // 4. Reset daily_timesheets for this date
    const { error: timesheetError } = await supabase
      .from('daily_timesheets')
      .delete()
      .eq('employee_id', user_id)
      .eq('work_date', work_date)

    if (timesheetError) {
      console.error('[Cleanup] Error deleting timesheet:', timesheetError)
    } else {
      console.log('[Cleanup] ✅ Deleted daily_timesheet entry')
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Cleanup completed for ${work_date}`,
        deleted_entries: deletedEntries?.length || 0
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[Cleanup Test Data] Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
