-- Permite utilizatorilor autentificați să adauge locații noi
CREATE POLICY "Authenticated users can insert locations"
ON public.locations
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Permite utilizatorilor autentificați să adauge proiecte noi
CREATE POLICY "Authenticated users can insert projects"
ON public.projects
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Adaugă index unic pentru a preveni duplicatele de locații (case insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS locations_name_lower_idx 
ON public.locations (LOWER(name));

-- Adaugă index unic pentru a preveni duplicatele de proiecte (case insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS projects_name_lower_idx 
ON public.projects (LOWER(name));