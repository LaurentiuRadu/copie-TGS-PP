/*
  # Update Admin Password and Create Employee User

  1. Purpose
    - Update existing admin user password from TEMP_PASSWORD_123 to 123456
    - Create new employee user with username 'laurentiuradu'

  2. Changes
    - Updates password for laurentiu.radu@tgservices.ro
    - Creates laurentiuradu@company.local with employee role
    - Both users can login with password: 123456

  3. Security
    - Admin has full system access via /admin-login
    - Employee has mobile/pontaj access via / (main login)
    - Both passwords should be changed after first login in production
*/

DO $$
DECLARE
  admin_user_id uuid;
  employee_user_id uuid;
BEGIN
  -- 1. Update admin password
  UPDATE auth.users 
  SET 
    encrypted_password = crypt('123456', gen_salt('bf')),
    updated_at = now()
  WHERE email = 'laurentiu.radu@tgservices.ro'
  RETURNING id INTO admin_user_id;
  
  IF admin_user_id IS NOT NULL THEN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Admin password updated successfully!';
    RAISE NOTICE 'Email: laurentiu.radu@tgservices.ro';
    RAISE NOTICE 'New Password: 123456';
    RAISE NOTICE 'Login at: /admin-login';
    RAISE NOTICE '========================================';
  ELSE
    RAISE NOTICE 'Admin user not found, skipping password update';
  END IF;
  
  -- 2. Create employee user if not exists
  SELECT id INTO employee_user_id 
  FROM auth.users 
  WHERE email = 'laurentiuradu@company.local';
  
  IF employee_user_id IS NULL THEN
    -- Generate new UUID
    employee_user_id := gen_random_uuid();
    
    -- Insert into auth.users
    INSERT INTO auth.users (
      id,
      email,
      encrypted_password,
      email_confirmed_at,
      aud,
      role,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      is_super_admin
    ) VALUES (
      employee_user_id,
      'laurentiuradu@company.local',
      crypt('123456', gen_salt('bf')),
      now(),
      'authenticated',
      'authenticated',
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"Laurentiu Radu","username":"laurentiuradu"}'::jsonb,
      now(),
      now(),
      '',
      false
    );
    
    -- Create identity
    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      provider,
      identity_data,
      last_sign_in_at,
      created_at,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      employee_user_id,
      employee_user_id::text,
      'email',
      format('{"sub":"%s","email":"%s"}', employee_user_id, 'laurentiuradu@company.local')::jsonb,
      now(),
      now(),
      now()
    );
    
    -- Assign employee role
    INSERT INTO user_roles (user_id, role)
    VALUES (employee_user_id, 'employee')
    ON CONFLICT (user_id) DO NOTHING;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Employee user created successfully!';
    RAISE NOTICE 'Username: laurentiuradu';
    RAISE NOTICE 'Email: laurentiuradu@company.local';
    RAISE NOTICE 'Password: 123456';
    RAISE NOTICE 'Login at: / (main page)';
    RAISE NOTICE 'User ID: %', employee_user_id;
    RAISE NOTICE '========================================';
  ELSE
    -- Update password if user exists
    UPDATE auth.users 
    SET 
      encrypted_password = crypt('123456', gen_salt('bf')),
      updated_at = now()
    WHERE id = employee_user_id;
    
    RAISE NOTICE 'Employee user already exists, password updated to: 123456';
  END IF;
  
  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'SUMMARY - Two accounts created:';
  RAISE NOTICE '';
  RAISE NOTICE '1. ADMIN ACCESS:';
  RAISE NOTICE '   URL: /admin-login';
  RAISE NOTICE '   Email: laurentiu.radu@tgservices.ro';
  RAISE NOTICE '   Password: 123456';
  RAISE NOTICE '';
  RAISE NOTICE '2. EMPLOYEE ACCESS:';
  RAISE NOTICE '   URL: / (main page)';
  RAISE NOTICE '   Username: laurentiuradu';
  RAISE NOTICE '   Password: 123456';
  RAISE NOTICE '========================================';
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error: %', SQLERRM;
  RAISE EXCEPTION 'Failed to create users: %', SQLERRM;
END $$;
