-- Phase 1: Critical Security Fixes
-- Fix privilege escalation and data exposure vulnerabilities

-- ============================================================================
-- FIX 1: Secure user_roles table - Prevent privilege escalation
-- ============================================================================

-- Drop the dangerous policy that allows users to self-assign roles
DROP POLICY IF EXISTS "Users can insert their own role testing" ON public.user_roles;

-- Create admin-only policies for role management
CREATE POLICY "Only admins can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Only admins can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- FIX 2: Secure profiles table - Prevent unauthorized data modification
-- ============================================================================

-- Drop the incomplete UPDATE policy
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Create a secure UPDATE policy with explicit WITH CHECK clause
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Add admin UPDATE policy for profiles
CREATE POLICY "Admins can update all profiles"
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));