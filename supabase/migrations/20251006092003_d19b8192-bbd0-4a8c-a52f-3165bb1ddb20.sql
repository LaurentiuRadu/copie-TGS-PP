-- Enable required extensions for cron jobs
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Unschedule existing job if it exists
SELECT cron.unschedule('daily-timesheet-migration') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'daily-timesheet-migration'
);

-- Create daily cron job to process timesheets at 06:15 AM (Romania time)
-- This runs daily and processes the previous "timesheet day" (06:01 AM - 06:00 AM)
-- Cron schedule: '15 6 * * *' = At 06:15 every day
SELECT cron.schedule(
  'daily-timesheet-migration',
  '15 6 * * *',
  $$
  SELECT
    net.http_post(
        url := 'https://hbwkufaksipsqipqdqcv.supabase.co/functions/v1/migrate-historical-timesheets',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhid2t1ZmFrc2lwc3FpcHFkcWN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkyMTE4MDUsImV4cCI6MjA3NDc4NzgwNX0.3OVj-S-JgcWp531gmjCdMgag8TIZl8K4AgL9Ap_44BM'
        ),
        body := jsonb_build_object(
          'process_last_24h', true
        )
    ) as request_id;
  $$
);