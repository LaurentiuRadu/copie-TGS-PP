-- Actualizare funcții de cleanup și management sesiuni pentru admin_sessions/employee_sessions

-- 1. Actualizare cleanup_sensitive_data() pentru tabele separate
CREATE OR REPLACE FUNCTION public.cleanup_sensitive_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Șterge face verification logs mai vechi de 90 zile
  DELETE FROM public.face_verification_logs
  WHERE created_at < now() - interval '90 days';
  
  -- Anonimizează IP-uri mai vechi de 30 zile în audit logs
  UPDATE public.audit_logs
  SET ip_address = 'ANONYMIZED'
  WHERE created_at < now() - interval '30 days'
    AND ip_address != 'ANONYMIZED';
    
  -- Șterge admin sessions expirate mai vechi de 7 zile
  DELETE FROM public.admin_sessions
  WHERE (expires_at < now() OR invalidated_at IS NOT NULL)
    AND created_at < now() - interval '7 days';
    
  -- Șterge employee sessions expirate mai vechi de 7 zile
  DELETE FROM public.employee_sessions
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
$function$;

-- 2. Actualizare cleanup_expired_sessions_enhanced() pentru tabele separate
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions_enhanced()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _admin_deleted INTEGER;
  _employee_deleted INTEGER;
  _total_deleted INTEGER;
BEGIN
  -- Delete expired or invalidated admin sessions
  DELETE FROM public.admin_sessions
  WHERE (expires_at < now() OR invalidated_at IS NOT NULL)
    AND created_at < now() - INTERVAL '7 days';
  
  GET DIAGNOSTICS _admin_deleted = ROW_COUNT;
  
  -- Delete expired or invalidated employee sessions
  DELETE FROM public.employee_sessions
  WHERE (expires_at < now() OR invalidated_at IS NOT NULL)
    AND created_at < now() - INTERVAL '7 days';
  
  GET DIAGNOSTICS _employee_deleted = ROW_COUNT;
  
  _total_deleted := _admin_deleted + _employee_deleted;
  
  -- Log cleanup
  IF _total_deleted > 0 THEN
    PERFORM public.log_sensitive_data_access(
      'session_cleanup',
      'sessions',
      NULL,
      jsonb_build_object(
        'admin_deleted', _admin_deleted,
        'employee_deleted', _employee_deleted,
        'total_deleted', _total_deleted
      )
    );
  END IF;
  
  RETURN _total_deleted;
END;
$function$;

-- 3. Actualizare cleanup_old_sessions() pentru tabele separate
CREATE OR REPLACE FUNCTION public.cleanup_old_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  -- Șterge admin sessions mai vechi de 30 zile
  DELETE FROM public.admin_sessions
  WHERE last_activity < now() - INTERVAL '30 days';
  
  -- Șterge employee sessions mai vechi de 30 zile
  DELETE FROM public.employee_sessions
  WHERE last_activity < now() - INTERVAL '30 days';
END;
$function$;

-- 4. Actualizare cleanup_expired_sessions() pentru tabele separate
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _admin_deleted INTEGER;
  _employee_deleted INTEGER;
BEGIN
  -- Șterge admin sessions expirate
  DELETE FROM public.admin_sessions
  WHERE expires_at < now() OR invalidated_at IS NOT NULL;
  
  GET DIAGNOSTICS _admin_deleted = ROW_COUNT;
  
  -- Șterge employee sessions expirate
  DELETE FROM public.employee_sessions
  WHERE expires_at < now() OR invalidated_at IS NOT NULL;
  
  GET DIAGNOSTICS _employee_deleted = ROW_COUNT;
  
  RETURN _admin_deleted + _employee_deleted;
END;
$function$;

-- 5. DEPRECATION: check_session_limit() - folosește în schimb get_active_sessions_count()
-- Această funcție rămâne pentru compatibilitate dar nu mai este recomandată
CREATE OR REPLACE FUNCTION public.check_session_limit(_user_id uuid, _session_id text, _device_fingerprint text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _is_admin BOOLEAN;
  _limit_config RECORD;
  _active_count INTEGER;
  _oldest_session RECORD;
  _result JSONB;
  _table_name TEXT;
BEGIN
  -- DEPRECATED: Această funcție va fi eliminată într-o versiune viitoare
  -- Folosește get_active_sessions_count() și invalidate_sessions_by_role() în schimb
  
  -- Verifică dacă user-ul este admin
  SELECT has_role(_user_id, 'admin'::app_role) INTO _is_admin;
  
  -- Determină tabela corectă
  _table_name := CASE WHEN _is_admin THEN 'admin_sessions' ELSE 'employee_sessions' END;

  -- Obține config limită (sau aplică default bazat pe rol)
  SELECT max_concurrent_sessions, auto_logout_oldest
  INTO _limit_config
  FROM public.session_limits
  WHERE user_id = _user_id;

  -- Dacă nu există configurație personalizată, aplică default-uri bazate pe rol
  IF NOT FOUND THEN
    IF _is_admin THEN
      _limit_config.max_concurrent_sessions := 4;
      _limit_config.auto_logout_oldest := true;
    ELSE
      _limit_config.max_concurrent_sessions := 1;
      _limit_config.auto_logout_oldest := true;
    END IF;
  END IF;

  -- Numără sesiunile active folosind funcția nouă
  _active_count := get_active_sessions_count(_user_id, CASE WHEN _is_admin THEN 'admin'::app_role ELSE 'employee'::app_role END);

  -- Dacă s-a atins limita, aplică politica de logout
  IF _active_count >= _limit_config.max_concurrent_sessions THEN
    IF _limit_config.auto_logout_oldest THEN
      -- Invalidează cea mai veche sesiune folosind funcția nouă
      PERFORM invalidate_sessions_by_role(
        _user_id, 
        CASE WHEN _is_admin THEN 'admin'::app_role ELSE 'employee'::app_role END,
        'session_limit_exceeded',
        _session_id
      );

      RETURN jsonb_build_object(
        'allowed', true,
        'action', 'oldest_session_logged_out',
        'message', 'Sesiunea anterioară a fost închisă automat'
      );
    ELSE
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
$function$;

-- 6. DEPRECATION: invalidate_user_sessions() - folosește invalidate_sessions_by_role() în schimb
CREATE OR REPLACE FUNCTION public.invalidate_user_sessions(_user_id uuid, _reason text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  _invalidated_count INTEGER;
  _is_admin BOOLEAN;
BEGIN
  -- DEPRECATED: Această funcție va fi eliminată într-o versiune viitoare
  -- Folosește invalidate_sessions_by_role() în schimb
  
  -- Determină rolul utilizatorului
  SELECT has_role(_user_id, 'admin'::app_role) INTO _is_admin;
  
  -- Folosește noua funcție bazată pe rol
  _invalidated_count := invalidate_sessions_by_role(
    _user_id,
    CASE WHEN _is_admin THEN 'admin'::app_role ELSE 'employee'::app_role END,
    _reason,
    NULL
  );
  
  RETURN _invalidated_count;
END;
$function$;

COMMENT ON FUNCTION public.check_session_limit IS 'DEPRECATED: Use get_active_sessions_count() and invalidate_sessions_by_role() instead';
COMMENT ON FUNCTION public.invalidate_user_sessions IS 'DEPRECATED: Use invalidate_sessions_by_role() instead';