-- Atașează trigger pentru notificări automate la programări
DROP TRIGGER IF EXISTS on_schedule_change ON public.weekly_schedules;

CREATE TRIGGER on_schedule_change
  AFTER INSERT OR UPDATE ON public.weekly_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_schedule_change();