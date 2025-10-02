-- Add coordinator_id to weekly_schedules table
ALTER TABLE public.weekly_schedules
ADD COLUMN coordinator_id uuid REFERENCES public.profiles(id);

-- Add index for better performance
CREATE INDEX idx_weekly_schedules_coordinator_id ON public.weekly_schedules(coordinator_id);

COMMENT ON COLUMN public.weekly_schedules.coordinator_id IS 'ID-ul coordonatorului echipei pentru această programare';