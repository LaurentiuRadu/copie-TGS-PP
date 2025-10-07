-- ===================================================
-- EXTINDERE TRIGGER SCHIMBARE PAROLĂ
-- ===================================================

-- Actualizăm funcția trigger_invalidate_sessions_on_password_change 
-- să facă și update la password tracking
CREATE OR REPLACE FUNCTION public.trigger_invalidate_sessions_on_password_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.password_changed_at IS DISTINCT FROM OLD.password_changed_at THEN
    -- Invalidează sesiunile existente
    PERFORM public.invalidate_user_sessions(NEW.user_id, 'password_changed');
    
    -- Actualizează password tracking
    UPDATE public.user_password_tracking
    SET 
      is_default_password = false,
      must_change_password = false,
      password_changed_at = now()
    WHERE user_id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$;