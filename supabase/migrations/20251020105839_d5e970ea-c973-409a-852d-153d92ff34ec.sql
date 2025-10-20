-- CLEANUP FINAL: Ștergere tabel active_sessions și funcții deprecate

-- 1. Drop funcții deprecate
DROP FUNCTION IF EXISTS public.check_session_limit(uuid, text, text);
DROP FUNCTION IF EXISTS public.invalidate_user_sessions(uuid, text);

-- 2. Drop tabela veche active_sessions
DROP TABLE IF EXISTS public.active_sessions CASCADE;

-- 3. Drop tabel session_limits (nefolosit - limitele sunt hard-coded în funcții)
DROP TABLE IF EXISTS public.session_limits CASCADE;

-- 4. Adaugă indexuri pentru performanță pe noile tabele
CREATE INDEX IF NOT EXISTS idx_admin_sessions_user_active 
  ON public.admin_sessions(user_id, invalidated_at, expires_at) 
  WHERE invalidated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_employee_sessions_user_active 
  ON public.employee_sessions(user_id, invalidated_at, expires_at) 
  WHERE invalidated_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires 
  ON public.admin_sessions(expires_at, created_at);

CREATE INDEX IF NOT EXISTS idx_employee_sessions_expires 
  ON public.employee_sessions(expires_at, created_at);

-- 5. Adaugă comentarii pentru documentare
COMMENT ON TABLE public.admin_sessions IS 'Admin sessions with max 4 concurrent devices per user';
COMMENT ON TABLE public.employee_sessions IS 'Employee sessions with max 1 concurrent device per user (auto-logout oldest)';

COMMENT ON FUNCTION public.get_active_sessions_count IS 'Returns count of active sessions for a user based on their role (admin/employee)';
COMMENT ON FUNCTION public.invalidate_sessions_by_role IS 'Invalidates sessions for a user based on role, with optional session exclusion';
COMMENT ON FUNCTION public.cleanup_expired_sessions_by_role IS 'Scheduled cleanup of expired sessions from both admin and employee tables';