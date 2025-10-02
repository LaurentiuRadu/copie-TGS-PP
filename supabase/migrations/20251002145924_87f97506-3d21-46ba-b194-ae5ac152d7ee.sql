-- Drop restrictive policy
DROP POLICY IF EXISTS "Users can view teammates schedules in same team and week" ON public.weekly_schedules;

-- Recreate as PERMISSIVE policy
CREATE POLICY "Users can view teammates schedules in same team and week"
ON public.weekly_schedules
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.weekly_schedules my_schedule
    WHERE my_schedule.user_id = auth.uid()
    AND my_schedule.team_id = weekly_schedules.team_id
    AND my_schedule.week_start_date = weekly_schedules.week_start_date
  )
);