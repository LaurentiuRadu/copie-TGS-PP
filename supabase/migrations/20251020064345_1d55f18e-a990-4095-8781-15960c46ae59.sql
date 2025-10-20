-- Fix pentru canbeirazvan: actualizează locațiile în "Toata Romania"
-- Aceasta va permite pontajul folosind locația country-wide existentă

UPDATE public.weekly_schedules
SET 
  location = 'Toata Romania',
  updated_at = now()
WHERE user_id = '1e80bc8e-c29e-4ae4-af24-bca8d1e97eb9'
  AND location IN ('1970 Kaufland Tecuci', 'Sediu TGS Letea')
  AND week_start_date >= '2025-10-14';

-- Verificare: afișează înregistrările actualizate
SELECT 
  id, 
  week_start_date, 
  day_of_week,
  location,
  shift_type,
  team_id
FROM public.weekly_schedules
WHERE user_id = '1e80bc8e-c29e-4ae4-af24-bca8d1e97eb9'
  AND week_start_date >= '2025-10-14'
ORDER BY week_start_date, day_of_week;