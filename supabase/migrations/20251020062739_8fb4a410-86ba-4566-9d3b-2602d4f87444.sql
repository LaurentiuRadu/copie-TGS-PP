-- Fix pentru chiticaruflorin: actualizează locația din "5200 Kaufland Bacau" în "Toata Romania"
-- Aceasta va permite pontajul folosind locația country-wide existentă

UPDATE public.weekly_schedules
SET 
  location = 'Toata Romania',
  updated_at = now()
WHERE user_id = '91ff75be-e86a-4e41-9fb4-e21c85a5d09e'
  AND location = '5200 Kaufland Bacau'
  AND week_start_date >= '2025-10-14';

-- Verificare: afișează înregistrările actualizate
SELECT 
  id, 
  week_start_date, 
  day_of_week,
  location,
  shift_type
FROM public.weekly_schedules
WHERE user_id = '91ff75be-e86a-4e41-9fb4-e21c85a5d09e'
  AND week_start_date >= '2025-10-14'
ORDER BY week_start_date, day_of_week;