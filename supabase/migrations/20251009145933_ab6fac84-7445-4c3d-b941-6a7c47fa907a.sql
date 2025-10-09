-- Fix: Change user_roles foreign key to reference profiles instead of auth.users
-- This allows PostgREST to detect the relationship for embedded queries

-- 1. Drop existing foreign key to auth.users
ALTER TABLE public.user_roles
DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;

-- 2. Add new foreign key to profiles
ALTER TABLE public.user_roles
ADD CONSTRAINT user_roles_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES public.profiles(id)
ON DELETE CASCADE;