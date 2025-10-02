-- Funcție pentru crearea automată a notificărilor când se adaugă/modifică programări
CREATE OR REPLACE FUNCTION notify_schedule_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Inserează notificare pentru utilizatorul programat
  INSERT INTO public.schedule_notifications (user_id, schedule_id)
  VALUES (NEW.user_id, NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger pentru notificări automate la INSERT
CREATE TRIGGER schedule_insert_notification
  AFTER INSERT ON public.weekly_schedules
  FOR EACH ROW
  EXECUTE FUNCTION notify_schedule_change();

-- Trigger pentru notificări automate la UPDATE
CREATE TRIGGER schedule_update_notification
  AFTER UPDATE ON public.weekly_schedules
  FOR EACH ROW
  WHEN (OLD.* IS DISTINCT FROM NEW.*)
  EXECUTE FUNCTION notify_schedule_change();