-- Faza 1: Setup WhatsApp Notifications Infrastructure

-- 1.1 Adăugare coloane la profiles pentru WhatsApp
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS whatsapp_number TEXT,
ADD COLUMN IF NOT EXISTS whatsapp_notifications_enabled BOOLEAN DEFAULT false;

-- 1.2 Creare tabel notification_preferences
CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  whatsapp_enabled BOOLEAN DEFAULT false,
  quiet_hours_start TIME DEFAULT '22:00',
  quiet_hours_end TIME DEFAULT '08:00',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_preferences_whatsapp ON notification_preferences(whatsapp_enabled) WHERE whatsapp_enabled = true;

-- RLS Policies pentru notification_preferences
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own preferences"
  ON notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own preferences"
  ON notification_preferences FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own preferences"
  ON notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all preferences"
  ON notification_preferences FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 1.3 Creare tabel notification_delivery_logs pentru tracking
CREATE TABLE IF NOT EXISTS notification_delivery_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID REFERENCES schedule_notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('in_app', 'whatsapp')),
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed', 'skipped', 'pending')),
  error_message TEXT,
  message_content TEXT,
  sent_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  twilio_message_sid TEXT
);

CREATE INDEX IF NOT EXISTS idx_notification_delivery_logs_notification_id ON notification_delivery_logs(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_logs_user_id ON notification_delivery_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_logs_status ON notification_delivery_logs(status);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_logs_created ON notification_delivery_logs(sent_at DESC);

-- RLS Policies pentru notification_delivery_logs
ALTER TABLE notification_delivery_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all delivery logs"
  ON notification_delivery_logs FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own delivery logs"
  ON notification_delivery_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert logs"
  ON notification_delivery_logs FOR INSERT
  WITH CHECK (true);

-- 1.4 Actualizare trigger notify_schedule_change() pentru invocare edge function
CREATE OR REPLACE FUNCTION public.notify_schedule_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _notification_type TEXT;
  _previous_team TEXT;
  _request_id BIGINT;
BEGIN
  -- Detectează tipul de schimbare
  IF TG_OP = 'INSERT' THEN
    _notification_type := 'schedule_created';
    _previous_team := NULL;
  ELSIF TG_OP = 'UPDATE' AND OLD.team_id != NEW.team_id THEN
    _notification_type := 'team_reassignment';
    _previous_team := OLD.team_id;
  ELSIF TG_OP = 'UPDATE' THEN
    _notification_type := 'schedule_updated';
    _previous_team := NULL;
  ELSE
    _notification_type := 'schedule_created';
    _previous_team := NULL;
  END IF;

  -- Inserează sau actualizează notificarea IN-APP
  INSERT INTO public.schedule_notifications (
    user_id, schedule_id, created_at,
    notification_type, previous_team_id, metadata
  )
  VALUES (
    NEW.user_id, NEW.id, NOW(),
    _notification_type, _previous_team,
    jsonb_build_object(
      'new_team_id', NEW.team_id,
      'previous_team_id', _previous_team,
      'day_of_week', NEW.day_of_week,
      'week_start_date', NEW.week_start_date,
      'shift_type', NEW.shift_type,
      'location', NEW.location,
      'vehicle', NEW.vehicle,
      'activity', NEW.activity,
      'observations', NEW.observations
    )
  )
  ON CONFLICT (schedule_id, user_id) 
  DO UPDATE SET 
    created_at = NOW(),
    read_at = NULL,
    notification_type = EXCLUDED.notification_type,
    previous_team_id = EXCLUDED.previous_team_id,
    metadata = EXCLUDED.metadata;
  
  -- Invocare edge function pentru WhatsApp (asincron prin pg_net)
  BEGIN
    SELECT net.http_post(
      url := 'https://hbwkufaksipsqipqdqcv.supabase.co/functions/v1/send-whatsapp-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
      ),
      body := jsonb_build_object(
        'user_id', NEW.user_id::text,
        'schedule_id', NEW.id::text,
        'notification_type', _notification_type,
        'team_id', NEW.team_id,
        'previous_team_id', _previous_team,
        'day_of_week', NEW.day_of_week,
        'week_start_date', NEW.week_start_date::text,
        'shift_type', NEW.shift_type,
        'location', NEW.location,
        'vehicle', NEW.vehicle,
        'activity', NEW.activity,
        'observations', NEW.observations
      )
    ) INTO _request_id;
    
    RAISE NOTICE '[WhatsApp Trigger] Edge function invoked for user %, request_id: %', NEW.user_id, _request_id;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[WhatsApp Trigger] Failed to invoke edge function: %', SQLERRM;
  END;
  
  RETURN NEW;
END;
$$;