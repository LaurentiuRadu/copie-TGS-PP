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

    // PAS 3: Trigger reprocessare pentru ultimul entry
    console.log('[Test] Invoking calculate-time-segments...');
    
    const { data, error } = await supabase.functions.invoke('calculate-time-segments', {
      body: {
        user_id: '444cfecc-fb2d-46f3-8050-0c762b308850',
        time_entry_id: 'c993fc70-7636-4758-8893-b7a2d90b9e18',
        clock_in_time: '2025-10-12T11:05:13.169+00:00',
        clock_out_time: '2025-10-12T11:09:06.604Z',
        notes: 'Tip: Normal',
        isIntermediateCalculation: false
      }
    });

    if (error) throw error;

    // PAS 4-5: Verificare
    const { data: segments } = await supabase
      .from('time_entry_segments')
      .select('segment_type, hours_decimal')
      .eq('time_entry_id', 'c993fc70-7636-4758-8893-b7a2d90b9e18');

    const { data: allSegments } = await supabase
      .from('time_entry_segments')
      .select('count');

    const { data: timesheets } = await supabase
      .from('daily_timesheets')
      .select('*')
      .eq('employee_id', '444cfecc-fb2d-46f3-8050-0c762b308850')
      .eq('work_date', '2025-10-12');

    return new Response(JSON.stringify({
      success: true,
      segments_for_entry: segments?.length || 0,
      total_segments: allSegments?.[0]?.count || 0,
      timesheets: timesheets?.[0] || null
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('[Test] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
