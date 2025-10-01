-- Create table for face verification logs
CREATE TABLE public.face_verification_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  time_entry_id uuid REFERENCES public.time_entries(id) ON DELETE SET NULL,
  verification_type text NOT NULL CHECK (verification_type IN ('enrollment', 'clock_in', 'clock_out')),
  photo_url text NOT NULL,
  quality_score numeric,
  match_score numeric,
  is_match boolean,
  is_quality_pass boolean,
  failure_reason text,
  created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.face_verification_logs ENABLE ROW LEVEL SECURITY;

-- Admins can view all verification logs
CREATE POLICY "Admins can view all verification logs"
ON public.face_verification_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Users can view their own verification logs
CREATE POLICY "Users can view their own verification logs"
ON public.face_verification_logs
FOR SELECT
USING (auth.uid() = user_id);

-- System can insert verification logs (for edge functions)
CREATE POLICY "System can insert verification logs"
ON public.face_verification_logs
FOR INSERT
WITH CHECK (true);

-- Create index for better performance
CREATE INDEX idx_face_verification_logs_user_id ON public.face_verification_logs(user_id);
CREATE INDEX idx_face_verification_logs_created_at ON public.face_verification_logs(created_at DESC);