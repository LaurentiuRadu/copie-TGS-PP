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

    const { mode = 'missing_segments', batch_size = 100 } = await req.json();
    
    console.log(`[Reprocess] Mode: ${mode}, Batch Size: ${batch_size}`);

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
        // Procesează după interval de date (nu suportă continuous, doar single batch)
        const { start_date, end_date } = await req.json();
        
        const { data: entries, error } = await supabase
          .from('time_entries')
          .select('id, user_id, clock_in_time, clock_out_time, notes')
          .not('clock_out_time', 'is', null)
          .gte('clock_out_time', start_date)
          .lte('clock_out_time', end_date)
          .order('clock_out_time', { ascending: false })
          .limit(batch_size);
        
        if (error) throw error;
        batch = entries || [];
        
        console.log(`[Reprocess] Batch ${batchNumber}: Found ${batch.length} entries in date range`);
        hasMore = false; // Date range nu continuă
        
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
      if (mode !== 'date_range') {
        hasMore = batch.length === batch_size;
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