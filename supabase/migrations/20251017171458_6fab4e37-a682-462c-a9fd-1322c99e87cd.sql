-- ========================================
-- TRIGGER: Validare Ore în daily_timesheets
-- ========================================
-- Previne intrarea de ore care depășesc durata brută a pontajului
-- Auto-calculează hours_regular = durată_brută - ore_manuale

CREATE OR REPLACE FUNCTION validate_timesheet_hours()
RETURNS TRIGGER AS $$
DECLARE
  v_time_entry RECORD;
  v_durata_bruta NUMERIC;
  v_suma_manuale NUMERIC;
  v_tolerance CONSTANT NUMERIC := 0.05; -- 3 minute toleranță pentru rotunjiri
BEGIN
  -- 1. Găsește pontajul original (clock_in/clock_out)
  SELECT clock_in_time, clock_out_time 
  INTO v_time_entry
  FROM time_entries
  WHERE user_id = NEW.employee_id 
    AND DATE(clock_in_time AT TIME ZONE 'Europe/Bucharest') = NEW.work_date
    AND clock_out_time IS NOT NULL
  LIMIT 1;

  -- Dacă nu există pontaj (intrare manuală), skip validare
  IF NOT FOUND THEN 
    RETURN NEW; 
  END IF;

  -- 2. Calculează durata brută (ore)
  v_durata_bruta := EXTRACT(EPOCH FROM (v_time_entry.clock_out_time - v_time_entry.clock_in_time)) / 3600.0;

  -- 3. Sumează ore MANUALE (exclude hours_regular, leave, medical_leave)
  v_suma_manuale := 
    COALESCE(NEW.hours_passenger, 0) +
    COALESCE(NEW.hours_driving, 0) +
    COALESCE(NEW.hours_equipment, 0) +
    COALESCE(NEW.hours_night, 0) +
    COALESCE(NEW.hours_saturday, 0) +
    COALESCE(NEW.hours_sunday, 0) +
    COALESCE(NEW.hours_holiday, 0);

  -- 4. Validare cu toleranță
  IF v_suma_manuale > v_durata_bruta + v_tolerance THEN
    RAISE EXCEPTION 
      'Validare eșuată: Orele manuale (%.2f h) depășesc durata pontajului (%.2f h) pentru data %', 
      v_suma_manuale, v_durata_bruta, NEW.work_date
      USING HINT = 'Verificați valorile pentru Pasager, Condus, Utilaj, Noapte';
  END IF;

  -- 5. ✅ AUTO-CALCULARE: Setează hours_regular = durata_brută - ore_manuale
  NEW.hours_regular := GREATEST(0, v_durata_bruta - v_suma_manuale);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Attach trigger
DROP TRIGGER IF EXISTS trigger_validate_timesheet_hours ON daily_timesheets;
CREATE TRIGGER trigger_validate_timesheet_hours
  BEFORE INSERT OR UPDATE ON daily_timesheets
  FOR EACH ROW 
  EXECUTE FUNCTION validate_timesheet_hours();