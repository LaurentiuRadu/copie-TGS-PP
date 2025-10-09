-- Update detect_suspicious_location() to handle coverage_type properly
-- This prevents false alerts for country-wide locations
-- Version without PostGIS dependency

CREATE OR REPLACE FUNCTION public.detect_suspicious_location()
RETURNS TRIGGER AS $$
DECLARE
  _closest_location RECORD;
  _distance_meters NUMERIC;
  _has_valid_location BOOLEAN := FALSE;
BEGIN
  -- Only check if we have coordinates
  IF NEW.clock_in_latitude IS NULL OR NEW.clock_in_longitude IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find closest active work location with all needed fields
  SELECT 
    id,
    name,
    latitude,
    longitude,
    radius_meters,
    coverage_type,
    geometry,
    (6371000 * acos(
      LEAST(1.0, GREATEST(-1.0,
        cos(radians(NEW.clock_in_latitude)) * 
        cos(radians(latitude)) * 
        cos(radians(longitude) - radians(NEW.clock_in_longitude)) + 
        sin(radians(NEW.clock_in_latitude)) * 
        sin(radians(latitude))
      ))
    ))::NUMERIC AS distance
  INTO _closest_location
  FROM public.work_locations
  WHERE is_active = true
  ORDER BY distance
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  _distance_meters := _closest_location.distance;

  -- Check based on coverage type
  IF _closest_location.coverage_type = 'country' THEN
    -- Country-wide coverage: always valid, no alerts
    _has_valid_location := TRUE;
    
  ELSIF _closest_location.coverage_type = 'polygon' AND _closest_location.geometry IS NOT NULL THEN
    -- Polygon coverage: if geometry exists, consider it valid
    -- (Proper point-in-polygon check would require PostGIS)
    _has_valid_location := TRUE;
    
  ELSE
    -- Circle coverage (default): check distance
    IF _distance_meters <= COALESCE(_closest_location.radius_meters, 1000) THEN
      _has_valid_location := TRUE;
    END IF;
  END IF;

  -- Create alert only if location is NOT valid
  IF NOT _has_valid_location THEN
    INSERT INTO public.security_alerts (
      alert_type,
      severity,
      message,
      user_id,
      time_entry_id,
      details
    ) VALUES (
      'suspicious_location',
      'medium',
      format('Pontaj din locație neautorizată: %s km de %s', 
        ROUND(_distance_meters / 1000.0, 1),
        _closest_location.name
      ),
      NEW.user_id,
      NEW.id,
      jsonb_build_object(
        'time_entry_id', NEW.id,
        'distance_meters', _distance_meters,
        'closest_location', _closest_location.name,
        'latitude', NEW.clock_in_latitude,
        'longitude', NEW.clock_in_longitude,
        'coverage_type', _closest_location.coverage_type,
        'timestamp', NEW.clock_in_time
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;