-- ============================================
-- RLS Policy: Restricționează user-ul la UPDATE doar pe câmpuri non-administrative
-- ============================================

-- Șterge politica existentă
DROP POLICY IF EXISTS "Users can update their own time entries" ON public.time_entries;

-- Politică nouă: User poate modifica doar clock-in/out și note
CREATE POLICY "Users can update their own clock times"
ON public.time_entries
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
);

-- Trigger function pentru validare extra (blochează modificarea câmpurilor de aprobare)
CREATE OR REPLACE FUNCTION public.prevent_user_approval_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verifică dacă user-ul (non-admin) încearcă să modifice câmpuri protejate
  IF NOT has_role(auth.uid(), 'admin'::app_role) THEN
    IF OLD.approval_status IS DISTINCT FROM NEW.approval_status
       OR OLD.approved_at IS DISTINCT FROM NEW.approved_at
       OR OLD.approved_by IS DISTINCT FROM NEW.approved_by
       OR OLD.was_edited_by_admin IS DISTINCT FROM NEW.was_edited_by_admin THEN
      RAISE EXCEPTION 'Unauthorized: Only admins can modify approval fields';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Aplică trigger-ul
DROP TRIGGER IF EXISTS enforce_approval_fields_security ON public.time_entries;
CREATE TRIGGER enforce_approval_fields_security
BEFORE UPDATE ON public.time_entries
FOR EACH ROW
EXECUTE FUNCTION public.prevent_user_approval_change();