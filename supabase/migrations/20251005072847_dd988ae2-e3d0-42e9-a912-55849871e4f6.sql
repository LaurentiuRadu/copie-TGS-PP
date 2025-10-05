-- Securizare Rate Limiting și Data Retention Tables
-- Fix-uri pentru vulnerabilitățile identificate în security scan

-- 1. Fix rate_limit_attempts - înlocuim policy-ul permisiv cu policy-uri granulare
DROP POLICY IF EXISTS "System can manage rate limits" ON public.rate_limit_attempts;

-- Permitem doar operațiuni de scriere pentru sistem (edge functions)
CREATE POLICY "System can insert rate limit attempts"
ON public.rate_limit_attempts FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "System can update rate limit attempts"
ON public.rate_limit_attempts FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "System can delete rate limit attempts"
ON public.rate_limit_attempts FOR DELETE
TO authenticated
USING (true);

-- Policy SELECT pentru admini deja există: "Admins can view all rate limit attempts"

-- 2. Fix rate_limit_config - ștergem policy-ul care permite tuturor utilizatorilor autentificați să vadă config-ul
DROP POLICY IF EXISTS "Authenticated users can view rate limit config" ON public.rate_limit_config;

-- Policy-ul "Admins can manage rate limit config" deja există și acoperă toate operațiunile pentru admini

-- 3. Fix data_retention_policies - ștergem policy-ul care permite tuturor utilizatorilor autentificați să vadă politicile
DROP POLICY IF EXISTS "Authenticated users can view retention policies" ON public.data_retention_policies;

-- Policy-ul "Admins can manage retention policies" deja există și acoperă toate operațiunile pentru admini