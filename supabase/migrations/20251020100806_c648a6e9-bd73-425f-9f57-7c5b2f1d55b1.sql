-- ETAPA 1: Database Migration - Admin/Employee Session Separation (Fixed)

-- 1. Create admin_sessions table
CREATE TABLE IF NOT EXISTS public.admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL UNIQUE,
  device_fingerprint TEXT NOT NULL,
  device_info JSONB,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + INTERVAL '24 hours'),
  invalidated_at TIMESTAMP WITH TIME ZONE,
  invalidation_reason TEXT
);

-- 2. Create employee_sessions table
CREATE TABLE IF NOT EXISTS public.employee_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT NOT NULL UNIQUE,
  device_fingerprint TEXT NOT NULL,
  device_info JSONB,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + INTERVAL '24 hours'),
  invalidated_at TIMESTAMP WITH TIME ZONE,
  invalidation_reason TEXT
);

-- 3. Create indexes for performance
CREATE INDEX idx_admin_sessions_user_id ON public.admin_sessions(user_id);
CREATE INDEX idx_admin_sessions_session_id ON public.admin_sessions(session_id);
CREATE INDEX idx_admin_sessions_invalidated ON public.admin_sessions(invalidated_at) WHERE invalidated_at IS NULL;

CREATE INDEX idx_employee_sessions_user_id ON public.employee_sessions(user_id);
CREATE INDEX idx_employee_sessions_session_id ON public.employee_sessions(session_id);
CREATE INDEX idx_employee_sessions_invalidated ON public.employee_sessions(invalidated_at) WHERE invalidated_at IS NULL;

-- 4. Enable RLS
ALTER TABLE public.admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_sessions ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for admin_sessions
CREATE POLICY "Admins can view their own sessions"
  ON public.admin_sessions FOR SELECT
  USING (auth.uid() = user_id AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert their own sessions"
  ON public.admin_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update their own sessions"
  ON public.admin_sessions FOR UPDATE
  USING (auth.uid() = user_id AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete their own sessions"
  ON public.admin_sessions FOR DELETE
  USING (auth.uid() = user_id AND has_role(auth.uid(), 'admin'::app_role));

-- 6. RLS Policies for employee_sessions
CREATE POLICY "Employees can view their own sessions"
  ON public.employee_sessions FOR SELECT
  USING (auth.uid() = user_id AND has_role(auth.uid(), 'employee'::app_role));

CREATE POLICY "Employees can insert their own sessions"
  ON public.employee_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id AND has_role(auth.uid(), 'employee'::app_role));

CREATE POLICY "Employees can update their own sessions"
  ON public.employee_sessions FOR UPDATE
  USING (auth.uid() = user_id AND has_role(auth.uid(), 'employee'::app_role));

CREATE POLICY "Employees can delete their own sessions"
  ON public.employee_sessions FOR DELETE
  USING (auth.uid() = user_id AND has_role(auth.uid(), 'employee'::app_role));

-- 7. Function to get active sessions count by role
CREATE OR REPLACE FUNCTION public.get_active_sessions_count(_user_id UUID, _role app_role)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _count INTEGER;
BEGIN
  IF _role = 'admin' THEN
    SELECT COUNT(*)::INTEGER INTO _count
    FROM public.admin_sessions
    WHERE user_id = _user_id
      AND invalidated_at IS NULL
      AND expires_at > now();
  ELSE
    SELECT COUNT(*)::INTEGER INTO _count
    FROM public.employee_sessions
    WHERE user_id = _user_id
      AND invalidated_at IS NULL
      AND expires_at > now();
  END IF;
  
  RETURN COALESCE(_count, 0);
END;
$$;

-- 8. Function to invalidate sessions by role
CREATE OR REPLACE FUNCTION public.invalidate_sessions_by_role(
  _user_id UUID,
  _role app_role,
  _reason TEXT,
  _exclude_session_id TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invalidated_count INTEGER;
BEGIN
  IF _role = 'admin' THEN
    UPDATE public.admin_sessions
    SET invalidated_at = now(),
        invalidation_reason = _reason
    WHERE user_id = _user_id
      AND invalidated_at IS NULL
      AND (_exclude_session_id IS NULL OR session_id != _exclude_session_id);
    
    GET DIAGNOSTICS _invalidated_count = ROW_COUNT;
  ELSE
    UPDATE public.employee_sessions
    SET invalidated_at = now(),
        invalidation_reason = _reason
    WHERE user_id = _user_id
      AND invalidated_at IS NULL
      AND (_exclude_session_id IS NULL OR session_id != _exclude_session_id);
    
    GET DIAGNOSTICS _invalidated_count = ROW_COUNT;
  END IF;
  
  RETURN _invalidated_count;
END;
$$;

-- 9. Function to cleanup expired sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions_by_role()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _admin_deleted INTEGER;
  _employee_deleted INTEGER;
BEGIN
  DELETE FROM public.admin_sessions
  WHERE (expires_at < now() OR invalidated_at IS NOT NULL)
    AND created_at < now() - INTERVAL '7 days';
  
  GET DIAGNOSTICS _admin_deleted = ROW_COUNT;
  
  DELETE FROM public.employee_sessions
  WHERE (expires_at < now() OR invalidated_at IS NOT NULL)
    AND created_at < now() - INTERVAL '7 days';
  
  GET DIAGNOSTICS _employee_deleted = ROW_COUNT;
  
  RETURN _admin_deleted + _employee_deleted;
END;
$$;

-- 10. Migrate existing sessions from active_sessions (fixed)
DO $$
DECLARE
  _session RECORD;
  _is_admin BOOLEAN;
BEGIN
  FOR _session IN 
    SELECT * FROM public.active_sessions 
    WHERE invalidated_at IS NULL
  LOOP
    -- Check if user is admin
    SELECT has_role(_session.user_id, 'admin'::app_role) INTO _is_admin;
    
    IF _is_admin THEN
      INSERT INTO public.admin_sessions (
        user_id, session_id, device_fingerprint,
        last_activity, created_at, expires_at
      )
      VALUES (
        _session.user_id, _session.session_id, _session.device_fingerprint,
        _session.last_activity, _session.created_at, _session.expires_at
      )
      ON CONFLICT (session_id) DO NOTHING;
    ELSE
      INSERT INTO public.employee_sessions (
        user_id, session_id, device_fingerprint,
        last_activity, created_at, expires_at
      )
      VALUES (
        _session.user_id, _session.session_id, _session.device_fingerprint,
        _session.last_activity, _session.created_at, _session.expires_at
      )
      ON CONFLICT (session_id) DO NOTHING;
    END IF;
  END LOOP;
END;
$$;