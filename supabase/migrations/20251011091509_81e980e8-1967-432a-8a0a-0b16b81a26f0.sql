-- Adăugare coloană approval_status în time_entries
ALTER TABLE public.time_entries 
ADD COLUMN approval_status TEXT DEFAULT 'pending_review'
CHECK (approval_status IN ('pending_review', 'approved', 'rejected', 'needs_correction'));

-- Adăugare coloane pentru tracking aprobare
ALTER TABLE public.time_entries
ADD COLUMN approved_by UUID REFERENCES auth.users(id),
ADD COLUMN approved_at TIMESTAMPTZ,
ADD COLUMN approval_notes TEXT;

-- Tabel nou pentru discrepanțe detectate în echipă
CREATE TABLE public.team_time_discrepancies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id TEXT NOT NULL,
  week_start_date DATE NOT NULL,
  time_entry_id UUID REFERENCES public.time_entries(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  discrepancy_type TEXT NOT NULL CHECK (discrepancy_type IN ('early_departure', 'late_arrival', 'missing_entry', 'excessive_hours', 'suspicious_location')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  expected_value TEXT,
  actual_value TEXT,
  notes TEXT,
  resolved BOOLEAN DEFAULT FALSE,
  resolved_by UUID REFERENCES auth.users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index-uri pentru performanță
CREATE INDEX idx_time_entries_approval_status ON public.time_entries(approval_status, clock_in_time);
CREATE INDEX idx_time_entries_pending_by_week ON public.time_entries(clock_in_time) 
  WHERE approval_status = 'pending_review';
CREATE INDEX idx_discrepancies_team_week ON public.team_time_discrepancies(team_id, week_start_date);
CREATE INDEX idx_discrepancies_unresolved ON public.team_time_discrepancies(resolved) 
  WHERE resolved = FALSE;

-- RLS pentru team_time_discrepancies
ALTER TABLE public.team_time_discrepancies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all discrepancies"
ON public.team_time_discrepancies FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert discrepancies"
ON public.team_time_discrepancies FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update discrepancies"
ON public.team_time_discrepancies FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- Funcție pentru auto-aprobare pontaje vechi (>7 zile)
CREATE OR REPLACE FUNCTION public.auto_approve_old_entries()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _approved_count INTEGER;
BEGIN
  -- Auto-aprobă pontajele > 7 zile care sunt complete (au clock_out)
  UPDATE public.time_entries
  SET 
    approval_status = 'approved',
    approved_at = NOW(),
    approval_notes = 'Auto-aprobat după 7 zile'
  WHERE approval_status = 'pending_review'
    AND clock_out_time IS NOT NULL
    AND clock_out_time < NOW() - INTERVAL '7 days';
  
  GET DIAGNOSTICS _approved_count = ROW_COUNT;
  
  -- Log acțiunea
  IF _approved_count > 0 THEN
    PERFORM public.log_sensitive_data_access(
      'auto_approve_old_entries',
      'time_entries',
      NULL,
      jsonb_build_object('approved_count', _approved_count)
    );
  END IF;
  
  RETURN _approved_count;
END;
$$;

-- Funcție pentru detectare automată discrepanțe în echipă
CREATE OR REPLACE FUNCTION public.detect_team_discrepancies(
  _team_id TEXT,
  _week_start_date DATE
)
RETURNS TABLE(
  time_entry_id UUID,
  user_id UUID,
  discrepancy_type TEXT,
  severity TEXT,
  expected_value TEXT,
  actual_value TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _avg_clock_in TIME;
  _avg_clock_out TIME;
  _threshold_minutes INTEGER := 30; -- 30 min diferență = discrepanță
BEGIN
  -- Calculează medie clock_in/out pentru echipă în săptămâna selectată
  SELECT 
    AVG(EXTRACT(EPOCH FROM clock_in_time::TIME) / 60)::INTEGER,
    AVG(EXTRACT(EPOCH FROM clock_out_time::TIME) / 60)::INTEGER
  INTO _avg_clock_in, _avg_clock_out
  FROM public.time_entries te
  JOIN public.weekly_schedules ws ON ws.user_id = te.user_id
  WHERE ws.team_id = _team_id
    AND ws.week_start_date = _week_start_date
    AND te.clock_in_time >= _week_start_date
    AND te.clock_in_time < _week_start_date + INTERVAL '7 days'
    AND te.approval_status = 'pending_review';

  -- Returnează discrepanțele
  RETURN QUERY
  SELECT 
    te.id,
    te.user_id,
    CASE
      WHEN EXTRACT(EPOCH FROM te.clock_in_time::TIME) / 60 - _avg_clock_in > _threshold_minutes 
        THEN 'late_arrival'::TEXT
      WHEN _avg_clock_out - EXTRACT(EPOCH FROM te.clock_out_time::TIME) / 60 > _threshold_minutes 
        THEN 'early_departure'::TEXT
      ELSE 'normal'::TEXT
    END,
    CASE
      WHEN ABS(EXTRACT(EPOCH FROM te.clock_in_time::TIME) / 60 - _avg_clock_in) > 60 
        OR ABS(_avg_clock_out - EXTRACT(EPOCH FROM te.clock_out_time::TIME) / 60) > 60
        THEN 'high'::TEXT
      WHEN ABS(EXTRACT(EPOCH FROM te.clock_in_time::TIME) / 60 - _avg_clock_in) > _threshold_minutes
        OR ABS(_avg_clock_out - EXTRACT(EPOCH FROM te.clock_out_time::TIME) / 60) > _threshold_minutes
        THEN 'medium'::TEXT
      ELSE 'low'::TEXT
    END,
    to_char(_avg_clock_in * INTERVAL '1 minute', 'HH24:MI'),
    to_char(te.clock_in_time, 'HH24:MI')
  FROM public.time_entries te
  JOIN public.weekly_schedules ws ON ws.user_id = te.user_id
  WHERE ws.team_id = _team_id
    AND ws.week_start_date = _week_start_date
    AND te.clock_in_time >= _week_start_date
    AND te.clock_in_time < _week_start_date + INTERVAL '7 days'
    AND te.approval_status = 'pending_review';
END;
$$;