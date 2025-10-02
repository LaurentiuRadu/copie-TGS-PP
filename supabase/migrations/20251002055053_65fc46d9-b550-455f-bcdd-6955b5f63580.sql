-- Update auth email to match the new username for Ghintuiala Georgiana Madalina
UPDATE auth.users
SET email = 'ghintuialamadalina@employee.local',
    raw_user_meta_data = jsonb_set(
      raw_user_meta_data,
      '{username}',
      '"ghintuialamadalina"'
    )
WHERE email = 'ghintuialageorgiana@employee.local';