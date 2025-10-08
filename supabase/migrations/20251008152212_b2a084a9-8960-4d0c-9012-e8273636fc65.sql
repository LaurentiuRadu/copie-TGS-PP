-- Curățare date: actualizează user_password_tracking pentru utilizatorii care au schimbat deja parola
-- Setăm must_change_password = false și is_default_password = false pentru toți utilizatorii
-- care au password_changed_at setat (au schimbat deja parola)

UPDATE public.user_password_tracking
SET 
  must_change_password = false,
  is_default_password = false
WHERE must_change_password = true
  AND password_changed_at IS NOT NULL;

-- Log acțiunea
DO $$
DECLARE
  _affected_count INTEGER;
BEGIN
  GET DIAGNOSTICS _affected_count = ROW_COUNT;
  
  RAISE NOTICE 'Actualizat % utilizatori care au schimbat deja parola dar aveau must_change_password = true', _affected_count;
END $$;