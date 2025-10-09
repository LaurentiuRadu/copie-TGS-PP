-- Actualizare nume pentru corectarea inversărilor (format CSV: NUME PRENUME MIJLOCIU)
-- Doar pentru cei 4 angajați identificați

UPDATE public.profiles 
SET full_name = 'APOSTU CATALINA',
    updated_at = now()
WHERE full_name = 'Catalina Apostu';

UPDATE public.profiles 
SET full_name = 'COSTACHE FLORIN CATALIN',
    updated_at = now()
WHERE full_name = 'Florin Costache';

UPDATE public.profiles 
SET full_name = 'GHINTUIALA GEORGIANA MADALINA',
    updated_at = now()
WHERE full_name = 'Madalina Ghintuiala';

UPDATE public.profiles 
SET full_name = 'RADU IOAN LAURENTIU',
    updated_at = now()
WHERE full_name = 'IOAN LAURENTIU RADU';

-- Log actualizările în audit_logs
DO $$
DECLARE
  _admin_id uuid;
BEGIN
  -- Presupunem că admin-ul execută această actualizare
  SELECT id INTO _admin_id FROM auth.users LIMIT 1;
  
  INSERT INTO public.audit_logs (user_id, action, resource_type, details)
  VALUES (
    _admin_id,
    'bulk_update_employee_names',
    'profiles',
    jsonb_build_object(
      'reason', 'Aliniere format nume pentru import payroll (NUME PRENUME)',
      'updated_count', 4,
      'timestamp', now()
    )
  );
END $$;