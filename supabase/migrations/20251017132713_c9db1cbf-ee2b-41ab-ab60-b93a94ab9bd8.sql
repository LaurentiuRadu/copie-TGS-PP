-- ✅ CONTEXT: Fix pentru eroarea "Nu s-a putut adăuga pontajul"
-- PROBLEMA: Admini nu puteau insera pontaje în numele altor utilizatori
-- SOLUȚIE: Politică RLS care permite adminilor să insereze pentru orice user_id
-- SECURITATE: Utilizatorii normali pot insera doar pentru auth.uid() = user_id
-- DATA: 2025-10-17
-- RELATED: AddMissingEntryDialog.tsx, TeamTimeApprovalManager.tsx

CREATE POLICY "Admins can insert time entries for any user"
ON public.time_entries
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));