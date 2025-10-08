-- =====================================================
-- SECURITY ALERT DETECTION SYSTEM
-- Triggers pentru detectare automată anomalii securitate
-- =====================================================

-- =====================================================
-- FUNCTION: Detectare Locație Suspectă
-- Se declanșează la INSERT în time_entries cu coordonate GPS
-- =====================================================
CREATE OR REPLACE FUNCTION public.detect_suspicious_location()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _closest_location RECORD;
  _distance_meters NUMERIC;
  _has_valid_location BOOLEAN := FALSE;
BEGIN
  -- Verifică doar dacă avem coordonate GPS
  IF NEW.clock_in_latitude IS NULL OR NEW.clock_in_longitude IS NULL THEN
    RETURN NEW;
  END IF;

  -- Caută cea mai apropiată locație validă
  SELECT 
    id, 
    name,
    latitude,
    longitude,
    radius_meters,
    -- Calculează distanța în metri folosind formula Haversine simplificată
    (
      6371000 * acos(
        cos(radians(NEW.clock_in_latitude)) * 
        cos(radians(latitude)) * 
        cos(radians(longitude) - radians(NEW.clock_in_longitude)) + 
        sin(radians(NEW.clock_in_latitude)) * 
        sin(radians(latitude))
      )
    )::NUMERIC AS distance
  INTO _closest_location
  FROM public.work_locations
  WHERE is_active = true
  ORDER BY distance
  LIMIT 1;

  -- Dacă există o locație apropiată
  IF FOUND THEN
    _distance_meters := _closest_location.distance;
    
    -- Verifică dacă este în raza permisă
    IF _distance_meters <= _closest_location.radius_meters THEN
      _has_valid_location := TRUE;
    END IF;
  END IF;

  -- Dacă NU este în nicio locație validă, creează alertă
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
      'high',
      format('Pontaj din locație neautorizată: %s metri de la %s', 
        ROUND(_distance_meters, 0),
        COALESCE(_closest_location.name, 'nicio locație cunoscută')
      ),
      NEW.user_id,
      NEW.id,
      jsonb_build_object(
        'clock_in_latitude', NEW.clock_in_latitude,
        'clock_in_longitude', NEW.clock_in_longitude,
        'closest_location_id', _closest_location.id,
        'closest_location_name', _closest_location.name,
        'distance_meters', ROUND(_distance_meters, 2),
        'allowed_radius_meters', _closest_location.radius_meters,
        'timestamp', NEW.clock_in_time
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to time_entries
DROP TRIGGER IF EXISTS trigger_detect_suspicious_location ON public.time_entries;
CREATE TRIGGER trigger_detect_suspicious_location
  AFTER INSERT ON public.time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.detect_suspicious_location();

-- =====================================================
-- FUNCTION: Detectare Mișcare Rapidă
-- Se declanșează la UPDATE când clock_out_time este setat
-- =====================================================
CREATE OR REPLACE FUNCTION public.detect_rapid_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _distance_km NUMERIC;
  _time_hours NUMERIC;
  _speed_kmh NUMERIC;
  _max_realistic_speed CONSTANT NUMERIC := 500; -- 500 km/h (mai rapid decât avioane de pasageri)
BEGIN
  -- Verifică doar când clock_out_time tocmai a fost setat
  IF NEW.clock_out_time IS NULL OR OLD.clock_out_time IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Verifică dacă avem toate coordonatele necesare
  IF NEW.clock_in_latitude IS NULL OR NEW.clock_in_longitude IS NULL OR
     NEW.clock_out_latitude IS NULL OR NEW.clock_out_longitude IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calculează distanța în km folosind formula Haversine
  _distance_km := (
    6371 * acos(
      cos(radians(NEW.clock_in_latitude)) * 
      cos(radians(NEW.clock_out_latitude)) * 
      cos(radians(NEW.clock_out_longitude) - radians(NEW.clock_in_longitude)) + 
      sin(radians(NEW.clock_in_latitude)) * 
      sin(radians(NEW.clock_out_latitude))
    )
  )::NUMERIC;

  -- Calculează timpul în ore
  _time_hours := EXTRACT(EPOCH FROM (NEW.clock_out_time - NEW.clock_in_time)) / 3600.0;

  -- Evită diviziune prin zero
  IF _time_hours <= 0 THEN
    RETURN NEW;
  END IF;

  -- Calculează viteza
  _speed_kmh := _distance_km / _time_hours;

  -- Dacă viteza este imposibilă, creează alertă
  IF _speed_kmh > _max_realistic_speed THEN
    INSERT INTO public.security_alerts (
      alert_type,
      severity,
      message,
      user_id,
      time_entry_id,
      details
    ) VALUES (
      'rapid_movement',
      'critical',
      format('Mișcare imposibilă detectată: %.0f km în %.1f ore (%.0f km/h)',
        _distance_km, _time_hours, _speed_kmh
      ),
      NEW.user_id,
      NEW.id,
      jsonb_build_object(
        'clock_in_location', jsonb_build_object(
          'latitude', NEW.clock_in_latitude,
          'longitude', NEW.clock_in_longitude,
          'time', NEW.clock_in_time
        ),
        'clock_out_location', jsonb_build_object(
          'latitude', NEW.clock_out_latitude,
          'longitude', NEW.clock_out_longitude,
          'time', NEW.clock_out_time
        ),
        'distance_km', ROUND(_distance_km, 2),
        'time_hours', ROUND(_time_hours, 2),
        'calculated_speed_kmh', ROUND(_speed_kmh, 0),
        'max_realistic_speed_kmh', _max_realistic_speed
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to time_entries
DROP TRIGGER IF EXISTS trigger_detect_rapid_movement ON public.time_entries;
CREATE TRIGGER trigger_detect_rapid_movement
  AFTER UPDATE ON public.time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.detect_rapid_movement();

-- =====================================================
-- FUNCTION: Detectare Photo Mismatch
-- Se declanșează la INSERT în face_verification_logs
-- =====================================================
CREATE OR REPLACE FUNCTION public.detect_photo_mismatch()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Alertă doar dacă:
  -- 1. Poza este de calitate bună (is_quality_pass = true)
  -- 2. DAR nu se potrivește cu profilul (is_match = false)
  IF NEW.is_quality_pass = true AND NEW.is_match = false THEN
    INSERT INTO public.security_alerts (
      alert_type,
      severity,
      message,
      user_id,
      time_entry_id,
      details
    ) VALUES (
      'photo_mismatch',
      'critical',
      format('Verificare foto eșuată: scor potrivire %.0f%% (prag: 70%%)',
        COALESCE(NEW.match_score * 100, 0)
      ),
      NEW.user_id,
      NEW.time_entry_id,
      jsonb_build_object(
        'verification_type', NEW.verification_type,
        'match_score', NEW.match_score,
        'quality_score', NEW.quality_score,
        'photo_url', NEW.photo_url,
        'failure_reason', NEW.failure_reason,
        'timestamp', NEW.created_at
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to face_verification_logs
DROP TRIGGER IF EXISTS trigger_detect_photo_mismatch ON public.face_verification_logs;
CREATE TRIGGER trigger_detect_photo_mismatch
  AFTER INSERT ON public.face_verification_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.detect_photo_mismatch();

-- =====================================================
-- FUNCTION: Detectare Schimbare Dispozitiv
-- Se declanșează la INSERT în time_entries
-- =====================================================
CREATE OR REPLACE FUNCTION public.detect_device_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _previous_devices TEXT[];
  _device_count INTEGER;
  _last_used_device TEXT;
BEGIN
  -- Verifică doar dacă avem device_id
  IF NEW.device_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Obține ultimele 10 dispozitive folosite (fără duplicates)
  SELECT 
    array_agg(DISTINCT device_id ORDER BY device_id),
    COUNT(DISTINCT device_id)
  INTO _previous_devices, _device_count
  FROM (
    SELECT device_id 
    FROM public.time_entries
    WHERE user_id = NEW.user_id
      AND device_id IS NOT NULL
      AND id != NEW.id -- exclude current entry
    ORDER BY clock_in_time DESC
    LIMIT 10
  ) recent;

  -- Dacă nu există istoric, e OK (primul pontaj)
  IF _device_count = 0 THEN
    RETURN NEW;
  END IF;

  -- Obține ultimul dispozitiv folosit
  SELECT device_id INTO _last_used_device
  FROM public.time_entries
  WHERE user_id = NEW.user_id
    AND device_id IS NOT NULL
    AND id != NEW.id
  ORDER BY clock_in_time DESC
  LIMIT 1;

  -- Dacă dispozitivul curent NU este în lista celor cunoscute
  IF NOT (NEW.device_id = ANY(_previous_devices)) THEN
    INSERT INTO public.security_alerts (
      alert_type,
      severity,
      message,
      user_id,
      time_entry_id,
      details
    ) VALUES (
      'device_change',
      'medium',
      format('Pontaj din dispozitiv nou detectat (ultimul folosit: %s)',
        COALESCE(_last_used_device, 'necunoscut')
      ),
      NEW.user_id,
      NEW.id,
      jsonb_build_object(
        'new_device_id', NEW.device_id,
        'previous_device_id', _last_used_device,
        'known_devices_count', _device_count,
        'known_devices', _previous_devices,
        'timestamp', NEW.clock_in_time
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Attach trigger to time_entries
DROP TRIGGER IF EXISTS trigger_detect_device_change ON public.time_entries;
CREATE TRIGGER trigger_detect_device_change
  AFTER INSERT ON public.time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.detect_device_change();

-- =====================================================
-- INDEX pentru performanță
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_security_alerts_user_created 
  ON public.security_alerts(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_alerts_resolved_created 
  ON public.security_alerts(resolved, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_time_entries_user_clock_in 
  ON public.time_entries(user_id, clock_in_time DESC);