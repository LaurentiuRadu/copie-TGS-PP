-- Fix RLS pentru notificări de programări
-- Service role trebuie să poată insera notificări create de trigger

-- Verifică dacă policy-ul există deja
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'schedule_notifications' 
    AND policyname = 'Service role can insert schedule notifications'
  ) THEN
    CREATE POLICY "Service role can insert schedule notifications"
      ON schedule_notifications FOR INSERT
      WITH CHECK (true);
  END IF;
END $$;

-- Adaugă logging în trigger pentru debugging
CREATE OR REPLACE FUNCTION public.notify_schedule_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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
  
  -- Log pentru debugging
  RAISE NOTICE '[Schedule Notification] Created: type=%, user=%, schedule=%', 
    _notification_type, NEW.user_id, NEW.id;
  
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