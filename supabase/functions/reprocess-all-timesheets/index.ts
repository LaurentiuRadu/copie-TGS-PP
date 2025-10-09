import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TimeEntry {
  id: string;
  user_id: string;
  clock_in_time: string;
  clock_out_time: string | null;
  notes: string | null;
}

// Funcția refactorizată apelează calculate-time-segments pentru fiecare entry

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { 
      mode = 'all',
      user_ids,
      entry_ids, 
      start_date,
      end_date,
      dry_run = false 
    } = await req.json();

    console.log(`[Reprocess All] Starting reprocess with mode: ${mode}`);

    // Fetch all finalized time entries based on mode
    let query = supabase
      .from('time_entries')
      .select('id, user_id, clock_in_time, clock_out_time, notes')
      .not('clock_out_time', 'is', null)
      .order('clock_in_time', { ascending: true });

    if (mode === 'selective' && user_ids && user_ids.length > 0) {
      query = query.in('user_id', user_ids);
    }
    
    if (entry_ids && entry_ids.length > 0) {
      query = query.in('id', entry_ids);
    }
    
    if (start_date) {
      query = query.gte('clock_in_time', start_date);
    }
    
    if (end_date) {
      query = query.lte('clock_out_time', end_date);
    }

    const { data: entries, error: fetchError } = await query;

    if (fetchError) {
      throw fetchError;
    }

    if (!entries || entries.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          mode,
          dry_run,
          processed: 0,
          message: 'No entries to reprocess'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Reprocess All] Found ${entries.length} entries to reprocess`);

    // If not dry run, delete existing daily_timesheets for the date range
    if (!dry_run) {
      const minDate = new Date(entries[0].clock_in_time).toISOString().split('T')[0];
      const maxDate = new Date(entries[entries.length - 1].clock_out_time!).toISOString().split('T')[0];
      
      let deleteQuery = supabase
        .from('daily_timesheets')
        .delete()
        .gte('work_date', minDate)
        .lte('work_date', maxDate);
      
      if (mode === 'selective' && user_ids && user_ids.length > 0) {
        deleteQuery = deleteQuery.in('employee_id', user_ids);
      }

      const { error: deleteError } = await deleteQuery;
      if (deleteError) {
        console.error('[Reprocess All] Error deleting existing timesheets:', deleteError);
      } else {
        console.log(`[Reprocess All] Deleted existing timesheets for ${minDate} to ${maxDate}`);
      }
    }

    // Process entries by calling calculate-time-segments for each
    const batchSize = 50;
    let processed = 0;
    let errors: string[] = [];

    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      console.log(`[Reprocess All] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(entries.length / batchSize)} (${batch.length} entries)`);

      await Promise.all(
        batch.map(async (entry) => {
          try {
            const { error: calcError } = await supabase.functions.invoke('calculate-time-segments', {
              body: {
                user_id: entry.user_id,
                time_entry_id: entry.id,
                clock_in_time: entry.clock_in_time,
                clock_out_time: entry.clock_out_time,
                notes: entry.notes,
              },
            });

            if (calcError) {
              console.error(`[Reprocess All] Error processing entry ${entry.id}:`, calcError);
              errors.push(`Entry ${entry.id}: ${calcError.message}`);
            } else {
              processed++;
            }
          } catch (err: any) {
            console.error(`[Reprocess All] Exception processing entry ${entry.id}:`, err);
            errors.push(`Entry ${entry.id}: ${err.message}`);
          }
        })
      );
    }

    console.log(`[Reprocess All] ✅ Completed: ${processed}/${entries.length} entries processed successfully`);

    return new Response(
      JSON.stringify({
        success: true,
        mode,
        dry_run,
        processed,
        total_entries: entries.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Reprocess All] Fatal error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
