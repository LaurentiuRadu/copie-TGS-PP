import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessVacationRequest {
  request_id: string;
  user_id: string;
  start_date: string;
  end_date: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const { request_id, user_id, start_date, end_date }: ProcessVacationRequest = await req.json();

    console.log(`[Process Vacation] Processing request ${request_id} for user ${user_id}`);
    console.log(`[Process Vacation] Date range: ${start_date} to ${end_date}`);

    // Parse dates
    const startDate = new Date(start_date);
    const endDate = new Date(end_date);

    // Generate all dates in range
    const dates: string[] = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      dates.push(currentDate.toISOString().split('T')[0]);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    console.log(`[Process Vacation] Processing ${dates.length} days`);

    // Upsert 8h hours_leave for each day
    const upsertPromises = dates.map(async (workDate) => {
      const { error } = await supabaseClient
        .from('daily_timesheets')
        .upsert({
          employee_id: user_id,
          work_date: workDate,
          hours_leave: 8.0,
          hours_regular: 0,
          hours_night: 0,
          hours_saturday: 0,
          hours_sunday: 0,
          hours_holiday: 0,
          hours_passenger: 0,
          hours_driving: 0,
          hours_equipment: 0,
          hours_medical_leave: 0,
        }, {
          onConflict: 'employee_id,work_date',
          ignoreDuplicates: false,
        });

      if (error) {
        console.error(`[Process Vacation] Error upserting ${workDate}:`, error);
        throw error;
      }

      return { date: workDate, success: true };
    });

    const results = await Promise.all(upsertPromises);
    
    console.log(`[Process Vacation] Successfully processed ${results.length} days`);

    return new Response(
      JSON.stringify({
        success: true,
        days_processed: results.length,
        dates: dates,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Process Vacation] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
