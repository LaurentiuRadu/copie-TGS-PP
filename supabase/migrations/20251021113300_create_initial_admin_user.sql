/*
  # Create Initial Admin User

  1. Purpose
    - Creates the first administrator account for the system
    - Email: laurentiu.radu@tgservices.ro
    - Password: TEMP_PASSWORD_123

  2. Changes
    - Uses Supabase auth.users structure properly
    - Assigns admin role in user_roles table
    - Email is pre-confirmed for immediate access

  3. Security
    - User should change password after first login
    - Admin role grants full system access
*/

DO $$
DECLARE
  new_user_id uuid;
BEGIN
  -- Create admin user with a simple approach
  -- Generate a new UUID for the user
  new_user_id := gen_random_uuid();
  
  -- Insert into auth.users with minimal required fields
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
    new_user_id,
    'laurentiu.radu@tgservices.ro',
    crypt('TEMP_PASSWORD_123', gen_salt('bf')),
    now(),
    'authenticated',
    'authenticated',
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Laurentiu Radu"}'::jsonb,
    now(),
    now(),
    '',
    false
  );
  
  -- Create identity for the user
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
    new_user_id,
    new_user_id::text,
    'email',
    format('{"sub":"%s","email":"%s"}', new_user_id, 'laurentiu.radu@tgservices.ro')::jsonb,
    now(),
    now(),
    now()
  );
  
  -- Assign admin role
  INSERT INTO user_roles (user_id, role)
  VALUES (new_user_id, 'admin');
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Admin user created successfully!';
  RAISE NOTICE 'Email: laurentiu.radu@tgservices.ro';
  RAISE NOTICE 'Password: TEMP_PASSWORD_123';
  RAISE NOTICE 'User ID: %', new_user_id;
  RAISE NOTICE '========================================';
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error creating admin user: %', SQLERRM;
END $$;