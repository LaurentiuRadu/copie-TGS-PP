-- Add performance indexes for daily_timesheets and weekly_schedules
-- These indexes will significantly improve query performance for date-based lookups
-- Note: Not using CONCURRENTLY because migrations run in transactions

-- Index pentru interogări pe work_date (folosit în rapoarte, export payroll)
CREATE INDEX IF NOT EXISTS idx_daily_timesheets_work_date 
  ON public.daily_timesheets (work_date DESC);

-- Index compus pentru interogări pe employee_id + work_date (folosit în timesheet personal)
CREATE INDEX IF NOT EXISTS idx_daily_timesheets_employee_date 
  ON public.daily_timesheets (employee_id, work_date DESC);

-- Index compus pentru interogări pe user_id + week_start_date (folosit în schedule views)
CREATE INDEX IF NOT EXISTS idx_weekly_schedules_user_week 
  ON public.weekly_schedules (user_id, week_start_date DESC);

-- Add comments pentru documentație
COMMENT ON INDEX idx_daily_timesheets_work_date IS 'Optimizează queries pe work_date pentru rapoarte și export';
COMMENT ON INDEX idx_daily_timesheets_employee_date IS 'Optimizează queries pentru timesheet-ul personal al angajaților';
COMMENT ON INDEX idx_weekly_schedules_user_week IS 'Optimizează queries pentru programul săptămânal al utilizatorilor';