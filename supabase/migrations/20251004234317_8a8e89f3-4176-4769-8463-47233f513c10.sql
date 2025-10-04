-- FAZA 2: Securitate Autentificare

-- 1. Tabel pentru rate limiting
CREATE TABLE IF NOT EXISTS public.rate_limit_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL, -- IP address sau user_id
  attempt_type TEXT NOT NULL CHECK (attempt_type IN ('login', 'api_call', 'password_reset', 'data_export')),
  attempt_count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  blocked_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(identifier, attempt_type, window_start)
);

-- Enable RLS pentru rate_limit_attempts
ALTER TABLE public.rate_limit_attempts ENABLE ROW LEVEL SECURITY;

-- RLS Policy pentru admins
CREATE POLICY "Admins can view all rate limit attempts"
  ON public.rate_limit_attempts
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- System poate insera și updata
CREATE POLICY "System can manage rate limits"
  ON public.rate_limit_attempts
  FOR ALL
  USING (true);

-- Index pentru performance
CREATE INDEX IF NOT EXISTS idx_rate_limit_identifier ON public.rate_limit_attempts(identifier, attempt_type);
CREATE INDEX IF NOT EXISTS idx_rate_limit_window ON public.rate_limit_attempts(window_start);

-- 2. Tabel pentru configurare rate limits
CREATE TABLE IF NOT EXISTS public.rate_limit_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  limit_type TEXT NOT NULL UNIQUE CHECK (limit_type IN ('login', 'api_call', 'password_reset', 'data_export')),
  max_attempts INTEGER NOT NULL,
  window_minutes INTEGER NOT NULL,
  block_duration_minutes INTEGER NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS pentru rate_limit_config
ALTER TABLE public.rate_limit_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view rate limit config"
  ON public.rate_limit_config
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage rate limit config"
  ON public.rate_limit_config
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger pentru updated_at
CREATE TRIGGER update_rate_limit_config_updated_at
  BEFORE UPDATE ON public.rate_limit_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Inserare configurări implicite
INSERT INTO public.rate_limit_config (limit_type, max_attempts, window_minutes, block_duration_minutes)
VALUES 
  ('login', 5, 15, 30),              -- 5 încercări în 15 min, blocare 30 min
  ('api_call', 100, 1, 5),           -- 100 cereri/minut, blocare 5 min
  ('password_reset', 3, 60, 120),    -- 3 încercări/oră, blocare 2 ore
  ('data_export', 5, 60, 60)         -- 5 exporturi/oră, blocare 1 oră
ON CONFLICT (limit_type) DO NOTHING;

-- 3. Funcție pentru verificare rate limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  _identifier TEXT,
  _attempt_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _config RECORD;
  _attempts RECORD;
  _window_start TIMESTAMP WITH TIME ZONE;
  _result JSONB;
BEGIN
  -- Obține configurația pentru tipul de încercare
  SELECT * INTO _config
  FROM public.rate_limit_config
  WHERE limit_type = _attempt_type AND enabled = true;

  IF NOT FOUND THEN
    -- Dacă nu există config, permitem cererea
    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', 999,
      'reset_at', null
    );
  END IF;

  -- Calculează începutul ferestrei curente
  _window_start := date_trunc('minute', now()) - (_config.window_minutes || ' minutes')::INTERVAL;

  -- Verifică dacă utilizatorul este blocat
  SELECT * INTO _attempts
  FROM public.rate_limit_attempts
  WHERE identifier = _identifier
    AND attempt_type = _attempt_type
    AND blocked_until IS NOT NULL
    AND blocked_until > now();

  IF FOUND THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'reset_at', _attempts.blocked_until,
      'blocked', true
    );
  END IF;

  -- Obține numărul de încercări din fereastra curentă
  SELECT * INTO _attempts
  FROM public.rate_limit_attempts
  WHERE identifier = _identifier
    AND attempt_type = _attempt_type
    AND window_start >= _window_start;

  IF NOT FOUND THEN
    -- Prima încercare în fereastra curentă
    INSERT INTO public.rate_limit_attempts (identifier, attempt_type, attempt_count, window_start)
    VALUES (_identifier, _attempt_type, 1, now());

    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', _config.max_attempts - 1,
      'reset_at', now() + (_config.window_minutes || ' minutes')::INTERVAL
    );
  END IF;

  -- Verifică dacă a depășit limita
  IF _attempts.attempt_count >= _config.max_attempts THEN
    -- Blochează utilizatorul
    UPDATE public.rate_limit_attempts
    SET blocked_until = now() + (_config.block_duration_minutes || ' minutes')::INTERVAL
    WHERE id = _attempts.id;

    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'reset_at', now() + (_config.block_duration_minutes || ' minutes')::INTERVAL,
      'blocked', true
    );
  END IF;

  -- Incrementează numărul de încercări
  UPDATE public.rate_limit_attempts
  SET attempt_count = attempt_count + 1,
      updated_at = now()
  WHERE id = _attempts.id;

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', _config.max_attempts - _attempts.attempt_count - 1,
    'reset_at', _attempts.window_start + (_config.window_minutes || ' minutes')::INTERVAL
  );
END;
$$;

-- 4. Actualizare tabel active_sessions pentru session management
ALTER TABLE public.active_sessions
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + INTERVAL '24 hours'),
ADD COLUMN IF NOT EXISTS invalidated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS invalidation_reason TEXT;

-- Index pentru expirare sesiuni
CREATE INDEX IF NOT EXISTS idx_active_sessions_expires ON public.active_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_active_sessions_invalidated ON public.active_sessions(invalidated_at);

-- 5. Funcție pentru cleanup sesiuni expirate
CREATE OR REPLACE FUNCTION public.cleanup_expired_sessions()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _deleted_count INTEGER;
BEGIN
  DELETE FROM public.active_sessions
  WHERE expires_at < now() OR invalidated_at IS NOT NULL;
  
  GET DIAGNOSTICS _deleted_count = ROW_COUNT;
  RETURN _deleted_count;
END;
$$;

-- 6. Funcție pentru invalidare sesiuni la schimbare parolă
CREATE OR REPLACE FUNCTION public.invalidate_user_sessions(_user_id UUID, _reason TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _invalidated_count INTEGER;
BEGIN
  UPDATE public.active_sessions
  SET invalidated_at = now(),
      invalidation_reason = _reason
  WHERE user_id = _user_id
    AND invalidated_at IS NULL;
  
  GET DIAGNOSTICS _invalidated_count = ROW_COUNT;
  RETURN _invalidated_count;
END;
$$;

-- 7. Trigger pentru invalidare sesiuni la schimbare parolă
CREATE OR REPLACE FUNCTION public.trigger_invalidate_sessions_on_password_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.password_changed_at IS DISTINCT FROM OLD.password_changed_at THEN
    PERFORM public.invalidate_user_sessions(NEW.user_id, 'password_changed');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_password_change_invalidate_sessions
  AFTER UPDATE ON public.user_password_tracking
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_invalidate_sessions_on_password_change();