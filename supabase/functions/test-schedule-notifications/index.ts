import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushSubscription {
  user_id: string;
  subscription_data: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
}

interface WeeklySchedule {
  id: string;
  user_id: string;
  week_start_date: string;
  day_of_week: number;
  shift_type: string;
  team_id: string;
  activity: string | null;
  location: string | null;
  vehicle: string | null;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🧪 [Test Notifications] Starting test notification broadcast...');

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all push subscriptions
    const { data: subscriptions, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('*');

    if (subsError) {
      console.error('❌ [Test Notifications] Error fetching subscriptions:', subsError);
      throw subsError;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('⚠️ [Test Notifications] No push subscriptions found');
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Nu există subscripții active pentru notificări push',
          sent: 0 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    console.log(`📱 [Test Notifications] Found ${subscriptions.length} subscriptions`);

    // Get current week start (Monday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    const weekStart = monday.toISOString().split('T')[0];

    console.log(`📅 [Test Notifications] Current week start: ${weekStart}`);

    const results = {
      total: subscriptions.length,
      sent: 0,
      failed: 0,
      errors: [] as string[],
      users: [] as any[]
    };

    // Process each subscription
    for (const subscription of subscriptions as PushSubscription[]) {
      try {
        console.log(`👤 [Test Notifications] Processing user: ${subscription.user_id}`);

        // Get user profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, username')
          .eq('id', subscription.user_id)
          .single();

        const userName = profile?.full_name || profile?.username || 'Utilizator';

        // Get user's weekly schedule
        const { data: schedules, error: schedError } = await supabase
          .from('weekly_schedules')
          .select('*')
          .eq('user_id', subscription.user_id)
          .eq('week_start_date', weekStart)
          .order('day_of_week', { ascending: true });

        if (schedError) {
          console.error(`❌ [Test Notifications] Error fetching schedules for ${subscription.user_id}:`, schedError);
          results.errors.push(`User ${subscription.user_id}: ${schedError.message}`);
          results.failed++;
          continue;
        }

        const scheduleCount = schedules?.length || 0;
        console.log(`📋 [Test Notifications] User ${subscription.user_id} has ${scheduleCount} scheduled days`);

        // Prepare notification message
        const dayNames = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];
        let scheduleMessage = '';

        if (scheduleCount > 0) {
          const scheduleDays = schedules!.map((s: WeeklySchedule) => {
            const dayName = dayNames[s.day_of_week];
            const shift = s.shift_type === 'zi' ? '🌞 Zi' : '🌙 Noapte';
            const location = s.location ? ` - ${s.location}` : '';
            return `${dayName}: ${shift}${location}`;
          }).join('\n');
          
          scheduleMessage = `Programarea ta săptămânală:\n\n${scheduleDays}`;
        } else {
          scheduleMessage = `Nu ai programare în această săptămână (${weekStart}).`;
        }

        // Mock notification payload (în producție, aici s-ar folosi Web Push API)
        const notificationPayload = {
          title: '🧪 TEST - Programare Săptămânală',
          body: `Salut ${userName}! Acesta este un mesaj de test.`,
          data: {
            type: 'test_schedule_notification',
            scheduleCount,
            weekStart,
            scheduleMessage,
            timestamp: new Date().toISOString()
          },
          icon: '/icon-192.png',
          badge: '/icon-192.png',
          tag: 'test-schedule-notification',
          requireInteraction: true,
        };

        console.log(`📤 [Test Notifications] Simulating notification for ${userName}:`, {
          endpoint: subscription.subscription_data.endpoint.substring(0, 50) + '...',
          payload: notificationPayload
        });

        // Simulate sending (în producție, aici s-ar folosi web-push library)
        // const webPush = await import('npm:web-push@3.6.7');
        // await webPush.sendNotification(subscription.subscription_data, JSON.stringify(notificationPayload));

        results.sent++;
        results.users.push({
          user_id: subscription.user_id,
          name: userName,
          scheduleCount,
          weekStart,
          status: 'simulated_success'
        });

      } catch (error: any) {
        console.error(`❌ [Test Notifications] Error processing user ${subscription.user_id}:`, error);
        results.failed++;
        results.errors.push(`User ${subscription.user_id}: ${error.message}`);
      }
    }

    console.log('✅ [Test Notifications] Test completed:', results);

    return new Response(
      JSON.stringify({
        success: true,
        message: `✅ Simulare completă! Notificări trimise către ${results.sent} utilizatori.`,
        details: {
          total: results.total,
          sent: results.sent,
          failed: results.failed,
          errors: results.errors,
          users: results.users,
          note: '🧪 Aceasta este o simulare de test. În producție, notificările vor fi trimise real către dispozitive.',
          weekStart
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error: any) {
    console.error('❌ [Test Notifications] Fatal error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        details: error.stack
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
