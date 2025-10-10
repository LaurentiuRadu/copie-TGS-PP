-- Modificare funcție check_session_limit pentru limite bazate pe rol
CREATE OR REPLACE FUNCTION public.check_session_limit(_user_id uuid, _session_id text, _device_fingerprint text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _is_admin BOOLEAN;
  _limit_config RECORD;
  _active_count INTEGER;
  _oldest_session RECORD;
  _result JSONB;
BEGIN
  -- Verifică dacă user-ul este admin
  SELECT has_role(_user_id, 'admin'::app_role) INTO _is_admin;

  -- Obține config limită (sau aplică default bazat pe rol)
  SELECT max_concurrent_sessions, auto_logout_oldest
  INTO _limit_config
  FROM public.session_limits
  WHERE user_id = _user_id;

  -- Dacă nu există configurație personalizată, aplică default-uri bazate pe rol
  IF NOT FOUND THEN
    IF _is_admin THEN
      _limit_config.max_concurrent_sessions := 3;  -- Admini: 3 dispozitive
      _limit_config.auto_logout_oldest := true;    -- Logout automat
    ELSE
      _limit_config.max_concurrent_sessions := 1;  -- Angajați: 1 dispozitiv
      _limit_config.auto_logout_oldest := true;    -- Logout automat
    END IF;
  END IF;

  -- Numără sesiunile active (exclude sesiunea curentă)
  SELECT COUNT(*)
  INTO _active_count
  FROM public.active_sessions
  WHERE user_id = _user_id
    AND session_id != _session_id
    AND invalidated_at IS NULL
    AND expires_at > now();

  -- Dacă s-a atins limita, aplică politica de logout
  IF _active_count >= _limit_config.max_concurrent_sessions THEN
    IF _limit_config.auto_logout_oldest THEN
      -- Selectează cea mai veche sesiune activă
      SELECT id, session_id, device_fingerprint, created_at
      INTO _oldest_session
      FROM public.active_sessions
      WHERE user_id = _user_id
        AND session_id != _session_id
        AND invalidated_at IS NULL
      ORDER BY created_at ASC
      LIMIT 1;

      -- Invalidează cea mai veche sesiune
      UPDATE public.active_sessions
      SET invalidated_at = now(),
          invalidation_reason = 'session_limit_exceeded'
      WHERE id = _oldest_session.id;

      -- Log acțiunea pentru audit
      PERFORM public.log_sensitive_data_access(
        'session_limit_auto_logout',
        'active_session',
        _oldest_session.id,
        jsonb_build_object(
          'target_session', _oldest_session.session_id,
          'reason', 'max_concurrent_sessions_reached',
          'limit', _limit_config.max_concurrent_sessions,
          'is_admin', _is_admin
        )
      );

      RETURN jsonb_build_object(
        'allowed', true,
        'action', 'oldest_session_logged_out',
        'message', 'Sesiunea anterioară a fost închisă automat'
      );
    ELSE
      -- Blocare (nu ar trebui să se ajungă aici cu configurația actuală)
      RETURN jsonb_build_object(
        'allowed', false,
        'action', 'blocked',
        'message', format('Limită de %s sesiuni atinsă. Închide o sesiune existentă.', _limit_config.max_concurrent_sessions),
        'active_sessions', _active_count
      );
    END IF;
  END IF;

  -- Sub limită: permite sesiunea
  RETURN jsonb_build_object(
    'allowed', true,
    'action', 'none',
    'message', 'Session allowed',
    'active_sessions', _active_count,
    'limit', _limit_config.max_concurrent_sessions
  );
END;
$$;

-- Șterge configurările personalizate existente pentru a lăsa funcția să aplice default-urile
DELETE FROM public.session_limits;