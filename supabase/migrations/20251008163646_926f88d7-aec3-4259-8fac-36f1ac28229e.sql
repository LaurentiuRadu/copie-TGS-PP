-- Adaugă coloane pentru zone desenate pe hartă
ALTER TABLE work_locations 
ADD COLUMN IF NOT EXISTS geometry JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS coverage_type TEXT DEFAULT 'circle' 
  CHECK (coverage_type IN ('circle', 'polygon', 'country'));

-- Index pentru performanță
CREATE INDEX IF NOT EXISTS idx_work_locations_coverage_type 
  ON work_locations(coverage_type);

-- Comentarii pentru documentare
COMMENT ON COLUMN work_locations.geometry IS 
  'GeoJSON geometry pentru zone desenate - null pentru locații circulare';
COMMENT ON COLUMN work_locations.coverage_type IS 
  'Tipul acoperirii: circle (rază), polygon (zonă desenată), country (toată țara)';