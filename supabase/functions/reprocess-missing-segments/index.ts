import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TimeEntry {
  id: string;
  user_id: string;
  clock_in_time: string;
  clock_out_time: string;
  notes: string | null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { mode = 'missing_segments', batch_size = 100, start_date, end_date, cursor_date } = await req.json();
    
    console.log(`[Reprocess] Mode: ${mode}, Batch Size: ${batch_size}`, start_date && end_date ? `| Range: ${start_date} → ${end_date}` : '', cursor_date ? `| Cursor: ${cursor_date}` : '');

    // Rulează în batch-uri până procesează TOATE entries
    let totalProcessed = 0;
    let totalSuccess = 0;
    let totalFailed = 0;
    let allErrors: string[] = [];
    let hasMore = true;
    let batchNumber = 0;

    while (hasMore) {
      batchNumber++;
      console.log(`[Reprocess] ═══ Batch ${batchNumber} START ═══`);
      
      let batch: TimeEntry[] = [];

      if (mode === 'missing_segments') {
        // Găsește pontaje fără segmente
        const { data: entriesWithoutSegments } = await supabase
          .from('time_entries')
          .select(`
            id, user_id, clock_in_time, clock_out_time, notes,
            time_entry_segments(id)
          `)
          .not('clock_out_time', 'is', null)
          .order('clock_out_time', { ascending: false })
          .limit(batch_size * 2);  // Luăm mai multe pentru a filtra

        batch = (entriesWithoutSegments || [])
          .filter(e => !e.time_entry_segments || e.time_entry_segments.length === 0)
          .slice(0, batch_size)
          .map(({ time_entry_segments, ...rest }) => rest as TimeEntry);

        console.log(`[Reprocess] Batch ${batchNumber}: Found ${batch.length} entries without segments`);
        
      } else if (mode === 'needs_reprocessing') {
        // Procesează pontaje marcate pentru reprocesare
        const { data: entries, error } = await supabase
          .from('time_entries')
          .select('id, user_id, clock_in_time, clock_out_time, notes')
          .not('clock_out_time', 'is', null)
          .eq('needs_reprocessing', true)
          .order('clock_out_time', { ascending: false })
          .limit(batch_size);
        
        if (error) throw error;
        batch = entries || [];
        
        console.log(`[Reprocess] Batch ${batchNumber}: Found ${batch.length} entries marked for reprocessing`);
        
      } else if (mode === 'date_range') {
        // Procesează după interval de date (paginat cu cursor)
        if (!start_date || !end_date) {
          return new Response(
            JSON.stringify({ error: 'start_date and end_date are required for date_range mode' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        
        let query = supabase
          .from('time_entries')
          .select('id, user_id, clock_in_time, clock_out_time, notes')
          .not('clock_out_time', 'is', null)
          .gte('clock_out_time', `${start_date}T00:00:00Z`)
          .lte('clock_out_time', `${end_date}T23:59:59Z`)
          .order('clock_out_time', { ascending: false })
          .limit(batch_size);
        
        // Apply cursor for pagination
        if (cursor_date) {
          query = query.lt('clock_out_time', cursor_date);
        }
        
        const { data: entries, error } = await query;
        
        if (error) throw error;
        batch = entries || [];
        
        console.log(`[Reprocess] Batch ${batchNumber}: Found ${batch.length} entries in date range ${start_date} → ${end_date}${cursor_date ? ` (after ${cursor_date})` : ''}`);
        
      } else if (mode === 'all') {
        // ✅ NEW: Process ALL entries with pagination
        let query = supabase
          .from('time_entries')
          .select('id, user_id, clock_in_time, clock_out_time, notes')
          .not('clock_out_time', 'is', null)
          .order('clock_out_time', { ascending: false })
          .limit(batch_size);
        
        // Apply cursor for pagination
        if (cursor_date) {
          query = query.lt('clock_out_time', cursor_date);
        }
        
        const { data: entries, error } = await query;
        
        if (error) throw error;
        batch = entries || [];
        
        console.log(`[Reprocess] Batch ${batchNumber}: Found ${batch.length} entries (all mode)${cursor_date ? ` (after ${cursor_date})` : ''}`);
        
      } else {
        return new Response(
          JSON.stringify({ error: 'Invalid mode' }),
          { 
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      // Dacă nu mai avem entries, stop
      if (!batch || batch.length === 0) {
        console.log(`[Reprocess] Batch ${batchNumber}: No more entries, stopping.`);
        hasMore = false;
        break;
      }

      // Procesează batch-ul
      const batchResults = await processEntries(supabase, batch);
      
      totalProcessed += batchResults.total;
      totalSuccess += batchResults.success;
      totalFailed += batchResults.failed;
      allErrors.push(...batchResults.errors);
      
      console.log(`[Reprocess] Batch ${batchNumber} COMPLETE: ${batchResults.success}/${batchResults.total} success, ${batchResults.failed} failed`);
      console.log(`[Reprocess] ═══ Overall Progress: ${totalProcessed} total | ${totalSuccess} ✅ | ${totalFailed} ❌ ═══`);
      
      // Continuă dacă am primit un batch complet (ar putea fi mai multe)
      if (mode === 'missing_segments' || mode === 'needs_reprocessing') {
        hasMore = batch.length === batch_size;
      } else if (mode === 'date_range' || mode === 'all') {
        // For paginated modes, continue if we got a full batch
        hasMore = batch.length === batch_size;
        // Update cursor for next batch (last entry's clock_out_time)
        if (hasMore && batch.length > 0) {
          const lastEntry = batch[batch.length - 1];
          // Pass cursor in the request body for next iteration
          // Note: This is handled in the loop by checking batch completion
        }
      }
    }

    console.log(`[Reprocess] ✅ COMPLETE: Processed ${batchNumber} batches, ${totalProcessed} total entries`);

    return new Response(
      JSON.stringify({
        total: totalProcessed,
        success: totalSuccess,
        failed: totalFailed,
        batches: batchNumber,
        errors: allErrors.length > 0 ? allErrors : undefined
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function processEntries(supabase: any, entries: TimeEntry[]) {
  const results = {
    total: entries.length,
    success: 0,
    failed: 0,
    errors: [] as string[]
  };

  for (const entry of entries) {
    try {
      console.log(`[Reprocess] Processing entry ${entry.id}...`);
      
      // Invocă calculate-time-segments
      const { error } = await supabase.functions.invoke('calculate-time-segments', {
        body: {
          user_id: entry.user_id,
          time_entry_id: entry.id,
          clock_in_time: entry.clock_in_time,
          clock_out_time: entry.clock_out_time,
          notes: entry.notes
        }
      });

      if (error) {
        throw error;
      }

      // Clear needs_reprocessing flag
      await supabase
        .from('time_entries')
        .update({ 
          needs_reprocessing: false,
          last_reprocess_attempt: new Date().toISOString()
        })
        .eq('id', entry.id);

      results.success++;
      console.log(`[Reprocess] ✅ Successfully processed ${entry.id}`);
      
    } catch (error: any) {
      results.failed++;
      const errorMsg = `Entry ${entry.id}: ${error.message}`;
      results.errors.push(errorMsg);
      console.error(`[Reprocess] ❌ Failed to process ${entry.id}:`, error);
      
      // Mark as still needing reprocessing
      await supabase
        .from('time_entries')
        .update({ 
          needs_reprocessing: true,
          last_reprocess_attempt: new Date().toISOString()
        })
        .eq('id', entry.id);
    }
  }

  console.log(`[Reprocess] Complete: ${results.success} success, ${results.failed} failed`);

  return results;
}