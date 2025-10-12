import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScheduleData {
  team_id: string;
  shift_type: string;
  location: string;
  vehicle: string;
  activity: string;
  observations: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json();
    const { user_id } = payload;

    console.log(`[WhatsApp] Processing notification for user ${user_id}`);

    // 1️⃣ Verifică preferințele WhatsApp
    const { data: preferences } = await supabase
      .from('notification_preferences')
      .select('whatsapp_enabled, quiet_hours_start, quiet_hours_end')
      .eq('user_id', user_id)
      .maybeSingle();

    if (!preferences?.whatsapp_enabled) {
      console.log(`[WhatsApp] User ${user_id} has WhatsApp notifications disabled`);
      return new Response(JSON.stringify({ skipped: true, reason: 'whatsapp_disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 2️⃣ Verifică quiet hours
    const now = new Date();
    const romaniaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Europe/Bucharest' }));
    const currentTime = romaniaTime.toTimeString().slice(0, 5); // HH:MM
    
    if (preferences.quiet_hours_start && preferences.quiet_hours_end) {
      const quietStart = preferences.quiet_hours_start;
      const quietEnd = preferences.quiet_hours_end;
      
      // Verificare dacă suntem în intervalul quiet hours
      if (quietStart > quietEnd) {
        // Peste miezul nopții (ex: 22:00 - 08:00)
        if (currentTime >= quietStart || currentTime <= quietEnd) {
          console.log(`[WhatsApp] Quiet hours active for user ${user_id} at ${currentTime}`);
          await supabase.from('notification_delivery_logs').insert({
            user_id,
            channel: 'whatsapp',
            status: 'skipped',
            error_message: `Quiet hours active (${quietStart} - ${quietEnd})`
          });
          return new Response(JSON.stringify({ skipped: true, reason: 'quiet_hours' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      } else {
        // În aceeași zi (ex: 08:00 - 22:00)
        if (currentTime >= quietStart && currentTime <= quietEnd) {
          console.log(`[WhatsApp] Quiet hours active for user ${user_id} at ${currentTime}`);
          await supabase.from('notification_delivery_logs').insert({
            user_id,
            channel: 'whatsapp',
            status: 'skipped',
            error_message: `Quiet hours active (${quietStart} - ${quietEnd})`
          });
          return new Response(JSON.stringify({ skipped: true, reason: 'quiet_hours' }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }
      }
    }

    // 3️⃣ Obține numărul WhatsApp
    const { data: profile } = await supabase
      .from('profiles')
      .select('whatsapp_number, full_name')
      .eq('id', user_id)
      .maybeSingle();

    if (!profile?.whatsapp_number) {
      console.log(`[WhatsApp] No WhatsApp number for user ${user_id}`);
      await supabase.from('notification_delivery_logs').insert({
        user_id,
        channel: 'whatsapp',
        status: 'failed',
        error_message: 'No WhatsApp number configured'
      });
      return new Response(JSON.stringify({ error: 'no_whatsapp_number' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // 4️⃣ IMPORTANT: Agregare toate programările din ultima oră pentru același user
    // (pentru a trimite un singur mesaj dacă are multiple echipe în aceeași zi)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { data: recentNotifications } = await supabase
      .from('schedule_notifications')
      .select(`
        id,
        notification_type,
        previous_team_id,
        metadata,
        weekly_schedules!inner (
          team_id,
          day_of_week,
          week_start_date,
          shift_type,
          location,
          vehicle,
          activity,
          observations
        )
      `)
      .eq('user_id', user_id)
      .gte('created_at', oneHourAgo)
      .order('created_at', { ascending: false });

    if (!recentNotifications || recentNotifications.length === 0) {
      console.log(`[WhatsApp] No recent notifications for user ${user_id}`);
      return new Response(JSON.stringify({ skipped: true, reason: 'no_notifications' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`[WhatsApp] Found ${recentNotifications.length} recent notifications for user ${user_id}`);

    // Grupare notificări pe zi (week_start_date + day_of_week)
    const notificationsByDay = new Map<string, typeof recentNotifications>();
    
    for (const notif of recentNotifications) {
      const schedule = Array.isArray(notif.weekly_schedules) ? notif.weekly_schedules[0] : notif.weekly_schedules;
      if (!schedule) continue;
      
      const dayKey = `${schedule.week_start_date}_${schedule.day_of_week}`;
      
      if (!notificationsByDay.has(dayKey)) {
        notificationsByDay.set(dayKey, []);
      }
      notificationsByDay.get(dayKey)!.push(notif);
    }

    // 5️⃣ Format mesaje pentru fiecare zi
    const dayNames = ['Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă', 'Duminică'];
    const messages: string[] = [];
    const notificationIds: string[] = [];

    for (const [dayKey, dayNotifications] of notificationsByDay) {
      const firstSchedule = Array.isArray(dayNotifications[0].weekly_schedules) 
        ? dayNotifications[0].weekly_schedules[0] 
        : dayNotifications[0].weekly_schedules;
      if (!firstSchedule) continue;

      const dayName = dayNames[firstSchedule.day_of_week - 1];
      const date = new Date(firstSchedule.week_start_date);
      date.setDate(date.getDate() + firstSchedule.day_of_week - 1);
      const formattedDate = date.toLocaleDateString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric' });

      // Verifică dacă sunt toate programări noi sau mutări de echipă
      const hasReassignment = dayNotifications.some(n => n.notification_type === 'team_reassignment');
      const hasUpdate = dayNotifications.some(n => n.notification_type === 'schedule_updated');

      let message = '';

      if (dayNotifications.length === 1) {
        // Un singur mesaj pentru această zi
        const notif = dayNotifications[0];
        const schedule = Array.isArray(notif.weekly_schedules) ? notif.weekly_schedules[0] : notif.weekly_schedules;
        
        if (notif.notification_type === 'schedule_created') {
          message = `🗓️ *Programare Nouă*

Echipa: ${schedule.team_id}
Zi: ${dayName}, ${formattedDate}
Tură: ${schedule.shift_type} ${schedule.shift_type === 'noapte' ? '🌙' : '☀️'}

📍 Locație: ${schedule.location || 'Neatribuit'}
🚗 Vehicul: ${schedule.vehicle || 'Neatribuit'}
📋 Activitate: ${schedule.activity || 'Neatribuit'}

${schedule.observations ? `Observații: ${schedule.observations}` : ''}`;

        } else if (notif.notification_type === 'team_reassignment') {
          message = `⚠️ *Schimbare Echipă*

Din: Echipa ${notif.previous_team_id}
În: Echipa ${schedule.team_id}
Zi: ${dayName}, ${formattedDate}
Tură: ${schedule.shift_type} ${schedule.shift_type === 'noapte' ? '🌙' : '☀️'}

📍 Locație: ${schedule.location || 'Neatribuit'}`;

        } else if (notif.notification_type === 'schedule_updated') {
          message = `✏️ *Actualizare Programare*

Echipa: ${schedule.team_id}
Zi: ${dayName}, ${formattedDate}
Modificări: Programare actualizată

📱 Vezi detalii complete în aplicație → Notificări`;
        }
        
        notificationIds.push(notif.id);
      } else {
        // IMPORTANT: Multiple echipe în aceeași zi - AGREGARE
        message = `🗓️ *Programări pentru ${dayName}, ${formattedDate}*

Ești în echipele: ${dayNotifications.map(n => {
          const s = Array.isArray(n.weekly_schedules) ? n.weekly_schedules[0] : n.weekly_schedules;
          return s.team_id;
        }).join(', ')}

`;

        for (const notif of dayNotifications) {
          const schedule = Array.isArray(notif.weekly_schedules) ? notif.weekly_schedules[0] : notif.weekly_schedules;
          
          message += `✅ *Echipa ${schedule.team_id}* (${schedule.shift_type} ${schedule.shift_type === 'noapte' ? '🌙' : '☀️'})
📍 Locație: ${schedule.location || 'Neatribuit'}
🚗 Vehicul: ${schedule.vehicle || 'Neatribuit'}
📋 Activitate: ${schedule.activity || 'Neatribuit'}

`;
          
          notificationIds.push(notif.id);
        }

        if (hasReassignment) {
          message += `⚠️ *Atenție*: Au fost schimbări de echipă pentru această zi.\n`;
        }
        
        if (hasUpdate) {
          message += `✏️ *Modificări*: Unele programări au fost actualizate.\n`;
        }
        
        message += `📱 Vezi toate detaliile în aplicație → Notificări`;
      }

      messages.push(message);
    }

    // 6️⃣ Trimite mesaj/mesaje prin Twilio WhatsApp API
    const twilioAccountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const twilioAuthToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const twilioWhatsAppNumber = Deno.env.get('TWILIO_WHATSAPP_NUMBER');

    if (!twilioAccountSid || !twilioAuthToken || !twilioWhatsAppNumber) {
      console.error('[WhatsApp] Twilio credentials not configured');
      await supabase.from('notification_delivery_logs').insert({
        user_id,
        channel: 'whatsapp',
        status: 'failed',
        error_message: 'Twilio credentials missing'
      });
      return new Response(JSON.stringify({ error: 'twilio_not_configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
    const twilioAuth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

    // Trimite toate mesajele
    const results = [];
    for (const message of messages) {
      try {
        const response = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${twilioAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            From: twilioWhatsAppNumber,
            To: `whatsapp:${profile.whatsapp_number}`,
            Body: message,
          }),
        });

        const result = await response.json();

        if (response.ok) {
          console.log(`[WhatsApp] ✅ Message sent to ${profile.whatsapp_number}, SID: ${result.sid}`);
          
          // Log success pentru toate notificările din acest mesaj
          for (const notifId of notificationIds) {
            await supabase.from('notification_delivery_logs').insert({
              notification_id: notifId,
              user_id,
              channel: 'whatsapp',
              status: 'sent',
              message_content: message,
              twilio_message_sid: result.sid,
              delivered_at: new Date().toISOString()
            });
          }

          results.push({ success: true, message_sid: result.sid });
        } else {
          console.error(`[WhatsApp] ❌ Failed to send message: ${result.message}`);
          
          // Log failure
          for (const notifId of notificationIds) {
            await supabase.from('notification_delivery_logs').insert({
              notification_id: notifId,
              user_id,
              channel: 'whatsapp',
              status: 'failed',
              error_message: result.message,
              message_content: message
            });
          }

          results.push({ error: result.message });
        }
      } catch (error) {
        console.error(`[WhatsApp] Error sending message:`, error);
        results.push({ error: (error as Error).message });
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      messages_sent: messages.length,
      results 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[WhatsApp] Fatal error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
