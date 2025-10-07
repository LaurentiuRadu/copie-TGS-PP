-- Funcție RPC pentru raportul de discrepanțe între echipe
CREATE OR REPLACE FUNCTION public.get_team_discrepancies()
RETURNS TABLE (
  team_id TEXT,
  week_start_date DATE,
  day_of_week INTEGER,
  membri BIGINT,
  diferenta_ore NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ws.team_id,
    ws.week_start_date,
    ws.day_of_week,
    COUNT(DISTINCT dt.employee_id) as membri,
    (MAX(dt.hours_regular + dt.hours_night) - MIN(dt.hours_regular + dt.hours_night))::NUMERIC as diferenta_ore
  FROM public.weekly_schedules ws
  JOIN public.daily_timesheets dt ON dt.employee_id = ws.user_id 
    AND dt.work_date = ws.week_start_date + ws.day_of_week
  WHERE ws.week_start_date >= CURRENT_DATE - INTERVAL '30 days'
  GROUP BY ws.team_id, ws.week_start_date, ws.day_of_week
  HAVING (MAX(dt.hours_regular + dt.hours_night) - MIN(dt.hours_regular + dt.hours_night)) > 1.0
  ORDER BY diferenta_ore DESC, ws.week_start_date DESC;
END;
$$;