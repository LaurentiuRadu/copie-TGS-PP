-- Permite adminilor să șteargă daily_timesheets (manual overrides)
CREATE POLICY "Admins can delete daily timesheets"
ON public.daily_timesheets
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));