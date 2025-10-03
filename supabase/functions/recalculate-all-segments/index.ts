import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting recalculation of all segments...');

    // Get all complete time entries without segments
    const { data: entries, error: entriesError } = await supabase
      .from('time_entries')
      .select('id, clock_in_time, clock_out_time')
      .not('clock_out_time', 'is', null);

    if (entriesError) {
      console.error('Error fetching entries:', entriesError);
      throw entriesError;
    }

    console.log(`Found ${entries?.length || 0} complete time entries`);

    const results = {
      total: entries?.length || 0,
      processed: 0,
      errors: [] as any[],
      success: [] as string[]
    };

    // Process each entry
    for (const entry of entries || []) {
      try {
        console.log(`Processing entry ${entry.id}...`);
        
        // Delete existing segments for this entry
        const { error: deleteError } = await supabase
          .from('time_entry_segments')
          .delete()
          .eq('time_entry_id', entry.id);

        if (deleteError) {
          console.error(`Error deleting segments for ${entry.id}:`, deleteError);
          throw deleteError;
        }

        // Call calculate-time-segments function
        const response = await fetch(`${supabaseUrl}/functions/v1/calculate-time-segments`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            time_entry_id: entry.id,
            clock_in_time: entry.clock_in_time,
            clock_out_time: entry.clock_out_time
          })
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${JSON.stringify(result)}`);
        }

        console.log(`✓ Successfully processed entry ${entry.id}`);
        results.processed++;
        results.success.push(entry.id);

      } catch (error: any) {
        console.error(`✗ Error processing entry ${entry.id}:`, error);
        results.errors.push({
          entry_id: entry.id,
          error: error.message || 'Unknown error'
        });
      }
    }

    console.log('Recalculation complete:', results);

    return new Response(
      JSON.stringify(results),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: results.errors.length > 0 ? 207 : 200 // 207 Multi-Status if some failed
      }
    );

  } catch (error) {
    console.error('Fatal error:', error);
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
