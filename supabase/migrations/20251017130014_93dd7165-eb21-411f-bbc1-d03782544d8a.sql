-- Fix security warning: Set search_path for sync_management_time_entries function
CREATE OR REPLACE FUNCTION sync_management_time_entries()
RETURNS TRIGGER AS $$
DECLARE
  _work_date DATE;
  _is_management BOOLEAN;
  _role_type TEXT;
  _affected_count INTEGER;
BEGIN
  -- Extrage ziua lucrătoare din clock_in_time
  _work_date := DATE(NEW.clock_in_time);
  
  -- Verifică dacă user-ul este coordonator sau șef de echipă în mai multe echipe pentru ziua respectivă
  SELECT 
    CASE 
      WHEN COUNT(DISTINCT CASE WHEN coordinator_id = NEW.user_id THEN team_id END) > 1 THEN true
      WHEN COUNT(DISTINCT CASE WHEN team_leader_id = NEW.user_id THEN team_id END) > 1 THEN true
      ELSE false
    END,
    CASE 
      WHEN COUNT(DISTINCT CASE WHEN coordinator_id = NEW.user_id THEN team_id END) > 1 THEN 'coordonator'
      WHEN COUNT(DISTINCT CASE WHEN team_leader_id = NEW.user_id THEN team_id END) > 1 THEN 'șef echipă'
      ELSE NULL
    END
  INTO _is_management, _role_type
  FROM weekly_schedules
  WHERE (coordinator_id = NEW.user_id OR team_leader_id = NEW.user_id)
    AND (week_start_date + day_of_week) = _work_date;
  
  -- Dacă NU este management în mai multe echipe, skip
  IF NOT _is_management THEN
    RETURN NEW;
  END IF;
  
  -- ✅ SINCRONIZARE: Actualizează toate pontajele din celelalte echipe pentru aceeași zi
  UPDATE time_entries
  SET 
    clock_in_time = NEW.clock_in_time,
    clock_out_time = NEW.clock_out_time,
    approval_status = NEW.approval_status,
    approved_at = NEW.approved_at,
    approved_by = NEW.approved_by,
    approval_notes = COALESCE(NEW.approval_notes, '') || 
                    E'\n[AUTO-SYNC] Sincronizat automat',
    was_edited_by_admin = NEW.was_edited_by_admin,
    original_clock_in_time = COALESCE(original_clock_in_time, OLD.clock_in_time),
    original_clock_out_time = COALESCE(original_clock_out_time, OLD.clock_out_time),
    needs_reprocessing = true,
    updated_at = NOW()
  WHERE user_id = NEW.user_id
    AND DATE(clock_in_time) = _work_date
    AND id != NEW.id;
  
  GET DIAGNOSTICS _affected_count = ROW_COUNT;
  
  -- Log pentru debugging
  IF _affected_count > 0 THEN
    RAISE NOTICE '[AUTO-SYNC] Sincronizat % pontaje pentru % (%) în data %', 
      _affected_count, NEW.user_id, _role_type, _work_date;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;