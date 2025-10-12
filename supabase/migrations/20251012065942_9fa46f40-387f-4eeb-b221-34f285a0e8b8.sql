-- 1️⃣ Adăugare coloane noi în schedule_notifications
ALTER TABLE public.schedule_notifications 
ADD COLUMN IF NOT EXISTS notification_type TEXT DEFAULT 'schedule_created' 
  CHECK (notification_type IN ('schedule_created', 'schedule_updated', 'team_reassignment')),
ADD COLUMN IF NOT EXISTS previous_team_id TEXT,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- 2️⃣ Index-uri pentru performanță
CREATE INDEX IF NOT EXISTS idx_schedule_notifications_type 
ON public.schedule_notifications (notification_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_schedule_notifications_user_created 
ON public.schedule_notifications (user_id, created_at DESC);

-- 3️⃣ Actualizare trigger pentru detectare mutări
CREATE OR REPLACE FUNCTION public.notify_schedule_change()
RETURNS TRIGGER AS $$
DECLARE
  _notification_type TEXT;
  _previous_team TEXT;
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

  -- Inserează sau actualizează notificarea
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
      'location', NEW.location
    )
  )
  ON CONFLICT (schedule_id, user_id) 
  DO UPDATE SET 
    created_at = NOW(),
    read_at = NULL,
    notification_type = EXCLUDED.notification_type,
    previous_team_id = EXCLUDED.previous_team_id,
    metadata = EXCLUDED.metadata;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 4️⃣ RLS Policy pentru admini să vadă toate notificările
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'schedule_notifications' 
    AND policyname = 'Admins can view all schedule notifications'
  ) THEN
    CREATE POLICY "Admins can view all schedule notifications"
    ON public.schedule_notifications
    FOR SELECT
    TO authenticated
    USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;