-- Create daily_timesheets table for aggregated daily hours
CREATE TABLE public.daily_timesheets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  hours_regular NUMERIC(5,2) DEFAULT 0 CHECK (hours_regular >= 0),
  hours_night NUMERIC(5,2) DEFAULT 0 CHECK (hours_night >= 0),
  hours_saturday NUMERIC(5,2) DEFAULT 0 CHECK (hours_saturday >= 0),
  hours_sunday NUMERIC(5,2) DEFAULT 0 CHECK (hours_sunday >= 0),
  hours_holiday NUMERIC(5,2) DEFAULT 0 CHECK (hours_holiday >= 0),
  hours_passenger NUMERIC(5,2) DEFAULT 0 CHECK (hours_passenger >= 0),
  hours_driving NUMERIC(5,2) DEFAULT 0 CHECK (hours_driving >= 0),
  hours_equipment NUMERIC(5,2) DEFAULT 0 CHECK (hours_equipment >= 0),
  hours_leave NUMERIC(5,2) DEFAULT 0 CHECK (hours_leave >= 0),
  hours_medical_leave NUMERIC(5,2) DEFAULT 0 CHECK (hours_medical_leave >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT unique_employee_work_date UNIQUE(employee_id, work_date)
);

-- Enable RLS
ALTER TABLE public.daily_timesheets ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view all daily timesheets"
ON public.daily_timesheets
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own daily timesheets"
ON public.daily_timesheets
FOR SELECT
TO authenticated
USING (employee_id = auth.uid());

CREATE POLICY "Admins can insert daily timesheets"
ON public.daily_timesheets
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert daily timesheets"
ON public.daily_timesheets
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Admins can update daily timesheets"
ON public.daily_timesheets
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can update daily timesheets"
ON public.daily_timesheets
FOR UPDATE
TO authenticated
USING (true);

-- Add trigger for updated_at
CREATE TRIGGER update_daily_timesheets_updated_at
BEFORE UPDATE ON public.daily_timesheets
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_daily_timesheets_employee_date ON public.daily_timesheets(employee_id, work_date);
CREATE INDEX idx_daily_timesheets_work_date ON public.daily_timesheets(work_date);

-- Add realtime support
ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_timesheets;