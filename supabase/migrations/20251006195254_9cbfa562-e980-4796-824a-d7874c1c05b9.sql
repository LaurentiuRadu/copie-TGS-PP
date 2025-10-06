-- Modifică funcția check_session_limit să folosească default 1 sesiune în loc de 3
CREATE OR REPLACE FUNCTION public.check_session_limit(_user_id uuid, _session_id text, _device_fingerprint text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- If no custom limit, use default of 1 session (changed from 3)
  IF NOT FOUND THEN
    _limit_config.max_concurrent_sessions := 1;
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
        'message', 'Sesiunea anterioară a fost închisă automat'
      );
    ELSE
      -- Block new session
      RETURN jsonb_build_object(
        'allowed', false,
        'action', 'blocked',
        'message', format('Limită de %s sesiuni atinsă. Închide sesiunea existentă.', _limit_config.max_concurrent_sessions),
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
$function$;

-- Actualizează toate sesiunile existente să permită doar 1 sesiune activă
UPDATE public.session_limits SET max_concurrent_sessions = 1, auto_logout_oldest = true;