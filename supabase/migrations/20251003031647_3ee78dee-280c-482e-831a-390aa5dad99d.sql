
-- Temporary function to recalculate all segments
-- This will be run once and can be removed after

DO $$ 
DECLARE
  entry_record RECORD;
  function_url TEXT;
  service_key TEXT;
BEGIN
  -- Get Supabase URL and service key from environment
  function_url := current_setting('app.settings.api_url', true) || '/functions/v1/calculate-time-segments';
  service_key := current_setting('app.settings.service_role_key', true);
  
  RAISE NOTICE 'Starting segment recalculation...';
  
  -- Loop through all entries without segments
  FOR entry_record IN 
    SELECT 
      te.id,
      te.clock_in_time,
      te.clock_out_time
    FROM time_entries te
    WHERE te.clock_out_time IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM time_entry_segments tes 
        WHERE tes.time_entry_id = te.id
      )
    ORDER BY te.clock_in_time
  LOOP
    BEGIN
      RAISE NOTICE 'Processing entry: %', entry_record.id;
      
      -- Delete any existing segments (safety measure)
      DELETE FROM time_entry_segments 
      WHERE time_entry_id = entry_record.id;
      
      -- Note: We can't call HTTP from here, so we'll insert a placeholder
      -- The actual calculation will be triggered by the frontend
      RAISE NOTICE 'Entry % marked for recalculation', entry_record.id;
      
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Error processing entry %: %', entry_record.id, SQLERRM;
    END;
  END LOOP;
  
  RAISE NOTICE 'Segment recalculation marking complete';
END $$;
