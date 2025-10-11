-- Adăugăm coloane pentru a păstra pontajul ORIGINAL al angajatului
ALTER TABLE time_entries 
ADD COLUMN IF NOT EXISTS original_clock_in_time timestamptz,
ADD COLUMN IF NOT EXISTS original_clock_out_time timestamptz,
ADD COLUMN IF NOT EXISTS was_edited_by_admin boolean DEFAULT false;

-- Populăm coloanele pentru pontajele EXISTENTE (copiem valorile actuale)
UPDATE time_entries 
SET 
  original_clock_in_time = COALESCE(original_clock_in_time, clock_in_time),
  original_clock_out_time = COALESCE(original_clock_out_time, clock_out_time),
  was_edited_by_admin = COALESCE(was_edited_by_admin, false)
WHERE original_clock_in_time IS NULL OR original_clock_out_time IS NULL;

-- Adăugăm index pentru performanță
CREATE INDEX IF NOT EXISTS idx_time_entries_was_edited ON time_entries(was_edited_by_admin) WHERE was_edited_by_admin = true;

COMMENT ON COLUMN time_entries.original_clock_in_time IS 'Păstrează ora de intrare ORIGINALĂ pontată de angajat (înainte de editare admin)';
COMMENT ON COLUMN time_entries.original_clock_out_time IS 'Păstrează ora de ieșire ORIGINALĂ pontată de angajat (înainte de editare admin)';
COMMENT ON COLUMN time_entries.was_edited_by_admin IS 'Flag pentru a marca dacă pontajul a fost modificat manual de către admin';