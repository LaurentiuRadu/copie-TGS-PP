-- Delete demo admin and employee accounts
DELETE FROM public.user_roles 
WHERE user_id IN (
  SELECT id FROM auth.users 
  WHERE email IN ('demoadmin@test.com', 'demoangajat@employee.local')
);

DELETE FROM public.profiles 
WHERE id IN (
  SELECT id FROM auth.users 
  WHERE email IN ('demoadmin@test.com', 'demoangajat@employee.local')
) OR username = 'demoangajat';

-- Note: Deleting from auth.users will cascade to profiles due to foreign key
DELETE FROM auth.users 
WHERE email IN ('demoadmin@test.com', 'demoangajat@employee.local');