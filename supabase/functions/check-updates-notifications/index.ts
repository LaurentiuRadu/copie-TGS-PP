import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UpdateNotification {
  user_id: string;
  type: 'schedule' | 'timesheet' | 'general';
  message: string;
  data?: any;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("VITE_SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get timestamp from 3 hours ago
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();
    
    const notifications: UpdateNotification[] = [];

    // 1. Check for new/updated schedules
    const { data: schedules, error: schedError } = await supabase
      .from('weekly_schedules')
      .select('*, users!inner(id)')
      .gte('created_at', threeHoursAgo)
      .order('created_at', { ascending: false });

    if (schedError) throw schedError;

    if (schedules && schedules.length > 0) {
      // Group by user
      const schedulesByUser = schedules.reduce((acc: any, schedule: any) => {
        const userId = schedule.user_id;
        if (!acc[userId]) acc[userId] = [];
        acc[userId].push(schedule);
        return acc;
      }, {});

      for (const [userId, userSchedules] of Object.entries(schedulesByUser)) {
        notifications.push({
          user_id: userId,
          type: 'schedule',
          message: `Ai ${(userSchedules as any[]).length} programări noi în ultimele 3 ore`,
          data: userSchedules
        });
      }
    }

    // 2. Check for new/updated time entries
    const { data: timeEntries, error: timeError } = await supabase
      .from('time_entries')
      .select('*')
      .gte('created_at', threeHoursAgo)
      .order('created_at', { ascending: false });

    if (timeError) throw timeError;

    if (timeEntries && timeEntries.length > 0) {
      // Group by user
      const entriesByUser = timeEntries.reduce((acc: any, entry: any) => {
        const userId = entry.user_id;
        if (!acc[userId]) acc[userId] = [];
        acc[userId].push(entry);
        return acc;
      }, {});

      for (const [userId, userEntries] of Object.entries(entriesByUser)) {
        notifications.push({
          user_id: userId,
          type: 'timesheet',
          message: `${(userEntries as any[]).length} pontaje noi în ultimele 3 ore`,
          data: userEntries
        });
      }
    }

    // 3. Send push notifications to users with updates
    for (const notification of notifications) {
      // Store notification in database for in-app display
      await supabase
        .from('push_notifications')
        .insert({
          user_id: notification.user_id,
          type: notification.type,
          title: notification.type === 'schedule' ? 'Program actualizat' : 'Pontaje noi',
          message: notification.message,
          data: notification.data,
          is_read: false
        });
    }

    return new Response(
      JSON.stringify({
        success: true,
        notifications_sent: notifications.length,
        details: notifications
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error checking updates:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
