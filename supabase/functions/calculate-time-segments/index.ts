import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TimeSegment {
  segment_type: string;
  start_time: string;
  end_time: string;
  hours_decimal: number;
  multiplier: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { time_entry_id, clock_in_time, clock_out_time } = await req.json();

    console.log('Calculating segments for:', { time_entry_id, clock_in_time, clock_out_time });

    // Fetch holidays
    const { data: holidays } = await supabase
      .from('holidays')
      .select('date');
    
    const holidayDates = new Set((holidays || []).map(h => h.date));

    // Parse times
    const start = new Date(clock_in_time);
    const end = new Date(clock_out_time);
    
    const segments: TimeSegment[] = [];
    let current = new Date(start);

    while (current < end) {
      const dayOfWeek = current.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
      const dateStr = current.toISOString().split('T')[0];
      const isHoliday = holidayDates.has(dateStr);
      const isSaturday = dayOfWeek === 6;
      const isSunday = dayOfWeek === 0;
      
      // Define day/night boundaries
      const nightStart = new Date(current);
      nightStart.setHours(22, 0, 0, 0);
      
      const nextDayStart = new Date(current);
      nextDayStart.setDate(nextDayStart.getDate() + 1);
      nextDayStart.setHours(0, 0, 0, 0);
      
      const nextDayMorning = new Date(nextDayStart);
      nextDayMorning.setHours(6, 0, 0, 0);
      
      // Find next transition point
      const transitions = [nightStart, nextDayStart, nextDayMorning, end]
        .filter(t => t > current)
        .sort((a, b) => a.getTime() - b.getTime());
      
      const segmentEnd = transitions[0];
      
      // Determine segment type
      let segmentType = 'normal_day';
      let multiplier = 1.0;
      
      const hour = current.getHours();
      const isNight = hour >= 22 || hour < 6;
      
      if (isHoliday) {
        segmentType = isNight ? 'holiday_night' : 'holiday_day';
        multiplier = 2.0; // 100% spor
      } else if (isSunday) {
        segmentType = isNight ? 'weekend_sunday_night' : 'weekend_sunday_day';
        multiplier = 2.0; // 100% spor
      } else if (isSaturday) {
        segmentType = isNight ? 'weekend_saturday_night' : 'weekend_saturday_day';
        multiplier = 1.5; // 50% spor
      } else {
        segmentType = isNight ? 'normal_night' : 'normal_day';
        multiplier = isNight ? 1.25 : 1.0; // 25% spor pentru noapte
      }
      
      const hours = (segmentEnd.getTime() - current.getTime()) / (1000 * 60 * 60);
      
      segments.push({
        segment_type: segmentType,
        start_time: current.toISOString(),
        end_time: segmentEnd.toISOString(),
        hours_decimal: Math.round(hours * 100) / 100,
        multiplier
      });
      
      current = new Date(segmentEnd);
    }

    // Save segments to database
    const segmentsWithEntryId = segments.map(s => ({
      ...s,
      time_entry_id
    }));

    const { error: insertError } = await supabase
      .from('time_entry_segments')
      .insert(segmentsWithEntryId);

    if (insertError) {
      console.error('Error inserting segments:', insertError);
      throw insertError;
    }

    console.log('Created segments:', segments.length);

    return new Response(
      JSON.stringify({ success: true, segments }),
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