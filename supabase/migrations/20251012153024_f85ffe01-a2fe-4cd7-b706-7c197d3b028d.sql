-- Drop existing check constraint
ALTER TABLE public.vacation_requests DROP CONSTRAINT IF EXISTS vacation_requests_status_check;

-- Add new check constraint including 'withdrawn'
ALTER TABLE public.vacation_requests ADD CONSTRAINT vacation_requests_status_check 
  CHECK (status IN ('pending', 'approved', 'rejected', 'withdrawn'));