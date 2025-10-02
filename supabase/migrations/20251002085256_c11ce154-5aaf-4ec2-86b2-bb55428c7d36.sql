-- Restrângere acces tabele publice la utilizatori autentificați

-- 1. Șterge politica publică pentru holidays
DROP POLICY IF EXISTS "Anyone can view holidays" ON public.holidays;

-- 2. Adaugă politică pentru utilizatori autentificați
CREATE POLICY "Authenticated users can view holidays"
ON public.holidays
FOR SELECT
TO authenticated
USING (true);

-- 3. Șterge politica publică pentru work_hour_rules
DROP POLICY IF EXISTS "Anyone can view work hour rules" ON public.work_hour_rules;

-- 4. Adaugă politică pentru utilizatori autentificați
CREATE POLICY "Authenticated users can view work hour rules"
ON public.work_hour_rules
FOR SELECT
TO authenticated
USING (true);