-- Modificăm funcția notify_schedule_change pentru a evita duplicate key errors
-- Folosim INSERT ... ON CONFLICT pentru a actualiza notificarea existentă
CREATE OR REPLACE FUNCTION public.notify_schedule_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Inserează notificare sau actualizează-o dacă există deja
  INSERT INTO public.schedule_notifications (user_id, schedule_id, created_at)
  VALUES (NEW.user_id, NEW.id, NOW())
  ON CONFLICT (schedule_id, user_id) 
  DO UPDATE SET 
    created_at = NOW(),
    read_at = NULL;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;