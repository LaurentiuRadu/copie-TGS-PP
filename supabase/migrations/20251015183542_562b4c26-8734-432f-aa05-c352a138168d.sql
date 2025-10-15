-- Fix search_path vulnerability for all SECURITY DEFINER functions
-- This prevents search_path hijacking attacks

-- Critical priority functions (access to sensitive data)
ALTER FUNCTION public.log_sensitive_data_access(text, text, uuid, jsonb) 
SET search_path = public;

ALTER FUNCTION public.audit_location_access() 
SET search_path = public;

ALTER FUNCTION public.enforce_biometric_consent() 
SET search_path = public;

ALTER FUNCTION public.check_session_limit(uuid, text, text) 
SET search_path = public;

ALTER FUNCTION public.invalidate_user_sessions(uuid, text) 
SET search_path = public;

-- High priority functions (cleanup & maintenance)
ALTER FUNCTION public.cleanup_sensitive_data() 
SET search_path = public;

ALTER FUNCTION public.enforce_data_retention() 
SET search_path = public;

ALTER FUNCTION public.cleanup_expired_sessions_enhanced() 
SET search_path = public;

ALTER FUNCTION public.cleanup_old_sessions() 
SET search_path = public;

ALTER FUNCTION public.cleanup_expired_sessions() 
SET search_path = public;

-- Medium priority functions (business logic)
ALTER FUNCTION public.check_rate_limit(text, text) 
SET search_path = public;

ALTER FUNCTION public.auto_approve_old_entries() 
SET search_path = public;

ALTER FUNCTION public.set_current_version(uuid) 
SET search_path = public;

ALTER FUNCTION public.init_vacation_balance_2025(uuid, integer) 
SET search_path = public;

ALTER FUNCTION public.refresh_daily_stats() 
SET search_path = public;

ALTER FUNCTION public.get_team_discrepancies() 
SET search_path = public;

ALTER FUNCTION public.detect_team_discrepancies(text, date) 
SET search_path = public;

-- Trigger functions
ALTER FUNCTION public.update_password_tracking_on_change() 
SET search_path = public;

ALTER FUNCTION public.log_client_error(text, text, uuid, jsonb) 
SET search_path = public;

ALTER FUNCTION public.trigger_invalidate_sessions_on_password_change() 
SET search_path = public;

ALTER FUNCTION public.detect_rapid_movement() 
SET search_path = public;

ALTER FUNCTION public.detect_photo_mismatch() 
SET search_path = public;

ALTER FUNCTION public.detect_device_change() 
SET search_path = public;

ALTER FUNCTION public.update_vacation_balance_on_request_change() 
SET search_path = public;

ALTER FUNCTION public.notify_schedule_change() 
SET search_path = public;

ALTER FUNCTION public.invoke_calculate_segments() 
SET search_path = public;

ALTER FUNCTION public.validate_time_entry_duration() 
SET search_path = public;

ALTER FUNCTION public.prevent_user_approval_change() 
SET search_path = public;

ALTER FUNCTION public.detect_suspicious_location() 
SET search_path = public;

ALTER FUNCTION public.update_updated_at_column() 
SET search_path = public;

ALTER FUNCTION public.handle_new_user() 
SET search_path = public;