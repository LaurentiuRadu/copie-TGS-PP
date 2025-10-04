-- FAZA 1: GDPR Compliance - Consent Management & Data Protection

-- 1. Tabel pentru gestionarea consimțămintelor utilizatorilor
CREATE TABLE IF NOT EXISTS public.user_consents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type TEXT NOT NULL CHECK (consent_type IN ('biometric_data', 'gps_tracking', 'photo_capture', 'data_processing')),
  consent_given BOOLEAN NOT NULL DEFAULT false,
  consent_date TIMESTAMP WITH TIME ZONE,
  consent_withdrawn_date TIMESTAMP WITH TIME ZONE,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, consent_type)
);

-- Enable RLS pentru user_consents
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

-- RLS Policies pentru user_consents
CREATE POLICY "Users can view their own consents"
  ON public.user_consents
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own consents"
  ON public.user_consents
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own consents"
  ON public.user_consents
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all consents"
  ON public.user_consents
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger pentru updated_at
CREATE TRIGGER update_user_consents_updated_at
  BEFORE UPDATE ON public.user_consents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Tabel pentru data retention policy
CREATE TABLE IF NOT EXISTS public.data_retention_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data_type TEXT NOT NULL UNIQUE CHECK (data_type IN ('biometric_photos', 'gps_coordinates', 'time_entries', 'face_verifications')),
  retention_days INTEGER NOT NULL,
  auto_delete_enabled BOOLEAN DEFAULT true,
  last_cleanup_run TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS pentru data_retention_policies
ALTER TABLE public.data_retention_policies ENABLE ROW LEVEL SECURITY;

-- RLS Policies pentru data_retention_policies
CREATE POLICY "Authenticated users can view retention policies"
  ON public.data_retention_policies
  FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage retention policies"
  ON public.data_retention_policies
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger pentru updated_at
CREATE TRIGGER update_data_retention_policies_updated_at
  BEFORE UPDATE ON public.data_retention_policies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Tabel pentru audit log GDPR (cereri de ștergere, export date, etc.)
CREATE TABLE IF NOT EXISTS public.gdpr_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('data_export', 'data_deletion', 'consent_withdrawal', 'data_access')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID REFERENCES auth.users(id),
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS pentru gdpr_requests
ALTER TABLE public.gdpr_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies pentru gdpr_requests
CREATE POLICY "Users can view their own GDPR requests"
  ON public.gdpr_requests
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own GDPR requests"
  ON public.gdpr_requests
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all GDPR requests"
  ON public.gdpr_requests
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update GDPR requests"
  ON public.gdpr_requests
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. Inserare politici de retenție implicite
INSERT INTO public.data_retention_policies (data_type, retention_days, auto_delete_enabled)
VALUES 
  ('biometric_photos', 365, true),      -- Păstrare 1 an
  ('gps_coordinates', 730, true),        -- Păstrare 2 ani
  ('time_entries', 1825, false),         -- Păstrare 5 ani (dezactivat auto-delete pentru istoric pontaj)
  ('face_verifications', 180, true)      -- Păstrare 6 luni
ON CONFLICT (data_type) DO NOTHING;

-- 5. Funcție pentru verificare consimțământ biometric
CREATE OR REPLACE FUNCTION public.check_biometric_consent(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT consent_given 
     FROM public.user_consents 
     WHERE user_id = _user_id 
       AND consent_type = 'biometric_data'
       AND consent_withdrawn_date IS NULL),
    false
  );
$$;

-- 6. Index-uri pentru performance
CREATE INDEX IF NOT EXISTS idx_user_consents_user_id ON public.user_consents(user_id);
CREATE INDEX IF NOT EXISTS idx_user_consents_type ON public.user_consents(consent_type);
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_user_id ON public.gdpr_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_status ON public.gdpr_requests(status);
CREATE INDEX IF NOT EXISTS idx_gdpr_requests_type ON public.gdpr_requests(request_type);