-- Create table for tracking active sessions (single device login)
CREATE TABLE IF NOT EXISTS public.active_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  session_id TEXT NOT NULL,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, device_fingerprint)
);

-- Enable RLS
ALTER TABLE public.active_sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own sessions
CREATE POLICY "Users can view their own sessions"
ON public.active_sessions
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Users can insert their own sessions
CREATE POLICY "Users can insert their own sessions"
ON public.active_sessions
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own sessions
CREATE POLICY "Users can update their own sessions"
ON public.active_sessions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Users can delete their own sessions
CREATE POLICY "Users can delete their own sessions"
ON public.active_sessions
FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX idx_active_sessions_user_id ON public.active_sessions(user_id);
CREATE INDEX idx_active_sessions_last_activity ON public.active_sessions(last_activity);

-- Function to clean up old sessions (older than 30 days)
CREATE OR REPLACE FUNCTION public.cleanup_old_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.active_sessions
  WHERE last_activity < now() - INTERVAL '30 days';
END;
$$;