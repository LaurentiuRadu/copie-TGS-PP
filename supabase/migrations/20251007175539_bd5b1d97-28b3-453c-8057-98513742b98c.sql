-- ===================================================
-- REMEDIERE PROBLEME CRITICE DE SECURITATE (v2 - fără indecși temporali)
-- ===================================================

-- 1. FIX RATE_LIMIT_ATTEMPTS - Șterge politici periculoase cu "true"
DROP POLICY IF EXISTS "System can insert rate limit attempts" ON public.rate_limit_attempts;
DROP POLICY IF EXISTS "System can update rate limit attempts" ON public.rate_limit_attempts;
DROP POLICY IF EXISTS "System can delete rate limit attempts" ON public.rate_limit_attempts;

-- Adminii pot vedea, dar DOAR service role poate modifica
CREATE POLICY "Service role only can manage rate limits"
ON public.rate_limit_attempts
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 2. FIX SCHEDULE_NOTIFICATIONS - Șterge politica de insert cu "true"
DROP POLICY IF EXISTS "System can insert notifications" ON public.schedule_notifications;

-- DOAR service role și triggers pot insera notificări
CREATE POLICY "Service role only can insert notifications"
ON public.schedule_notifications
FOR INSERT
TO service_role
WITH CHECK (true);

-- 3. FIX USER_PASSWORD_TRACKING - Șterge politica de insert cu "true"
DROP POLICY IF EXISTS "System can insert password tracking" ON public.user_password_tracking;

-- DOAR service role poate insera tracking parole
CREATE POLICY "Service role only can insert password tracking"
ON public.user_password_tracking
FOR INSERT
TO service_role
WITH CHECK (true);

-- 4. FIX DAILY_TIMESHEETS - Șterge politici de insert/update cu "true"
DROP POLICY IF EXISTS "System can insert daily timesheets" ON public.daily_timesheets;
DROP POLICY IF EXISTS "System can update daily timesheets" ON public.daily_timesheets;

-- DOAR service role poate crea/modifica timesheets (din edge functions)
CREATE POLICY "Service role only can manage timesheets"
ON public.daily_timesheets
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- 5. FIX AUDIT_LOGS - Șterge politica de insert cu "true"
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

-- DOAR service role și funcții security definer pot insera audit logs
CREATE POLICY "Service role only can insert audit logs"
ON public.audit_logs
FOR INSERT
TO service_role
WITH CHECK (true);

-- 6. ACTIVARE LEAKED PASSWORD PROTECTION
-- Această setare se face prin Supabase config, dar o documentez aici
COMMENT ON TABLE public.user_password_tracking IS 
'SECURITY: Leaked password protection trebuie activată din Supabase Dashboard -> Authentication -> Policies';

-- 7. PROTECȚIE SUPLIMENTARĂ DATE BIOMETRICE
-- Adăugare comentariu de securitate pentru reference photos
COMMENT ON COLUMN public.profiles.reference_photo_url IS 
'SECURITY: Store in PRIVATE bucket with signed URLs. Never expose directly. Implement encryption at rest.';

COMMENT ON COLUMN public.profiles.photo_quality_score IS 
'SECURITY: Biometric quality data - consider encryption for GDPR compliance';

-- 8. PROTECȚIE GPS/LOCATION DATA
COMMENT ON COLUMN public.time_entries.clock_in_latitude IS 
'SECURITY: Sensitive location data - implement additional access controls and encryption';

COMMENT ON COLUMN public.time_entries.clock_in_longitude IS 
'SECURITY: Sensitive location data - implement additional access controls and encryption';

COMMENT ON COLUMN public.time_entries.clock_out_latitude IS 
'SECURITY: Sensitive location data - implement additional access controls and encryption';

COMMENT ON COLUMN public.time_entries.clock_out_longitude IS 
'SECURITY: Sensitive location data - implement additional access controls and encryption';

COMMENT ON COLUMN public.time_entries.ip_address IS 
'SECURITY: PII data - implement retention policy and anonymization';

-- 9. PROTECȚIE FACE VERIFICATION LOGS
COMMENT ON TABLE public.face_verification_logs IS 
'SECURITY: Implement automatic deletion of logs older than 90 days. Store photos in private bucket with time-limited URLs.';

-- 10. PROTECȚIE SESSION DATA
COMMENT ON COLUMN public.active_sessions.session_id IS 
'SECURITY: Hash session tokens. Never expose in logs or client-side code.';

COMMENT ON COLUMN public.active_sessions.device_fingerprint IS 
'SECURITY: Ensure device fingerprints are not reversible to actual device identifiers';

-- 11. INDECȘI PENTRU PERFORMANȚĂ CLEANUP (fără predicat temporal)
CREATE INDEX IF NOT EXISTS idx_face_verification_logs_created 
ON public.face_verification_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_audit_logs_created 
ON public.audit_logs(created_at);

CREATE INDEX IF NOT EXISTS idx_active_sessions_expires 
ON public.active_sessions(expires_at, created_at);

-- 12. FUNCȚIE CLEANUP AUTOMAT DATE SENSIBILE
CREATE OR REPLACE FUNCTION public.cleanup_sensitive_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Șterge face verification logs mai vechi de 90 zile
  DELETE FROM public.face_verification_logs
  WHERE created_at < now() - interval '90 days';
  
  -- Anonimizează IP-uri mai vechi de 30 zile în audit logs
  UPDATE public.audit_logs
  SET ip_address = 'ANONYMIZED'
  WHERE created_at < now() - interval '30 days'
    AND ip_address != 'ANONYMIZED';
    
  -- Șterge sesiuni expirate mai vechi de 7 zile
  DELETE FROM public.active_sessions
  WHERE (expires_at < now() OR invalidated_at IS NOT NULL)
    AND created_at < now() - interval '7 days';
    
  -- Log cleanup action
  PERFORM public.log_sensitive_data_access(
    'automated_data_cleanup',
    'system',
    NULL,
    jsonb_build_object('timestamp', now())
  );
END;
$$;