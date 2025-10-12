import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[Test Schedule Notifications] ✅ Starting simulation...');

    const { data: subscriptions, error: subsError } = await supabaseClient
      .from('push_subscriptions')
      .select('*');

    if (subsError) {
      console.error('[Test Schedule Notifications] ❌ Error fetching subscriptions:', subsError);
      throw subsError;
    }

    console.log(`[Test Schedule Notifications] 📊 Found ${subscriptions?.length || 0} subscriptions`);

    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = (dayOfWeek === 0 ? -6 : 1) - dayOfWeek;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + diff);
    weekStart.setHours(0, 0, 0, 0);

    let sentCount = 0;
    let failedCount = 0;
    const errors: string[] = [];
    const sentTo: Array<{ user_id: string; schedule: string }> = [];

    for (const subscription of subscriptions || []) {
      try {
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('full_name, username')
          .eq('id', subscription.user_id)
          .maybeSingle();

        const userName = profile?.full_name || profile?.username || 'Utilizator';

        const { data: schedules } = await supabaseClient
          .from('weekly_schedules')
          .select('*')
          .eq('user_id', subscription.user_id)
          .eq('week_start_date', weekStart.toISOString().split('T')[0]);

        let scheduleMessage = 'Nu ai programare pentru săptămâna aceasta.';
        
        if (schedules && schedules.length > 0) {
          scheduleMessage = `Programare săptămână:\n${schedules
            .map(s => `- ${['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'][s.day_of_week]}: ${s.team_id}`)
            .join('\n')}`;
        }

        console.log(`[Test Schedule Notifications] 📤 Simulating notification to ${userName}`);
        
        sentCount++;
        sentTo.push({ user_id: subscription.user_id, schedule: scheduleMessage });

      } catch (error: any) {
        console.error(`[Test Schedule Notifications] ❌ Failed for user ${subscription.user_id}:`, error);
        failedCount++;
        errors.push(`User ${subscription.user_id}: ${error.message}`);
      }
    }

    console.log(`[Test Schedule Notifications] ✅ Complete: ${sentCount} sent, ${failedCount} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        failed: failedCount,
        total: subscriptions?.length || 0,
        sentTo,
        errors: errors.length > 0 ? errors : undefined,
        message: `Simulare finalizată: ${sentCount} notificări trimise, ${failedCount} eșuate`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Test Schedule Notifications] ❌ Fatal error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
