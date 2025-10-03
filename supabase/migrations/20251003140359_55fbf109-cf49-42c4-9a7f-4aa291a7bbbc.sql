-- Security remediation migration
-- Fixes: CRITICAL profile exposure, face_verification_logs enumeration, time_entry_segments audit trail

-- 1. Remove overly permissive profile viewing policy
-- Only keeps: users view own profile + admins view all profiles
DROP POLICY IF EXISTS "Authenticated users can view all profiles" ON public.profiles;

-- 2. Replace face_verification_logs INSERT policy with stricter version
-- Prevents photo URL enumeration by restricting inserts to user_id owner or admin
DROP POLICY IF EXISTS "System can insert verification logs" ON public.face_verification_logs;

CREATE POLICY "Users can insert their own verification logs"
ON public.face_verification_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

-- 3. Add explicit INSERT policy for time_entry_segments
-- Prevents unauthorized segment manipulation (critical for payroll calculations)
-- Edge functions with service role will bypass this (as intended)
CREATE POLICY "Only admins can insert time entry segments"
ON public.time_entry_segments
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'));