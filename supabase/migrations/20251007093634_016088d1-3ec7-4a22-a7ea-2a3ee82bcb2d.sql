-- Add needs_reprocessing flag to time_entries
ALTER TABLE public.time_entries 
ADD COLUMN IF NOT EXISTS needs_reprocessing boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS last_reprocess_attempt timestamp with time zone;

-- Create index for faster queries on entries needing reprocessing
CREATE INDEX IF NOT EXISTS idx_time_entries_needs_reprocessing 
ON public.time_entries(needs_reprocessing) 
WHERE needs_reprocessing = true AND clock_out_time IS NOT NULL;

-- Comment
COMMENT ON COLUMN public.time_entries.needs_reprocessing IS 'Flag pentru pontaje care au eșuat procesarea automată și necesită reprocesare';
COMMENT ON COLUMN public.time_entries.last_reprocess_attempt IS 'Ultima încercare de reprocesare automată';