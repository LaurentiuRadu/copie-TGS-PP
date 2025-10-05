-- Security Enhancement Phase 4: Biometric Consent & Session Management
-- Enforce biometric consent and implement session limits

-- ============================================================================
-- PART 1: Biometric Consent Enforcement
-- ============================================================================

-- Create function to check biometric consent before verification
CREATE OR REPLACE FUNCTION public.enforce_biometric_consent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _has_consent BOOLEAN;
BEGIN
  -- Check if user has given biometric consent
  SELECT COALESCE(
    (SELECT consent_given 
     FROM public.user_consents 
     WHERE user_id = NEW.user_id 
       AND consent_type = 'biometric_data'
       AND consent_withdrawn_date IS NULL
     ORDER BY consent_date DESC
     LIMIT 1),
    false
  ) INTO _has_consent;

  -- If no consent, block the verification
  IF NOT _has_consent THEN
    RAISE EXCEPTION 'Biometric verification blocked: User has not given biometric data consent'
      USING HINT = 'User must accept biometric data consent before face verification';
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on face_verification_logs
DROP TRIGGER IF EXISTS trigger_enforce_biometric_consent ON public.face_verification_logs;
CREATE TRIGGER trigger_enforce_biometric_consent
  BEFORE INSERT ON public.face_verification_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_biometric_consent();

-- ============================================================================
-- PART 2: Session Management - Limits Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.session_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  max_concurrent_sessions INTEGER NOT NULL DEFAULT 3,
  auto_logout_oldest BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.session_limits ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage all session limits"
ON public.session_limits
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own session limits"
ON public.session_limits
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Add index
CREATE INDEX IF NOT EXISTS idx_session_limits_user_id ON public.session_limits(user_id);

-- ============================================================================
-- PART 3: Session Management - Limit Enforcement Function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_session_limit(_user_id UUID, _session_id TEXT, _device_fingerprint TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _limit_config RECORD;
  _active_count INTEGER;
  _oldest_session RECORD;
  _result JSONB;
BEGIN
  -- Get user's session limit configuration (or use default)
  SELECT max_concurrent_sessions, auto_logout_oldest
  INTO _limit_config
  FROM public.session_limits
  WHERE user_id = _user_id;

  -- If no custom limit, use default of 3 sessions
  IF NOT FOUND THEN
    _limit_config.max_concurrent_sessions := 3;
    _limit_config.auto_logout_oldest := true;
  END IF;

  -- Count active sessions (excluding current one)
  SELECT COUNT(*)
  INTO _active_count
  FROM public.active_sessions
  WHERE user_id = _user_id
    AND session_id != _session_id
    AND invalidated_at IS NULL
    AND expires_at > now();

  -- If at limit, handle based on config
  IF _active_count >= _limit_config.max_concurrent_sessions THEN
    IF _limit_config.auto_logout_oldest THEN
      -- Auto logout oldest session
      SELECT id, session_id, device_fingerprint, created_at
      INTO _oldest_session
      FROM public.active_sessions
      WHERE user_id = _user_id
        AND session_id != _session_id
        AND invalidated_at IS NULL
      ORDER BY created_at ASC
      LIMIT 1;

      -- Invalidate oldest session
      UPDATE public.active_sessions
      SET invalidated_at = now(),
          invalidation_reason = 'session_limit_exceeded'
      WHERE id = _oldest_session.id;

      -- Log the action
      PERFORM public.log_sensitive_data_access(
        'session_limit_auto_logout',
        'active_session',
        _oldest_session.id,
        jsonb_build_object(
          'target_session', _oldest_session.session_id,
          'reason', 'max_concurrent_sessions_reached',
          'limit', _limit_config.max_concurrent_sessions
        )
      );

      RETURN jsonb_build_object(
        'allowed', true,
        'action', 'oldest_session_logged_out',
        'message', 'Cea mai veche sesiune a fost închisă automat'
      );
    ELSE
      -- Block new session
      RETURN jsonb_build_object(
        'allowed', false,
        'action', 'blocked',
        'message', format('Limită de %s sesiuni atinsă. Închide o sesiune existentă.', _limit_config.max_concurrent_sessions),
        'active_sessions', _active_count
      );
    END IF;
  END IF;

  -- Under limit, allow
  RETURN jsonb_build_object(
    'allowed', true,
    'action', 'none',
    'message', 'Session allowed',
    'active_sessions', _active_count,
    'limit', _limit_config.max_concurrent_sessions
  );
END;
$$;

-- ============================================================================
-- PART 4: Cleanup Function for Expired Sessions
-- ============================================================================

CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions_enhanced()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _deleted_count INTEGER;
BEGIN
  -- Delete expired or invalidated sessions
  DELETE FROM public.active_sessions
  WHERE (expires_at < now() OR invalidated_at IS NOT NULL)
    AND created_at < now() - INTERVAL '7 days'; -- Keep for 7 days for audit
  
  GET DIAGNOSTICS _deleted_count = ROW_COUNT;
  
  -- Log cleanup
  IF _deleted_count > 0 THEN
    PERFORM public.log_sensitive_data_access(
      'session_cleanup',
      'active_sessions',
      NULL,
      jsonb_build_object('deleted_count', _deleted_count)
    );
  END IF;
  
  RETURN _deleted_count;
END;
$$;

-- ============================================================================
-- Insert default session limits for existing users
-- ============================================================================

INSERT INTO public.session_limits (user_id, max_concurrent_sessions, auto_logout_oldest)
SELECT id, 3, true
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM public.session_limits WHERE user_id = auth.users.id
);