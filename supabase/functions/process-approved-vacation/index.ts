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

    console.log(`[Process Vacation] ✅ Request received: ${request_id}`);
    console.log(`[Process Vacation] 👤 User: ${user_id}`);
    console.log(`[Process Vacation] 📅 Date range: ${start_date} → ${end_date}`);

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

    console.log(`[Process Vacation] 📊 Processing ${dates.length} days...`);

    // Upsert 8h hours_leave for each day with detailed logging
    let successCount = 0;
    let failureCount = 0;
    const processedDates: string[] = [];
    const failedDates: string[] = [];

    const upsertPromises = dates.map(async (workDate) => {
      try {
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
          console.error(`[Process Vacation] ❌ Failed ${workDate}:`, error.message);
          failureCount++;
          failedDates.push(workDate);
          throw error;
        }

        console.log(`[Process Vacation] ✅ Processed ${workDate} - 8h CO added`);
        successCount++;
        processedDates.push(workDate);
        return { date: workDate, success: true };
      } catch (error) {
        return { date: workDate, success: false, error };
      }
    });

    const results = await Promise.all(upsertPromises);
    
    console.log(`[Process Vacation] 📈 Summary: ${successCount} success, ${failureCount} failures`);
    if (processedDates.length > 0) {
      console.log(`[Process Vacation] ✅ Successfully processed dates:`, processedDates);
    }
    if (failedDates.length > 0) {
      console.error(`[Process Vacation] ❌ Failed dates:`, failedDates);
    }

    return new Response(
      JSON.stringify({
        success: successCount === dates.length,
        days_processed: successCount,
        days_failed: failureCount,
        total_days: dates.length,
        processed_dates: processedDates,
        failed_dates: failedDates,
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
