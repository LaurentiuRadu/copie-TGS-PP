-- Add shift_type column with default 'zi'
ALTER TABLE public.weekly_schedules
ADD COLUMN shift_type TEXT NOT NULL DEFAULT 'zi' CHECK (shift_type IN ('zi', 'noapte'));