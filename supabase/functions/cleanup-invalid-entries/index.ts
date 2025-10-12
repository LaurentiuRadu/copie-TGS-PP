import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CleanupRequest {
  user_id: string;
  start_date: string;
  end_date: string;
  min_duration_minutes?: number;
  dry_run?: boolean;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const {
      user_id,
      start_date,
      end_date,
      min_duration_minutes = 2,
      dry_run = false
    }: CleanupRequest = await req.json();

    console.log(`[Cleanup] Starting cleanup for user ${user_id}, date range: ${start_date} to ${end_date}`);
    console.log(`[Cleanup] Min duration: ${min_duration_minutes} minutes, dry_run: ${dry_run}`);

    // Fetch invalid entries
    const { data: invalidEntries, error: fetchError } = await supabase
      .from('time_entries')
      .select('id, clock_in_time, clock_out_time, user_id')
      .eq('user_id', user_id)
      .gte('clock_in_time', start_date)
      .lte('clock_in_time', end_date)
      .not('clock_out_time', 'is', null);

    if (fetchError) {
      throw new Error(`Failed to fetch entries: ${fetchError.message}`);
    }

    // Filter entries with duration < min_duration_minutes
    const entriesToDelete = invalidEntries.filter(entry => {
      const duration = (new Date(entry.clock_out_time).getTime() - new Date(entry.clock_in_time).getTime()) / 60000;
      return duration < min_duration_minutes;
    });

    console.log(`[Cleanup] Found ${entriesToDelete.length} entries < ${min_duration_minutes} minutes`);

    if (dry_run) {
      return new Response(
        JSON.stringify({
          success: true,
          dry_run: true,
          entries_to_delete: entriesToDelete.length,
          entries: entriesToDelete.map(e => ({
            id: e.id,
            clock_in: e.clock_in_time,
            clock_out: e.clock_out_time,
            duration_minutes: ((new Date(e.clock_out_time).getTime() - new Date(e.clock_in_time).getTime()) / 60000).toFixed(2)
          }))
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete invalid entries
    if (entriesToDelete.length > 0) {
      const idsToDelete = entriesToDelete.map(e => e.id);
      
      const { error: deleteError } = await supabase
        .from('time_entries')
        .delete()
        .in('id', idsToDelete);

      if (deleteError) {
        throw new Error(`Failed to delete entries: ${deleteError.message}`);
      }

      console.log(`[Cleanup] Successfully deleted ${idsToDelete.length} entries`);
    }

    // Trigger reprocessing
    console.log(`[Cleanup] Triggering reprocessing for user ${user_id}...`);
    
    const reprocessResponse = await supabase.functions.invoke('reprocess-all-timesheets', {
      body: {
        mode: 'user_ids',
        user_ids: [user_id],
        start_date,
        end_date,
        dry_run: false
      }
    });

    if (reprocessResponse.error) {
      console.error(`[Cleanup] Reprocessing failed:`, reprocessResponse.error);
      throw new Error(`Reprocessing failed: ${reprocessResponse.error.message}`);
    }

    console.log(`[Cleanup] ✅ Cleanup and reprocessing completed successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        deleted_entries: entriesToDelete.length,
        reprocessing_result: reprocessResponse.data
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Cleanup] Fatal error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
