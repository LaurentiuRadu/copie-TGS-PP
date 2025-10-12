-- ========================================
-- ȘTERGERE COMPLETĂ DATE ÎNAINTE DE 13.10.2025
-- ========================================

-- 1. Ștergere segmente (dependență FK)
DELETE FROM public.time_entry_segments
WHERE time_entry_id IN (
  SELECT id FROM public.time_entries 
  WHERE clock_in_time < '2025-10-13 00:00:00+00'::timestamptz
);

-- 2. Ștergere pontaje
DELETE FROM public.time_entries
WHERE clock_in_time < '2025-10-13 00:00:00+00'::timestamptz;

-- 3. Ștergere daily timesheets
DELETE FROM public.daily_timesheets
WHERE work_date < '2025-10-13'::date;

-- ========================================
-- VERIFICARE REZULTAT
-- ========================================
DO $$
DECLARE
  segments_count INTEGER;
  entries_count INTEGER;
  timesheets_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO segments_count 
  FROM public.time_entry_segments 
  WHERE EXISTS (
    SELECT 1 FROM public.time_entries te 
    WHERE te.id = time_entry_segments.time_entry_id 
    AND te.clock_in_time < '2025-10-13 00:00:00+00'::timestamptz
  );
  
  SELECT COUNT(*) INTO entries_count 
  FROM public.time_entries 
  WHERE clock_in_time < '2025-10-13 00:00:00+00'::timestamptz;
  
  SELECT COUNT(*) INTO timesheets_count 
  FROM public.daily_timesheets 
  WHERE work_date < '2025-10-13'::date;
  
  RAISE NOTICE '✅ Segments rămase < 13.10: %', segments_count;
  RAISE NOTICE '✅ Entries rămase < 13.10: %', entries_count;
  RAISE NOTICE '✅ Timesheets rămase < 13.10: %', timesheets_count;
  
  IF segments_count > 0 OR entries_count > 0 OR timesheets_count > 0 THEN
    RAISE EXCEPTION 'Ștergerea a eșuat! Date rămase în baza de date.';
  END IF;
END $$;