-- Performance Indexes pentru scalabilitate 40+ angajați
-- Index pentru time_entries - cel mai folosit query
CREATE INDEX IF NOT EXISTS idx_time_entries_user_clock_in 
ON time_entries(user_id, clock_in_time DESC);

-- Index pentru time_entries cu clock_out pentru queries active entries
CREATE INDEX IF NOT EXISTS idx_time_entries_clock_out 
ON time_entries(clock_out_time) 
WHERE clock_out_time IS NULL;

-- Index pentru vacation_requests
CREATE INDEX IF NOT EXISTS idx_vacation_requests_user_created 
ON vacation_requests(user_id, created_at DESC);

-- Index pentru vacation_requests status pentru admin view
CREATE INDEX IF NOT EXISTS idx_vacation_requests_status 
ON vacation_requests(status, created_at DESC);

-- Index pentru user_roles - folosit în RLS policies
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role 
ON user_roles(user_id, role);

-- Index pentru time_entry_segments
CREATE INDEX IF NOT EXISTS idx_time_entry_segments_entry 
ON time_entry_segments(time_entry_id);

-- Index pentru security_alerts pentru admin dashboard
CREATE INDEX IF NOT EXISTS idx_security_alerts_resolved 
ON security_alerts(resolved, created_at DESC);

-- Index pentru face_verification_logs
CREATE INDEX IF NOT EXISTS idx_face_verification_user_time 
ON face_verification_logs(user_id, created_at DESC);

-- Optimizare RLS: Security definer function pentru has_role cu cache
CREATE OR REPLACE FUNCTION public.has_role_cached(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Fix security issue: Restricționăm work_locations doar la utilizatori autentificați
DROP POLICY IF EXISTS "Anyone can view active work locations" ON work_locations;

CREATE POLICY "Authenticated users can view active work locations" 
ON work_locations 
FOR SELECT 
TO authenticated
USING (is_active = true);

-- Optimizare: materialized view pentru statistici rapide (optional, pentru dashboard admin)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_daily_stats AS
SELECT 
  DATE(clock_in_time) as work_date,
  user_id,
  COUNT(*) as entries_count,
  SUM(EXTRACT(EPOCH FROM (COALESCE(clock_out_time, NOW()) - clock_in_time))/3600) as total_hours
FROM time_entries
WHERE clock_in_time >= NOW() - INTERVAL '90 days'
GROUP BY DATE(clock_in_time), user_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_daily_stats_unique 
ON mv_daily_stats(work_date, user_id);

-- Function pentru refresh automat al statisticilor (apelat periodic sau prin trigger)
CREATE OR REPLACE FUNCTION refresh_daily_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_stats;
END;
$$;