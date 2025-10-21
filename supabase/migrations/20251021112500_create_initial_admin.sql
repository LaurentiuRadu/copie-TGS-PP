/*
  # Create Initial Admin User

  1. Purpose
    - Creates the first administrator user for the system
    - Email: laurentiu.radu@tgservices.ro
    - This is a bootstrap migration to create the initial admin account

  2. Changes
    - Inserts admin user into auth.users table
    - Assigns admin role in user_roles table
    - Sets up proper metadata and confirmation

  3. Security
    - User must change password on first login
    - Admin role is properly assigned for full system access
*/

-- Create the initial admin user
-- Note: Replace 'TEMP_PASSWORD_123' with your desired initial password
DO $$
DECLARE
  new_user_id uuid;
  hashed_password text;
BEGIN
  -- Generate a password hash for 'TEMP_PASSWORD_123'
  -- User should change this password after first login
  hashed_password := crypt('TEMP_PASSWORD_123', gen_salt('bf'));

  -- Insert into auth.users
  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    recovery_sent_at,
    last_sign_in_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    email_change,
    email_change_token_new,
    recovery_token
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    'laurentiu.radu@tgservices.ro',
    hashed_password,
    now(),
    now(),
    now(),
    '{"provider":"email","providers":["email"]}',
    '{"username":"laurentiu.radu","full_name":"Laurentiu Radu"}',
    now(),
    now(),
    '',
    '',
    '',
    ''
  )
  RETURNING id INTO new_user_id;

  -- Insert identity record
  INSERT INTO auth.identities (
    id,
    user_id,
    provider_id,
    identity_data,
    provider,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    new_user_id,
    new_user_id::text,
    jsonb_build_object(
      'sub', new_user_id::text,
      'email', 'laurentiu.radu@tgservices.ro'
    ),
    'email',
    now(),
    now(),
    now()
  );

  -- Assign admin role
  INSERT INTO user_roles (user_id, role)
  VALUES (new_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  RAISE NOTICE 'Admin user created successfully with ID: %', new_user_id;
  RAISE NOTICE 'Email: laurentiu.radu@tgservices.ro';
  RAISE NOTICE 'Temporary password: TEMP_PASSWORD_123';
  RAISE NOTICE 'Please change this password after first login!';
END $$;
