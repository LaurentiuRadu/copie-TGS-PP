-- Tabel pentru programările săptămânale
CREATE TABLE public.weekly_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id TEXT NOT NULL,
  week_start_date DATE NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 7),
  location TEXT,
  activity TEXT,
  vehicle TEXT,
  observations TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabel pentru notificările de programare
CREATE TABLE public.schedule_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  schedule_id UUID NOT NULL REFERENCES public.weekly_schedules(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(schedule_id, user_id)
);

-- Enable RLS
ALTER TABLE public.weekly_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies pentru weekly_schedules
CREATE POLICY "Admins can view all schedules"
  ON public.weekly_schedules FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own schedules"
  ON public.weekly_schedules FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can insert schedules"
  ON public.weekly_schedules FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update schedules"
  ON public.weekly_schedules FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete schedules"
  ON public.weekly_schedules FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policies pentru schedule_notifications
CREATE POLICY "Users can view their own notifications"
  ON public.schedule_notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications"
  ON public.schedule_notifications FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON public.schedule_notifications FOR INSERT
  WITH CHECK (true);

-- Trigger pentru updated_at
CREATE TRIGGER update_weekly_schedules_updated_at
  BEFORE UPDATE ON public.weekly_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime pentru notificări
ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_notifications;