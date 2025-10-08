-- Create table for reusable "De executat" entries
CREATE TABLE IF NOT EXISTS public.execution_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

-- Enable RLS
ALTER TABLE public.execution_items ENABLE ROW LEVEL SECURITY;

-- Policies: allow authenticated users to view and insert (same pattern as locations/projects)
CREATE POLICY "Authenticated users can view execution items"
ON public.execution_items
FOR SELECT
USING (true);

CREATE POLICY "Authenticated users can insert execution items"
ON public.execution_items
FOR INSERT
WITH CHECK (true);

-- Optional: allow admins to manage fully (align with other admin-managed tables)
CREATE POLICY "Admins can manage execution items"
ON public.execution_items
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));