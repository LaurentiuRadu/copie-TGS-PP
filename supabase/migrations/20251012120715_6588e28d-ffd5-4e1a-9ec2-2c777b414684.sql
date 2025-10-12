-- Drop existing trigger if exists (pentru a evita duplicate)
DROP TRIGGER IF EXISTS auto_calculate_segments ON public.time_entries;

-- Re-create function invoke_calculate_segments cu logging îmbunătățit
CREATE OR REPLACE FUNCTION public.invoke_calculate_segments()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _request_id BIGINT;
  _payload JSONB;
  _supabase_url TEXT := 'https://hbwkufaksipsqipqdqcv.supabase.co';
  _service_role_key TEXT;
BEGIN
  -- Get service role key from environment
  BEGIN
    _service_role_key := current_setting('supabase.service_role_key', true);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING '[Auto-Calculate] Cannot get service_role_key: %', SQLERRM;
    RETURN NEW;
  END;

  -- Procesează doar dacă clock_out_time tocmai a fost setat
  IF (TG_OP = 'INSERT' AND NEW.clock_out_time IS NOT NULL) OR
     (TG_OP = 'UPDATE' AND OLD.clock_out_time IS NULL AND NEW.clock_out_time IS NOT NULL) THEN
    
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
        url := _supabase_url || '/functions/v1/calculate-time-segments',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || _service_role_key
        ),
        body := _payload
      ) INTO _request_id;

      RAISE NOTICE '[Auto-Calculate] ✅ Triggered for time_entry % (request_id: %)', NEW.id, _request_id;
      
      -- Mark as successfully triggered
      NEW.needs_reprocessing := false;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING '[Auto-Calculate] ❌ Failed for time_entry %: %', NEW.id, SQLERRM;
      
      -- Setează needs_reprocessing pentru retry manual
      NEW.needs_reprocessing := true;
      NEW.last_reprocess_attempt := now();
    END;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger pe time_entries
CREATE TRIGGER auto_calculate_segments
  BEFORE INSERT OR UPDATE ON public.time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.invoke_calculate_segments();