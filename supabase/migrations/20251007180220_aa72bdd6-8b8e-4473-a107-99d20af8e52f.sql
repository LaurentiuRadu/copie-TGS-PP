-- ===================================================
-- SISTEM VERSIONING APLICAȚIE
-- ===================================================

-- Tabel pentru tracking versiuni aplicație
CREATE TABLE IF NOT EXISTS public.app_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version text NOT NULL UNIQUE,
  release_notes text,
  released_by uuid REFERENCES auth.users(id),
  is_current boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index pentru query rapid versiune curentă
CREATE INDEX idx_app_versions_current ON public.app_versions(is_current) WHERE is_current = true;

-- RLS Policies
ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;

-- Toți utilizatorii autentificați pot citi versiunile
CREATE POLICY "Everyone can view app versions"
ON public.app_versions
FOR SELECT
TO authenticated
USING (true);

-- Doar adminii pot gestiona versiunile
CREATE POLICY "Admins can manage app versions"
ON public.app_versions
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Funcție pentru setare versiune curentă (doar una poate fi curentă)
CREATE OR REPLACE FUNCTION public.set_current_version(_version_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verifică dacă user-ul este admin
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can set current version';
  END IF;

  -- Setează toate versiunile ca non-current
  UPDATE public.app_versions SET is_current = false WHERE is_current = true;
  
  -- Setează versiunea specificată ca current
  UPDATE public.app_versions 
  SET is_current = true, updated_at = now()
  WHERE id = _version_id;
  
  -- Log acțiunea
  PERFORM public.log_sensitive_data_access(
    'set_current_app_version',
    'app_version',
    _version_id,
    jsonb_build_object('timestamp', now())
  );
END;
$$;

-- Inserează versiunea inițială
INSERT INTO public.app_versions (version, release_notes, is_current)
VALUES ('1.0.0', 'Versiune inițială cu sistem de pontaj complet', true)
ON CONFLICT (version) DO NOTHING;

-- Trigger pentru updated_at
CREATE TRIGGER update_app_versions_updated_at
BEFORE UPDATE ON public.app_versions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.app_versions IS 
'Stochează versiunile aplicației pentru notificări de actualizare la utilizatori';