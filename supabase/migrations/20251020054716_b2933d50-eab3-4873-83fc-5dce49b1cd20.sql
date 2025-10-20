-- Elimină trigger-ul problematic care recalcula incorect hours_regular
DROP TRIGGER IF EXISTS trigger_validate_timesheet_hours ON daily_timesheets;
DROP FUNCTION IF EXISTS validate_timesheet_hours();

-- Adaugă constraint de siguranță pentru a preveni ore imposibile (>24h/zi)
ALTER TABLE daily_timesheets 
ADD CONSTRAINT check_total_hours_per_day 
CHECK (
  COALESCE(hours_regular, 0) + COALESCE(hours_night, 0) + 
  COALESCE(hours_saturday, 0) + COALESCE(hours_sunday, 0) + 
  COALESCE(hours_holiday, 0) + COALESCE(hours_passenger, 0) + 
  COALESCE(hours_driving, 0) + COALESCE(hours_equipment, 0) + 
  COALESCE(hours_leave, 0) + COALESCE(hours_medical_leave, 0) <= 24
);