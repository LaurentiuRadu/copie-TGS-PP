-- Add flags for external contractors and office staff
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_external_contractor BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_office_staff BOOLEAN DEFAULT false;

-- Mark external contractors (no hourly timesheets needed)
UPDATE public.profiles 
SET is_external_contractor = true
WHERE username IN ('axentenelu', 'tabacarunicu', 'spaiucliviu');

-- Mark office staff (not part of field teams)
UPDATE public.profiles 
SET is_office_staff = true
WHERE username = 'catalinaapostu';

-- Delete erroneous time entries for Costache Marius (16s and 14s entries)
DELETE FROM public.time_entries
WHERE id IN (
  'e4204a47-2448-4043-bfd5-8a999b06e817',
  '8b8535fc-1e8e-4747-b349-6e8cb4e31aee'
);

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.is_external_contractor IS 'External contractors who do not need hourly timesheet tracking';
COMMENT ON COLUMN public.profiles.is_office_staff IS 'Office staff not part of field teams, excluded from team timesheet verification';