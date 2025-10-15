-- Fix Problema 2: Restricționează INSERT pe locations doar la admini
-- Severitate: MEDIUM
-- Risc: Angajații pot adăuga locații false, corupând datele operaționale

-- Șterge policy veche permisivă
DROP POLICY IF EXISTS "Authenticated users can insert locations" ON public.locations;

-- Creează policy nouă: doar admini pot INSERT
CREATE POLICY "Only admins can insert locations"
ON public.locations
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Audit: Verifică că policy-ul este activ
COMMENT ON POLICY "Only admins can insert locations" ON public.locations IS 
  'Security fix 2025-10-15: Restricționează INSERT la admini pentru prevenirea coruperii datelor';