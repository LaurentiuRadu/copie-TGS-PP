-- Tabel pentru înregistrarea întârzierilor
CREATE TABLE public.tardiness_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  time_entry_id UUID REFERENCES public.time_entries(id) ON DELETE CASCADE,
  scheduled_start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  actual_clock_in_time TIMESTAMP WITH TIME ZONE NOT NULL,
  delay_minutes INTEGER NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tardiness_reports ENABLE ROW LEVEL SECURITY;

-- Policies pentru tardiness_reports
CREATE POLICY "Users can view their own tardiness reports"
  ON public.tardiness_reports FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tardiness reports"
  ON public.tardiness_reports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all tardiness reports"
  ON public.tardiness_reports FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update tardiness reports"
  ON public.tardiness_reports FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

-- Trigger pentru updated_at
CREATE TRIGGER update_tardiness_reports_updated_at
  BEFORE UPDATE ON public.tardiness_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Tabel pentru configurarea notificărilor
CREATE TABLE public.notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  schedule_changes_enabled BOOLEAN DEFAULT true,
  clock_out_reminder_enabled BOOLEAN DEFAULT true,
  clock_out_reminder_hours INTEGER DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notification_settings ENABLE ROW LEVEL SECURITY;

-- Policies pentru notification_settings
CREATE POLICY "Users can view their own notification settings"
  ON public.notification_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own notification settings"
  ON public.notification_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification settings"
  ON public.notification_settings FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger pentru updated_at
CREATE TRIGGER update_notification_settings_updated_at
  BEFORE UPDATE ON public.notification_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();