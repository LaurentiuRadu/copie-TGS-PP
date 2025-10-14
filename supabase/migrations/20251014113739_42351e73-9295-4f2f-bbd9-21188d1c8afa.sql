-- Marchează personalul de birou corect
UPDATE public.profiles 
SET is_office_staff = true
WHERE username IN ('madalinaghintuiala', 'laurentiuradu');