-- ===================================================
-- CONFIGURARE TRIGGERS PENTRU TABELE CU RESTRICȚII SERVICE_ROLE
-- ===================================================

-- 1. TRIGGER pentru SCHEDULE_NOTIFICATIONS
-- Verificăm dacă trigger-ul există și îl atașăm la weekly_schedules
DROP TRIGGER IF EXISTS trigger_notify_schedule_change ON public.weekly_schedules;

CREATE TRIGGER trigger_notify_schedule_change
AFTER INSERT OR UPDATE ON public.weekly_schedules
FOR EACH ROW
EXECUTE FUNCTION public.notify_schedule_change();

-- 2. TRIGGER pentru USER_PASSWORD_TRACKING
-- Actualizează automat password tracking când parola se schimbă în profiles
-- (triggerul trigger_invalidate_sessions_on_password_change deja există și apelează invalidate_user_sessions)

-- Creăm trigger pentru actualizare automată password tracking
CREATE OR REPLACE FUNCTION public.update_password_tracking_on_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Când se detectează schimbare de parolă în auth, actualizează tracking
  UPDATE public.user_password_tracking
  SET 
    is_default_password = false,
    must_change_password = false,
    password_changed_at = now()
  WHERE user_id = NEW.user_id;
  
  RETURN NEW;
END;
$$;

-- Atașăm trigger la profiles când se modifică password_changed_at
-- (acest trigger se declanșează din trigger_invalidate_sessions_on_password_change)
DROP TRIGGER IF EXISTS trigger_update_password_tracking ON public.user_password_tracking;

-- 3. EDGE FUNCTION WRAPPER pentru AUDIT LOGS
-- Creăm o funcție publică care poate fi apelată de frontend pentru a loga erori
CREATE OR REPLACE FUNCTION public.log_client_error(
  _action text,
  _resource_type text,
  _resource_id uuid,
  _details jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    details,
    created_at
  ) VALUES (
    auth.uid(),
    _action,
    _resource_type,
    _resource_id,
    _details,
    now()
  );
END;
$$;

-- 4. GRANT EXECUTE pentru funcția publică (ca să poată fi apelată de frontend)
GRANT EXECUTE ON FUNCTION public.log_client_error TO authenticated;

-- 5. Comentarii de documentare
COMMENT ON FUNCTION public.log_client_error IS 
'Public function to allow authenticated users to log errors to audit_logs. Uses SECURITY DEFINER to bypass RLS.';

COMMENT ON FUNCTION public.update_password_tracking_on_change IS 
'Automatically updates password tracking when password is changed. Triggered by password change events.';