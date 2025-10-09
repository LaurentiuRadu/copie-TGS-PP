-- Fix: Change tardiness_reports foreign keys to reference profiles instead of auth.users
-- This allows PostgREST to detect the relationship for embedded queries

-- 1. Drop existing foreign keys to auth.users
ALTER TABLE public.tardiness_reports
DROP CONSTRAINT IF EXISTS tardiness_reports_user_id_fkey;

ALTER TABLE public.tardiness_reports
DROP CONSTRAINT IF EXISTS tardiness_reports_reviewed_by_fkey;

-- 2. Add new foreign keys to profiles
ALTER TABLE public.tardiness_reports
ADD CONSTRAINT tardiness_reports_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;

ALTER TABLE public.tardiness_reports
ADD CONSTRAINT tardiness_reports_reviewed_by_fkey
FOREIGN KEY (reviewed_by)
REFERENCES public.profiles(id)
ON DELETE SET NULL;