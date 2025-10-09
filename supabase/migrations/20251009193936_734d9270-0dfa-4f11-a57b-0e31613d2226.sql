-- Modifică constraint-ul pentru time_entry_segments să accepte driving, passenger, equipment
ALTER TABLE public.time_entry_segments 
DROP CONSTRAINT IF EXISTS time_entry_segments_segment_type_check;

ALTER TABLE public.time_entry_segments 
ADD CONSTRAINT time_entry_segments_segment_type_check 
CHECK (segment_type IN (
  'normal_day', 
  'normal_night', 
  'saturday', 
  'sunday', 
  'holiday',
  'driving',      -- ✅ Nou: pentru tip Condus
  'passenger',    -- ✅ Nou: pentru tip Pasager
  'equipment'     -- ✅ Nou: pentru tip Echipamente
));