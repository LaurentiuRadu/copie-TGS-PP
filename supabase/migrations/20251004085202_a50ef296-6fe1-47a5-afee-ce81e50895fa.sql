-- Tabel pentru tracking parole utilizatori
CREATE TABLE IF NOT EXISTS public.user_password_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  password_changed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  must_change_password BOOLEAN DEFAULT false,
  is_default_password BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- RLS policies pentru user_password_tracking
ALTER TABLE public.user_password_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own password tracking"
  ON public.user_password_tracking FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own password tracking"
  ON public.user_password_tracking FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert password tracking"
  ON public.user_password_tracking FOR INSERT
  WITH CHECK (true);

-- Modifică trigger-ul existent handle_new_user pentru a include password tracking
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (id, username, full_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'full_name'
  );
  
  -- Insert password tracking pentru utilizatori noi
  INSERT INTO public.user_password_tracking (user_id, must_change_password, is_default_password)
  VALUES (NEW.id, true, true);
  
  RETURN NEW;
END;
$$;

-- Tabel pentru push notification subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id)
);

-- RLS policies pentru push_subscriptions
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own subscriptions"
  ON public.push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions"
  ON public.push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions"
  ON public.push_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own subscriptions"
  ON public.push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger pentru actualizare automată updated_at
CREATE TRIGGER update_push_subscriptions_updated_at
  BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();