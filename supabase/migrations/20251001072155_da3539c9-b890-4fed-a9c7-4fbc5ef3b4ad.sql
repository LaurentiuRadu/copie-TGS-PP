-- Create enum for work hour types
CREATE TYPE public.work_hour_type AS ENUM ('normal', 'night', 'saturday', 'sunday_holiday');

-- Create table for work hour rules
CREATE TABLE public.work_hour_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_type work_hour_type NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.work_hour_rules ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can view rules
CREATE POLICY "Anyone can view work hour rules"
ON public.work_hour_rules
FOR SELECT
USING (true);

-- Policy: Only admins can insert rules
CREATE POLICY "Admins can insert work hour rules"
ON public.work_hour_rules
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Policy: Only admins can update rules
CREATE POLICY "Admins can update work hour rules"
ON public.work_hour_rules
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Policy: Only admins can delete rules
CREATE POLICY "Admins can delete work hour rules"
ON public.work_hour_rules
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_work_hour_rules_updated_at
BEFORE UPDATE ON public.work_hour_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default rules
INSERT INTO public.work_hour_rules (rule_type, start_time, end_time, description) VALUES
('normal', '08:00:00', '20:00:00', 'Ore normale de lucru Luni-Vineri'),
('night', '20:00:00', '08:00:00', 'Ore de noapte'),
('saturday', '00:00:00', '23:59:59', 'Ore Sâmbătă'),
('sunday_holiday', '00:00:00', '23:59:59', 'Ore Duminică și Sărbători');