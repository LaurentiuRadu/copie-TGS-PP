-- Create table for work locations
CREATE TABLE public.work_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  radius_meters INTEGER NOT NULL DEFAULT 100,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.work_locations ENABLE ROW LEVEL SECURITY;

-- Policies: Everyone can view active locations
CREATE POLICY "Anyone can view active work locations"
ON public.work_locations
FOR SELECT
USING (is_active = true);

-- Policy: Admins can view all locations
CREATE POLICY "Admins can view all work locations"
ON public.work_locations
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Policy: Admins can insert locations
CREATE POLICY "Admins can insert work locations"
ON public.work_locations
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Policy: Admins can update locations
CREATE POLICY "Admins can update work locations"
ON public.work_locations
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Policy: Admins can delete locations
CREATE POLICY "Admins can delete work locations"
ON public.work_locations
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_work_locations_updated_at
BEFORE UPDATE ON public.work_locations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create table for time entries with location verification
CREATE TABLE public.time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  clock_in_time TIMESTAMP WITH TIME ZONE NOT NULL,
  clock_out_time TIMESTAMP WITH TIME ZONE,
  clock_in_latitude DECIMAL(10, 8),
  clock_in_longitude DECIMAL(11, 8),
  clock_out_latitude DECIMAL(10, 8),
  clock_out_longitude DECIMAL(11, 8),
  clock_in_location_id UUID REFERENCES public.work_locations(id),
  clock_out_location_id UUID REFERENCES public.work_locations(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.time_entries ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own entries
CREATE POLICY "Users can view their own time entries"
ON public.time_entries
FOR SELECT
USING (auth.uid() = user_id);

-- Policy: Admins can view all entries
CREATE POLICY "Admins can view all time entries"
ON public.time_entries
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Policy: Users can insert their own entries
CREATE POLICY "Users can insert their own time entries"
ON public.time_entries
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own entries (for clock out)
CREATE POLICY "Users can update their own time entries"
ON public.time_entries
FOR UPDATE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_time_entries_updated_at
BEFORE UPDATE ON public.time_entries
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();