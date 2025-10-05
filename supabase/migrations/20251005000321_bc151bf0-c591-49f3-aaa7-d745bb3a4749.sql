-- Phase 3: Audit & Monitoring (Fixed)
-- Add comprehensive audit logging and monitoring

-- ============================================================================
-- Create audit_logs table for tracking sensitive data access
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON public.audit_logs(resource_type);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view all audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- System can insert audit logs
CREATE POLICY "System can insert audit logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- ============================================================================
-- Update data_retention_policies constraint to include new types
-- ============================================================================

-- Drop existing constraint
ALTER TABLE public.data_retention_policies 
DROP CONSTRAINT IF EXISTS data_retention_policies_data_type_check;

-- Add new constraint with additional types
ALTER TABLE public.data_retention_policies
ADD CONSTRAINT data_retention_policies_data_type_check 
CHECK (data_type IN (
  'biometric_photos', 
  'gps_coordinates', 
  'time_entries', 
  'face_verifications',
  'audit_logs',
  'security_alerts',
  'gdpr_requests'
));

-- ============================================================================
-- Create function to log sensitive data access
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_sensitive_data_access(
  _action TEXT,
  _resource_type TEXT,
  _resource_id UUID,
  _details JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    details,
    created_at
  ) VALUES (
    auth.uid(),
    _action,
    _resource_type,
    _resource_id,
    _details,
    now()
  );
END;
$$;

-- ============================================================================
-- Add trigger for time_entries location data access monitoring
-- ============================================================================

CREATE OR REPLACE FUNCTION public.audit_location_access()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only log when admin accesses location data of other users
  IF auth.uid() != NEW.user_id AND public.has_role(auth.uid(), 'admin'::app_role) THEN
    PERFORM public.log_sensitive_data_access(
      'view_location_data',
      'time_entry',
      NEW.id,
      jsonb_build_object(
        'target_user_id', NEW.user_id,
        'has_gps_data', (NEW.clock_in_latitude IS NOT NULL OR NEW.clock_out_latitude IS NOT NULL)
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================================================
-- Enforce data retention policies
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_data_retention()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _policy RECORD;
  _deleted_count INTEGER;
BEGIN
  -- Loop through active retention policies
  FOR _policy IN 
    SELECT data_type, retention_days
    FROM public.data_retention_policies
    WHERE auto_delete_enabled = true
  LOOP
    CASE _policy.data_type
      WHEN 'audit_logs' THEN
        DELETE FROM public.audit_logs
        WHERE created_at < now() - (_policy.retention_days || ' days')::INTERVAL;
        GET DIAGNOSTICS _deleted_count = ROW_COUNT;
        
      WHEN 'security_alerts' THEN
        DELETE FROM public.security_alerts
        WHERE created_at < now() - (_policy.retention_days || ' days')::INTERVAL
          AND resolved = true;
        GET DIAGNOSTICS _deleted_count = ROW_COUNT;
        
      WHEN 'gdpr_requests' THEN
        DELETE FROM public.gdpr_requests
        WHERE created_at < now() - (_policy.retention_days || ' days')::INTERVAL
          AND status = 'completed';
        GET DIAGNOSTICS _deleted_count = ROW_COUNT;
        
      WHEN 'face_verifications' THEN
        -- Anonymize old verification logs instead of deleting
        UPDATE public.face_verification_logs
        SET photo_url = 'REDACTED',
            failure_reason = 'REDACTED'
        WHERE created_at < now() - (_policy.retention_days || ' days')::INTERVAL
          AND photo_url != 'REDACTED';
        GET DIAGNOSTICS _deleted_count = ROW_COUNT;
        
      ELSE
        -- For other types, just update the last cleanup run
        _deleted_count := 0;
    END CASE;
    
    -- Update last cleanup run
    UPDATE public.data_retention_policies
    SET last_cleanup_run = now()
    WHERE data_type = _policy.data_type;
    
    -- Log cleanup action if something was deleted
    IF _deleted_count > 0 THEN
      PERFORM public.log_sensitive_data_access(
        'data_retention_cleanup',
        _policy.data_type,
        NULL,
        jsonb_build_object(
          'records_affected', _deleted_count,
          'retention_days', _policy.retention_days
        )
      );
    END IF;
  END LOOP;
END;
$$;

-- ============================================================================
-- Insert default audit data retention policies
-- ============================================================================

INSERT INTO public.data_retention_policies (data_type, retention_days, auto_delete_enabled)
VALUES 
  ('audit_logs', 365, true),
  ('security_alerts', 180, true),
  ('gdpr_requests', 90, true)
ON CONFLICT (data_type) DO NOTHING;