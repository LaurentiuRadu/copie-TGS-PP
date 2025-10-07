-- Create enum for correction request types
CREATE TYPE public.correction_request_type AS ENUM (
  'forgot_clock_in',
  'forgot_clock_out',
  'wrong_time',
  'wrong_shift_type',
  'duplicate_entry',
  'other'
);

-- Create time_entry_correction_requests table
CREATE TABLE public.time_entry_correction_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  work_date DATE NOT NULL,
  request_type correction_request_type NOT NULL,
  description TEXT NOT NULL,
  current_entry_id UUID REFERENCES public.time_entries(id) ON DELETE SET NULL,
  proposed_clock_in TIMESTAMP WITH TIME ZONE,
  proposed_clock_out TIMESTAMP WITH TIME ZONE,
  proposed_shift_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_notes TEXT,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.time_entry_correction_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for Employees
CREATE POLICY "Users can insert their own correction requests"
  ON public.time_entry_correction_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own correction requests"
  ON public.time_entry_correction_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for Admins
CREATE POLICY "Admins can view all correction requests"
  ON public.time_entry_correction_requests
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update correction requests"
  ON public.time_entry_correction_requests
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_time_entry_correction_requests_updated_at
  BEFORE UPDATE ON public.time_entry_correction_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_correction_requests_user_status ON public.time_entry_correction_requests(user_id, status);
CREATE INDEX idx_correction_requests_status_created ON public.time_entry_correction_requests(status, created_at DESC);