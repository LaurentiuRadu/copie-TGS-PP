/*
  # Complete User Reset - Clean Slate

  1. Purpose
    - Remove ALL existing users and sessions
    - Create fresh admin user from scratch
    - Ensure clean state for authentication

  2. Changes
    - Delete all user_roles
    - Delete all auth.sessions
    - Delete all auth.identities
    - Delete all auth.users
    - Create new admin user with ID and correct password

  3. Security
    - Admin can login at /admin-login
    - Email: laurentiu.radu@tgservices.ro
    - Password: 123456
*/

DO $$
DECLARE
  new_admin_id uuid := '00000000-0000-0000-0000-000000000001'::uuid;
BEGIN
  -- 1. Delete everything (cascade will handle dependencies)
  RAISE NOTICE 'Deleting all existing users...';

  DELETE FROM user_roles;
  DELETE FROM auth.sessions;
  DELETE FROM auth.identities;
  DELETE FROM auth.users;

  RAISE NOTICE 'All users deleted. Creating fresh admin...';

  -- 2. Create admin user
  INSERT INTO auth.users (
    id,
    email,
    encrypted_password,
    email_confirmed_at,
    confirmed_at,
    aud,
    role,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    is_super_admin
  ) VALUES (
    new_admin_id,
    'laurentiu.radu@tgservices.ro',
    crypt('123456', gen_salt('bf', 6)),
    now(),
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

  -- 3. Create identity
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
    new_admin_id,
    new_admin_id::text,
    'email',
    format('{"sub":"%s","email":"%s"}', new_admin_id, 'laurentiu.radu@tgservices.ro')::jsonb,
    now(),
    now(),
    now()
  );

  -- 4. Assign admin role
  INSERT INTO user_roles (user_id, role)
  VALUES (new_admin_id, 'admin');

  RAISE NOTICE '';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'FRESH ADMIN USER CREATED';
  RAISE NOTICE '';
  RAISE NOTICE 'Login URL: /admin-login';
  RAISE NOTICE 'Email: laurentiu.radu@tgservices.ro';
  RAISE NOTICE 'Password: 123456';
  RAISE NOTICE 'User ID: %', new_admin_id;
  RAISE NOTICE '========================================';

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error: %', SQLERRM;
  RAISE EXCEPTION 'Failed to reset users: %', SQLERRM;
END $$;
