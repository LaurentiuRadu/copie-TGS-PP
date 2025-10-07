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

    const { mode = 'missing_segments', limit = 100 } = await req.json();
    
    console.log(`[Reprocess] Mode: ${mode}, Limit: ${limit}`);

    let query = supabase
      .from('time_entries')
      .select('id, user_id, clock_in_time, clock_out_time, notes')
      .not('clock_out_time', 'is', null)
      .order('clock_out_time', { ascending: false })
      .limit(limit);

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
        .limit(limit * 2);  // Luăm mai multe pentru a filtra

      const missingSegments = (entriesWithoutSegments || [])
        .filter(e => !e.time_entry_segments || e.time_entry_segments.length === 0)
        .slice(0, limit)
        .map(({ time_entry_segments, ...rest }) => rest as TimeEntry);

      console.log(`[Reprocess] Found ${missingSegments.length} entries without segments`);
      
      return await processEntries(supabase, missingSegments);
      
    } else if (mode === 'needs_reprocessing') {
      // Procesează pontaje marcate pentru reprocesare
      query = query.eq('needs_reprocessing', true);
      
      const { data: entries, error } = await query;
      
      if (error) throw error;
      
      console.log(`[Reprocess] Found ${entries?.length || 0} entries marked for reprocessing`);
      
      return await processEntries(supabase, entries || []);
      
    } else if (mode === 'date_range') {
      // Procesează după interval de date
      const { start_date, end_date } = await req.json();
      
      query = query
        .gte('clock_out_time', start_date)
        .lte('clock_out_time', end_date);
      
      const { data: entries, error } = await query;
      
      if (error) throw error;
      
      console.log(`[Reprocess] Found ${entries?.length || 0} entries in date range`);
      
      return await processEntries(supabase, entries || []);
    }

    return new Response(
      JSON.stringify({ error: 'Invalid mode' }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
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
      const { data, error } = await supabase.functions.invoke('calculate-time-segments', {
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

  return new Response(
    JSON.stringify(results),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  );
}