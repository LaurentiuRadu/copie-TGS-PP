-- Permit adminilor să actualizeze pontajele oricărui utilizator
CREATE POLICY "Admins can update all time entries"
ON public.time_entries
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));