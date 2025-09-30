-- Allow authenticated users to insert their own role (testing only)
DROP POLICY IF EXISTS "Users can insert their own role (testing)" ON public.user_roles;

CREATE POLICY "Users can insert their own role testing"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);