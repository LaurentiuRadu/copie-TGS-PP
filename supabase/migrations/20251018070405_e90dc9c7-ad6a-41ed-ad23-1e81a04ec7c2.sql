-- Curățare mesaje securitate: elimină device fingerprints din mesajele de alertă

-- 1. Actualizează trigger-ul detect_device_change() pentru mesaj simplu
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
      AND id != NEW.id
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
      'Pontaj din dispozitiv nou detectat',  -- ✅ Mesaj simplu, fără cod
      NEW.user_id,
      NEW.id,
      jsonb_build_object(
        'new_device_id', NEW.device_id,
        'previous_device_id', _last_used_device,  -- Codul rămâne în details pentru admini
        'known_devices_count', _device_count,
        'known_devices', _previous_devices,
        'timestamp', NEW.clock_in_time
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Curăță mesajele existente: elimină device fingerprints din mesaje
UPDATE public.security_alerts
SET message = 'Pontaj din dispozitiv nou detectat'
WHERE alert_type = 'device_change'
  AND message LIKE '%ultimul folosit:%';

-- 3. Curăță și alte mesaje lungi care ar putea conține coduri (protecție extra)
UPDATE public.security_alerts
SET message = CASE
  -- Păstrează doar primele 200 caractere dacă mesajul e prea lung
  WHEN LENGTH(message) > 200 THEN SUBSTRING(message, 1, 200) || '...'
  ELSE message
END
WHERE LENGTH(message) > 200;