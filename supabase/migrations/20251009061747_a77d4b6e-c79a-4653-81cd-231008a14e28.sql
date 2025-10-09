-- Adaugă trigger automat pentru calcularea segmentelor de timp

-- Funcție care invocă edge function calculate-time-segments prin pg_net
CREATE OR REPLACE FUNCTION public.invoke_calculate_segments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _request_id BIGINT;
  _payload JSONB;
BEGIN
  -- Construiește payload pentru edge function
  _payload := jsonb_build_object(
    'user_id', NEW.user_id::text,
    'time_entry_id', NEW.id::text,
    'clock_in_time', NEW.clock_in_time::text,
    'clock_out_time', NEW.clock_out_time::text,
    'notes', NEW.notes
  );

  -- Invocă edge function prin pg_net (asincron)
  BEGIN
    SELECT net.http_post(
      url := 'https://hbwkufaksipsqipqdqcv.supabase.co/functions/v1/calculate-time-segments',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('supabase.service_role_key', true)
      ),
      body := _payload
    ) INTO _request_id;

    RAISE NOTICE '[Auto-Calculate] ✅ Triggered for time_entry % (request_id: %)', NEW.id, _request_id;
    
    -- Mark as successfully triggered
    UPDATE public.time_entries 
    SET needs_reprocessing = false 
    WHERE id = NEW.id;
    
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[Auto-Calculate] ❌ Failed for time_entry %: %', NEW.id, SQLERRM;
    
    -- Setează needs_reprocessing pentru retry manual
    UPDATE public.time_entries 
    SET needs_reprocessing = true,
        last_reprocess_attempt = now()
    WHERE id = NEW.id;
  END;

  RETURN NEW;
END;
$$;

-- Trigger pentru INSERT (când se face clock-in + clock-out simultan - rar)
DROP TRIGGER IF EXISTS auto_calculate_segments_on_insert ON public.time_entries;
CREATE TRIGGER auto_calculate_segments_on_insert
AFTER INSERT ON public.time_entries
FOR EACH ROW
WHEN (NEW.clock_out_time IS NOT NULL)
EXECUTE FUNCTION public.invoke_calculate_segments();

-- Trigger pentru UPDATE (când se face clock-out - scenariul comun)
DROP TRIGGER IF EXISTS auto_calculate_segments_on_update ON public.time_entries;
CREATE TRIGGER auto_calculate_segments_on_update
AFTER UPDATE ON public.time_entries
FOR EACH ROW
WHEN (
  OLD.clock_out_time IS NULL 
  AND NEW.clock_out_time IS NOT NULL
)
EXECUTE FUNCTION public.invoke_calculate_segments();