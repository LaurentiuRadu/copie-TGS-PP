-- Corectare pontaj problematic (MACIUCA TUDOR BOGDAN - 33h → 16h)
UPDATE public.time_entries
SET 
  clock_out_time = '2025-10-07 22:00:00+03',
  needs_reprocessing = true,
  updated_at = now()
WHERE id = '8d53b5b0-b5a7-4090-8493-96ffe7b09dec';

-- Funcție pentru validare durată pontaj max 24h
CREATE OR REPLACE FUNCTION validate_time_entry_duration()
RETURNS TRIGGER AS $$
DECLARE
  _duration_hours NUMERIC;
BEGIN
  IF NEW.clock_out_time IS NOT NULL THEN
    _duration_hours := EXTRACT(EPOCH FROM (NEW.clock_out_time - NEW.clock_in_time)) / 3600;
    
    IF _duration_hours > 24 THEN
      -- Creează alertă în loc să blocheze
      INSERT INTO public.security_alerts (
        alert_type, severity, message, user_id, time_entry_id, details
      ) VALUES (
        'excessive_duration', 
        'critical',
        format('Pontaj suspect: %.1f ore (max recomandat: 24h)', _duration_hours),
        NEW.user_id, 
        NEW.id,
        jsonb_build_object(
          'duration_hours', _duration_hours,
          'clock_in', NEW.clock_in_time,
          'clock_out', NEW.clock_out_time,
          'auto_detected', true
        )
      );
      
      -- Marchează pentru review manual
      NEW.needs_reprocessing := true;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger pentru validare automat
CREATE TRIGGER check_time_entry_duration
BEFORE INSERT OR UPDATE ON public.time_entries
FOR EACH ROW
EXECUTE FUNCTION validate_time_entry_duration();