-- Ștergere utilizatori demo din baza de date

-- Șterg rolurile utilizatorilor demo
DELETE FROM user_roles 
WHERE user_id IN (
  SELECT id FROM profiles 
  WHERE username = 'demoangajat' 
     OR username LIKE '%demo%'
     OR full_name LIKE '%Demo%'
);

-- Șterg profilurile utilizatorilor demo
DELETE FROM profiles 
WHERE username = 'demoangajat' 
   OR username LIKE '%demo%'
   OR full_name LIKE '%Demo%';