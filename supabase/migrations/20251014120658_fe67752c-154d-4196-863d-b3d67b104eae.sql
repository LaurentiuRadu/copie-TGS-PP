-- Marchează contractorii externi rămași
UPDATE public.profiles 
SET is_external_contractor = true
WHERE username IN ('sanduflorin', 'mirelaxen');