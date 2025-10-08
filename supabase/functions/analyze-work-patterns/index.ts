import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PatternAnalysis {
  userId: string;
  avgClockInHour: number;
  avgClockOutHour: number;
  predominantLatitude: number;
  predominantLongitude: number;
  totalEntries: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[analyze-work-patterns] Starting pattern analysis...');

    // Get active users from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: recentEntries, error: entriesError } = await supabase
      .from('time_entries')
      .select('user_id, clock_in_time, clock_out_time, clock_in_latitude, clock_in_longitude')
      .gte('clock_in_time', thirtyDaysAgo.toISOString())
      .not('clock_out_time', 'is', null);

    if (entriesError) {
      console.error('[analyze-work-patterns] Error fetching entries:', entriesError);
      throw entriesError;
    }

    if (!recentEntries || recentEntries.length === 0) {
      console.log('[analyze-work-patterns] No entries found in last 30 days');
      return new Response(
        JSON.stringify({ message: 'No entries to analyze', alertsCreated: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Group by user
    const userEntries = new Map<string, typeof recentEntries>();
    recentEntries.forEach(entry => {
      if (!userEntries.has(entry.user_id)) {
        userEntries.set(entry.user_id, []);
      }
      userEntries.get(entry.user_id)!.push(entry);
    });

    console.log(`[analyze-work-patterns] Analyzing ${userEntries.size} users...`);

    let alertsCreated = 0;
    const analysisResults: PatternAnalysis[] = [];

    // Analyze each user
    for (const [userId, entries] of userEntries) {
      // Skip users with < 5 entries (insufficient data)
      if (entries.length < 5) {
        console.log(`[analyze-work-patterns] Skipping user ${userId} - only ${entries.length} entries`);
        continue;
      }

      // Calculate average clock-in hour
      const clockInHours = entries.map(e => {
        const date = new Date(e.clock_in_time);
        return date.getHours() + date.getMinutes() / 60;
      });
      const avgClockInHour = clockInHours.reduce((a, b) => a + b, 0) / clockInHours.length;

      // Calculate average clock-out hour
      const clockOutHours = entries
        .filter(e => e.clock_out_time)
        .map(e => {
          const date = new Date(e.clock_out_time!);
          return date.getHours() + date.getMinutes() / 60;
        });
      const avgClockOutHour = clockOutHours.length > 0
        ? clockOutHours.reduce((a, b) => a + b, 0) / clockOutHours.length
        : 0;

      // Find predominant location (most common lat/lng)
      const locations = entries
        .filter(e => e.clock_in_latitude && e.clock_in_longitude)
        .map(e => `${e.clock_in_latitude},${e.clock_in_longitude}`);
      
      const locationCounts = new Map<string, number>();
      locations.forEach(loc => {
        locationCounts.set(loc, (locationCounts.get(loc) || 0) + 1);
      });

      let predominantLocation = { lat: 0, lng: 0, count: 0 };
      if (locationCounts.size > 0) {
        const [mostCommonLoc, count] = Array.from(locationCounts.entries())
          .sort((a, b) => b[1] - a[1])[0];
        const [lat, lng] = mostCommonLoc.split(',').map(Number);
        predominantLocation = { lat, lng, count };
      }

      analysisResults.push({
        userId,
        avgClockInHour,
        avgClockOutHour,
        predominantLatitude: predominantLocation.lat,
        predominantLongitude: predominantLocation.lng,
        totalEntries: entries.length,
      });

      // Check for anomalies in recent entries (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentAnomalies = entries.filter(e => new Date(e.clock_in_time) >= sevenDaysAgo);

      for (const entry of recentAnomalies) {
        const clockInDate = new Date(entry.clock_in_time);
        const clockInHour = clockInDate.getHours() + clockInDate.getMinutes() / 60;

        // Check clock-in deviation (>3 hours)
        const clockInDeviation = Math.abs(clockInHour - avgClockInHour);
        if (clockInDeviation > 3) {
          // Check if alert already exists for this entry
          const { data: existingAlerts } = await supabase
            .from('security_alerts')
            .select('id')
            .eq('alert_type', 'pattern_anomaly')
            .eq('user_id', userId)
            .gte('created_at', sevenDaysAgo.toISOString())
            .contains('details', { pattern_type: 'clock_in_deviation' })
            .limit(1);

          if (!existingAlerts || existingAlerts.length === 0) {
            const { error: alertError } = await supabase
              .from('security_alerts')
              .insert({
                alert_type: 'pattern_anomaly',
                severity: clockInDeviation > 5 ? 'high' : 'medium',
                message: `Abatere semnificativă de la pattern-ul normal: pontaj la ${clockInDate.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })} (medie: ${Math.floor(avgClockInHour)}:${String(Math.round((avgClockInHour % 1) * 60)).padStart(2, '0')})`,
                user_id: userId,
                time_entry_id: null,
                details: {
                  pattern_type: 'clock_in_deviation',
                  average_clock_in: `${Math.floor(avgClockInHour)}:${String(Math.round((avgClockInHour % 1) * 60)).padStart(2, '0')}`,
                  actual_clock_in: clockInDate.toISOString(),
                  deviation_hours: Number(clockInDeviation.toFixed(2)),
                  analysis_period_days: 30,
                  total_entries_analyzed: entries.length,
                },
              });

            if (!alertError) {
              alertsCreated++;
              console.log(`[analyze-work-patterns] Created clock-in anomaly alert for user ${userId}`);
            } else {
              console.error(`[analyze-work-patterns] Error creating alert:`, alertError);
            }
          }
        }

        // Check clock-out deviation if available
        if (entry.clock_out_time) {
          const clockOutDate = new Date(entry.clock_out_time);
          const clockOutHour = clockOutDate.getHours() + clockOutDate.getMinutes() / 60;
          const clockOutDeviation = Math.abs(clockOutHour - avgClockOutHour);

          if (clockOutDeviation > 3 && avgClockOutHour > 0) {
            const { data: existingAlerts } = await supabase
              .from('security_alerts')
              .select('id')
              .eq('alert_type', 'pattern_anomaly')
              .eq('user_id', userId)
              .gte('created_at', sevenDaysAgo.toISOString())
              .contains('details', { pattern_type: 'clock_out_deviation' })
              .limit(1);

            if (!existingAlerts || existingAlerts.length === 0) {
              const { error: alertError } = await supabase
                .from('security_alerts')
                .insert({
                  alert_type: 'pattern_anomaly',
                  severity: 'low',
                  message: `Plecare neobișnuită: clock-out la ${clockOutDate.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' })} (medie: ${Math.floor(avgClockOutHour)}:${String(Math.round((avgClockOutHour % 1) * 60)).padStart(2, '0')})`,
                  user_id: userId,
                  time_entry_id: null,
                  details: {
                    pattern_type: 'clock_out_deviation',
                    average_clock_out: `${Math.floor(avgClockOutHour)}:${String(Math.round((avgClockOutHour % 1) * 60)).padStart(2, '0')}`,
                    actual_clock_out: clockOutDate.toISOString(),
                    deviation_hours: Number(clockOutDeviation.toFixed(2)),
                    analysis_period_days: 30,
                  },
                });

              if (!alertError) {
                alertsCreated++;
                console.log(`[analyze-work-patterns] Created clock-out anomaly alert for user ${userId}`);
              }
            }
          }
        }

        // Check location deviation (only if we have a predominant location)
        if (predominantLocation.count > 0 && entry.clock_in_latitude && entry.clock_in_longitude) {
          // Calculate distance from predominant location (Haversine formula)
          const R = 6371000; // Earth radius in meters
          const lat1 = predominantLocation.lat * Math.PI / 180;
          const lat2 = entry.clock_in_latitude * Math.PI / 180;
          const deltaLat = (entry.clock_in_latitude - predominantLocation.lat) * Math.PI / 180;
          const deltaLng = (entry.clock_in_longitude - predominantLocation.lng) * Math.PI / 180;

          const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
                   Math.cos(lat1) * Math.cos(lat2) *
                   Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distance = R * c;

          // Alert if > 5km from predominant location (and predominant location is used in >70% of entries)
          const locationFrequency = predominantLocation.count / entries.length;
          if (distance > 5000 && locationFrequency > 0.7) {
            const { data: existingAlerts } = await supabase
              .from('security_alerts')
              .select('id')
              .eq('alert_type', 'pattern_anomaly')
              .eq('user_id', userId)
              .gte('created_at', sevenDaysAgo.toISOString())
              .contains('details', { pattern_type: 'location_deviation' })
              .limit(1);

            if (!existingAlerts || existingAlerts.length === 0) {
              const { error: alertError } = await supabase
                .from('security_alerts')
                .insert({
                  alert_type: 'pattern_anomaly',
                  severity: 'high',
                  message: `Pontaj din locație neobișnuită: ${(distance / 1000).toFixed(1)}km distanță față de locația uzuală`,
                  user_id: userId,
                  time_entry_id: null,
                  details: {
                    pattern_type: 'location_deviation',
                    predominant_location: {
                      latitude: predominantLocation.lat,
                      longitude: predominantLocation.lng,
                      frequency_percentage: Number((locationFrequency * 100).toFixed(1)),
                    },
                    actual_location: {
                      latitude: entry.clock_in_latitude,
                      longitude: entry.clock_in_longitude,
                    },
                    distance_km: Number((distance / 1000).toFixed(2)),
                  },
                });

              if (!alertError) {
                alertsCreated++;
                console.log(`[analyze-work-patterns] Created location anomaly alert for user ${userId}`);
              }
            }
          }
        }
      }
    }

    console.log(`[analyze-work-patterns] Analysis complete. Created ${alertsCreated} alerts for ${userEntries.size} users.`);

    return new Response(
      JSON.stringify({
        success: true,
        usersAnalyzed: userEntries.size,
        alertsCreated,
        analysisResults: analysisResults.slice(0, 5), // Return first 5 for debugging
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('[analyze-work-patterns] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
