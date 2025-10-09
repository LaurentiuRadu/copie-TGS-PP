-- Corectează numele pentru cei doi angajați care cauzează erori la import
UPDATE public.profiles 
SET full_name = 'COSTACHE FLORIN CATALIN',
    updated_at = now()
WHERE id = 'd94c0864-ce6d-4118-8911-197922bd9d3e';

UPDATE public.profiles 
SET full_name = 'JIMBU GHEORGHITA GABRIEL',
    updated_at = now()
WHERE id = 'c4b58f59-7357-430b-9d59-7ff3cfac8446';

-- Log acțiunea de corecție
INSERT INTO public.audit_logs (user_id, action, resource_type, details)
VALUES 
  ('d94c0864-ce6d-4118-8911-197922bd9d3e', 'update_profile_name', 'profile', 
   jsonb_build_object('old_name', 'Florin Costache', 'new_name', 'COSTACHE FLORIN CATALIN', 'reason', 'payroll_import_name_correction')),
  ('c4b58f59-7357-430b-9d59-7ff3cfac8446', 'update_profile_name', 'profile', 
   jsonb_build_object('old_name', 'JIMBU GABRIEL', 'new_name', 'JIMBU GHEORGHITA GABRIEL', 'reason', 'payroll_import_name_correction'));