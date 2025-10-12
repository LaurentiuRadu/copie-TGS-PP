-- Actualizare funcție DB pentru balance: suport withdrawn status
CREATE OR REPLACE FUNCTION public.update_vacation_balance_on_request_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _year INTEGER;
  _balance_exists BOOLEAN;
BEGIN
  -- Extrage anul din start_date
  _year := EXTRACT(YEAR FROM NEW.start_date);
  
  -- Verifică dacă există sold pentru acest an
  SELECT EXISTS(
    SELECT 1 FROM public.vacation_balances 
    WHERE user_id = NEW.user_id AND year = _year
  ) INTO _balance_exists;
  
  -- Dacă nu există sold, creează unul
  IF NOT _balance_exists THEN
    INSERT INTO public.vacation_balances (user_id, year, total_days, used_days, pending_days)
    VALUES (NEW.user_id, _year, 20, 0, 0);
  END IF;
  
  -- Actualizează sold bazat pe status
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    -- Cerere aprobată: mută din pending în used (doar pentru CO)
    IF NEW.type = 'vacation' THEN
      UPDATE public.vacation_balances
      SET 
        used_days = used_days + NEW.days_count,
        pending_days = GREATEST(0, pending_days - NEW.days_count),
        updated_at = now()
      WHERE user_id = NEW.user_id AND year = _year;
    END IF;
    
  ELSIF NEW.status = 'rejected' AND (OLD.status IS NULL OR OLD.status = 'pending') THEN
    -- Cerere respinsă: reduce pending (doar pentru CO)
    IF NEW.type = 'vacation' THEN
      UPDATE public.vacation_balances
      SET 
        pending_days = GREATEST(0, pending_days - NEW.days_count),
        updated_at = now()
      WHERE user_id = NEW.user_id AND year = _year;
    END IF;
    
  ELSIF NEW.status = 'pending' AND (OLD.status IS NULL OR OLD.status = 'rejected') THEN
    -- Cerere pending: adaugă la pending (doar pentru CO)
    IF NEW.type = 'vacation' THEN
      UPDATE public.vacation_balances
      SET 
        pending_days = pending_days + NEW.days_count,
        updated_at = now()
      WHERE user_id = NEW.user_id AND year = _year;
    END IF;
    
  ELSIF NEW.status = 'withdrawn' AND OLD.status = 'approved' THEN
    -- Cerere retrasă din aprobat: reduce used_days (doar pentru CO)
    IF NEW.type = 'vacation' THEN
      UPDATE public.vacation_balances
      SET 
        used_days = GREATEST(0, used_days - NEW.days_count),
        updated_at = now()
      WHERE user_id = NEW.user_id AND year = _year;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;