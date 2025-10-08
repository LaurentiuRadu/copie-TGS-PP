-- Adaugă politică RLS: utilizatorii pot vedea profilurile colegilor din aceeași echipă
CREATE POLICY "Users can view teammates profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM weekly_schedules ws1
    JOIN weekly_schedules ws2 ON ws2.team_id = ws1.team_id 
                              AND ws2.week_start_date = ws1.week_start_date
    WHERE ws1.user_id = auth.uid()
      AND ws2.user_id = profiles.id
      AND ws1.week_start_date >= CURRENT_DATE - INTERVAL '7 days'
  )
);