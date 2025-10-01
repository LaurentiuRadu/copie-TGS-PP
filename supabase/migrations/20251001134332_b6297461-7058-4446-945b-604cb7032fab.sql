-- Add columns to time_entries for security features
ALTER TABLE public.time_entries 
ADD COLUMN IF NOT EXISTS clock_in_photo_url TEXT,
ADD COLUMN IF NOT EXISTS clock_out_photo_url TEXT,
ADD COLUMN IF NOT EXISTS device_id TEXT,
ADD COLUMN IF NOT EXISTS device_info JSONB,
ADD COLUMN IF NOT EXISTS ip_address TEXT;

-- Create table for time entry segments (automatic splitting)
CREATE TABLE IF NOT EXISTS public.time_entry_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  time_entry_id UUID NOT NULL REFERENCES public.time_entries(id) ON DELETE CASCADE,
  segment_type TEXT NOT NULL CHECK (segment_type IN ('normal_day', 'normal_night', 'weekend_saturday_day', 'weekend_saturday_night', 'weekend_sunday_day', 'weekend_sunday_night', 'holiday_day', 'holiday_night', 'overtime')),
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  hours_decimal NUMERIC(5,2) NOT NULL,
  multiplier NUMERIC(3,2) NOT NULL DEFAULT 1.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT valid_time_range CHECK (end_time > start_time)
);

-- Enable RLS on segments
ALTER TABLE public.time_entry_segments ENABLE ROW LEVEL SECURITY;

-- RLS policies for segments
DO $$ BEGIN
  CREATE POLICY "Users can view their own time entry segments"
  ON public.time_entry_segments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.time_entries te
      WHERE te.id = time_entry_id AND te.user_id = auth.uid()
    )
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can view all time entry segments"
  ON public.time_entry_segments FOR SELECT
  USING (has_role(auth.uid(), 'admin'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create table for holidays
CREATE TABLE IF NOT EXISTS public.holidays (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  date DATE NOT NULL UNIQUE,
  is_recurring BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS on holidays
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Anyone can view holidays"
  ON public.holidays FOR SELECT
  USING (true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can insert holidays"
  ON public.holidays FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can update holidays"
  ON public.holidays FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can delete holidays"
  ON public.holidays FOR DELETE
  USING (has_role(auth.uid(), 'admin'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Update work_hour_rules to include multipliers
ALTER TABLE public.work_hour_rules
ADD COLUMN IF NOT EXISTS multiplier NUMERIC(3,2) DEFAULT 1.0,
ADD COLUMN IF NOT EXISTS applies_to_weekends BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS applies_to_holidays BOOLEAN DEFAULT FALSE;

-- Insert Romanian legal holidays for 2025 (if not exists)
INSERT INTO public.holidays (name, date, is_recurring) VALUES
('Anul Nou', '2025-01-01', true),
('Anul Nou', '2025-01-02', true),
('Ziua Unirii', '2025-01-24', true),
('Vinerea Mare', '2025-04-18', false),
('Pastele', '2025-04-20', false),
('Pastele', '2025-04-21', false),
('Ziua Muncii', '2025-05-01', true),
('Ziua Copilului', '2025-06-01', true),
('Rusaliile', '2025-06-08', false),
('Rusaliile', '2025-06-09', false),
('Adormirea Maicii Domnului', '2025-08-15', true),
('Sfantul Andrei', '2025-11-30', true),
('Ziua Nationala', '2025-12-01', true),
('Craciunul', '2025-12-25', true),
('Craciunul', '2025-12-26', true)
ON CONFLICT (date) DO NOTHING;

-- Create indexes if not exists
CREATE INDEX IF NOT EXISTS idx_time_entry_segments_entry_id ON public.time_entry_segments(time_entry_id);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON public.holidays(date);
CREATE INDEX IF NOT EXISTS idx_time_entries_device_id ON public.time_entries(device_id);
CREATE INDEX IF NOT EXISTS idx_time_entries_user_clock_in ON public.time_entries(user_id, clock_in_time DESC);