-- Fix security warnings

-- 1. Fix function search_path mutable
CREATE OR REPLACE FUNCTION refresh_daily_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY mv_daily_stats;
END;
$$;

-- 2. Revoke access to materialized view from API (pentru securitate)
REVOKE ALL ON mv_daily_stats FROM anon, authenticated;
GRANT SELECT ON mv_daily_stats TO service_role;

-- Doar service_role (backend) poate accesa materialized view
-- Frontend va folosi funcții dedicate pentru statistici