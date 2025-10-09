-- Unschedule daily timesheet migration cron job
-- Nu mai avem nevoie de fragmentare automată dimineața deoarece avem fragmentare în timp real
-- prin trigger-ul invoke_calculate_segments care rulează la fiecare clock-out

-- Verificăm și dezactivăm job-ul dacă există
DO $$
BEGIN
  -- Verifică dacă extensia pg_cron este activată
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Șterge job-ul dacă există
    PERFORM cron.unschedule('daily-timesheet-migration')
    WHERE EXISTS (
      SELECT 1 FROM cron.job WHERE jobname = 'daily-timesheet-migration'
    );
    
    RAISE NOTICE 'Daily timesheet migration cron job dezactivat - folosim acum fragmentare în timp real';
  END IF;
END $$;

-- Comentariu: Funcția migrate-historical-timesheets rămâne disponibilă pentru rulări manuale
-- prin componenta HistoricalDataMigration din Admin Dashboard