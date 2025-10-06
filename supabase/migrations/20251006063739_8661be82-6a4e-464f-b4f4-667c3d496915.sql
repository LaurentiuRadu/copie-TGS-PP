-- Enable RLS on existing GDPR tables if not already enabled
ALTER TABLE public.gdpr_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for gdpr_requests (if they don't exist)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'gdpr_requests' AND policyname = 'Users can view their own GDPR requests'
  ) THEN
    CREATE POLICY "Users can view their own GDPR requests" 
    ON public.gdpr_requests 
    FOR SELECT 
    USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'gdpr_requests' AND policyname = 'Users can create their own GDPR requests'
  ) THEN
    CREATE POLICY "Users can create their own GDPR requests" 
    ON public.gdpr_requests 
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'gdpr_requests' AND policyname = 'Admins can view all GDPR requests'
  ) THEN
    CREATE POLICY "Admins can view all GDPR requests" 
    ON public.gdpr_requests 
    FOR SELECT 
    USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'gdpr_requests' AND policyname = 'Admins can update GDPR requests'
  ) THEN
    CREATE POLICY "Admins can update GDPR requests" 
    ON public.gdpr_requests 
    FOR UPDATE 
    USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;

-- Create RLS policies for user_consents (if they don't exist)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_consents' AND policyname = 'Users can view their own consents'
  ) THEN
    CREATE POLICY "Users can view their own consents" 
    ON public.user_consents 
    FOR SELECT 
    USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_consents' AND policyname = 'Users can insert their own consents'
  ) THEN
    CREATE POLICY "Users can insert their own consents" 
    ON public.user_consents 
    FOR INSERT 
    WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_consents' AND policyname = 'Users can update their own consents'
  ) THEN
    CREATE POLICY "Users can update their own consents" 
    ON public.user_consents 
    FOR UPDATE 
    USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'user_consents' AND policyname = 'Admins can view all consents'
  ) THEN
    CREATE POLICY "Admins can view all consents" 
    ON public.user_consents 
    FOR SELECT 
    USING (has_role(auth.uid(), 'admin'::app_role));
  END IF;
END $$;