-- Create vacation_requests table
CREATE TABLE IF NOT EXISTS public.vacation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  days_count INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('vacation', 'sick', 'unpaid', 'other')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reason TEXT,
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_by UUID REFERENCES auth.users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.vacation_requests ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own vacation requests"
ON public.vacation_requests FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all vacation requests"
ON public.vacation_requests FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can create their own vacation requests"
ON public.vacation_requests FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update vacation requests"
ON public.vacation_requests FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Create alerts table for admin notifications
CREATE TABLE IF NOT EXISTS public.security_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL CHECK (alert_type IN ('suspicious_location', 'rapid_movement', 'photo_mismatch', 'pattern_anomaly', 'device_change')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  time_entry_id UUID REFERENCES public.time_entries(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  details JSONB,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.security_alerts ENABLE ROW LEVEL SECURITY;

-- Only admins can see alerts
CREATE POLICY "Admins can view all security alerts"
ON public.security_alerts FOR SELECT
USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update security alerts"
ON public.security_alerts FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_vacation_requests_user_id ON public.vacation_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_vacation_requests_status ON public.vacation_requests(status);
CREATE INDEX IF NOT EXISTS idx_vacation_requests_dates ON public.vacation_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_security_alerts_user_id ON public.security_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_security_alerts_resolved ON public.security_alerts(resolved);
CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON public.security_alerts(severity);

-- Add trigger for vacation_requests updated_at
CREATE TRIGGER update_vacation_requests_updated_at
BEFORE UPDATE ON public.vacation_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();