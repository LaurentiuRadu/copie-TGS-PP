-- Adaugă RLS policy pentru UPDATE pe time_entry_segments pentru admini
CREATE POLICY "Admins can update time entry segments" 
ON time_entry_segments
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));