-- Drop the problematic policy
DROP POLICY IF EXISTS "Users can view teammates schedules in same team and week" ON public.weekly_schedules;

-- Create security definer function to check if user is in a team
CREATE OR REPLACE FUNCTION public.user_in_team(_user_id uuid, _team_id text, _week_start date)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.weekly_schedules
    WHERE user_id = _user_id
    AND team_id = _team_id
    AND week_start_date = _week_start
  )
$$;

-- Create new policy using the security definer function
CREATE POLICY "Users can view teammates schedules in same team and week"
ON public.weekly_schedules
AS PERMISSIVE
FOR SELECT
TO authenticated
USING (
  public.user_in_team(auth.uid(), team_id, week_start_date)
);