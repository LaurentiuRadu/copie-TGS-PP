-- Tabel pentru tracking sold concedii pe ani
CREATE TABLE public.vacation_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  year INTEGER NOT NULL,
  total_days INTEGER NOT NULL DEFAULT 20,
  used_days INTEGER NOT NULL DEFAULT 0,
  pending_days INTEGER NOT NULL DEFAULT 0,
  remaining_days INTEGER GENERATED ALWAYS AS (total_days - used_days - pending_days) STORED,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, year)
);

-- Enable RLS
ALTER TABLE public.vacation_balances ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own vacation balance"
  ON public.vacation_balances FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all vacation balances"
  ON public.vacation_balances FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert vacation balances"
  ON public.vacation_balances FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update vacation balances"
  ON public.vacation_balances FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete vacation balances"
  ON public.vacation_balances FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Trigger pentru actualizare automată la aprobare/respingere cerere
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
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER vacation_balance_update_trigger
AFTER INSERT OR UPDATE ON public.vacation_requests
FOR EACH ROW
WHEN (NEW.type = 'vacation')
EXECUTE FUNCTION public.update_vacation_balance_on_request_change();

-- Funcție pentru inițializare manuală sold 2025 (apel manual de admin)
CREATE OR REPLACE FUNCTION public.init_vacation_balance_2025(
  _user_id UUID,
  _used_days INTEGER DEFAULT 0
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verifică dacă user este admin
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Only admins can initialize vacation balances';
  END IF;
  
  -- Inserează sau actualizează sold pentru 2025
  INSERT INTO public.vacation_balances (user_id, year, total_days, used_days, pending_days, notes)
  VALUES (_user_id, 2025, 20, _used_days, 0, 'Sold inițial setat manual pentru 2025')
  ON CONFLICT (user_id, year) 
  DO UPDATE SET 
    used_days = _used_days,
    notes = 'Sold actualizat manual pentru 2025',
    updated_at = now();
END;
$$;

-- Index pentru performanță
CREATE INDEX idx_vacation_balances_user_year ON public.vacation_balances(user_id, year);
CREATE INDEX idx_vacation_requests_type_status ON public.vacation_requests(type, status);