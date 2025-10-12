-- Step 1: Delete all existing segments (only 4 rows with incorrect nomenclature)
-- They will be regenerated after constraint fix
DELETE FROM public.time_entry_segments;

-- Step 2: Drop old constraint
ALTER TABLE public.time_entry_segments 
DROP CONSTRAINT IF EXISTS time_entry_segments_segment_type_check;

-- Step 3: Add correct constraint with 'hours_*' nomenclature
ALTER TABLE public.time_entry_segments
ADD CONSTRAINT time_entry_segments_segment_type_check 
CHECK (segment_type IN (
  'hours_regular',
  'hours_night', 
  'hours_saturday',
  'hours_sunday',
  'hours_holiday',
  'hours_driving',
  'hours_passenger',
  'hours_equipment',
  'hours_leave',
  'hours_medical_leave'
));