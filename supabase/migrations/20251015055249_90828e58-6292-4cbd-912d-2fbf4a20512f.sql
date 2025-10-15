-- Add archiving columns to tardiness_reports table
ALTER TABLE tardiness_reports
ADD COLUMN is_archived BOOLEAN DEFAULT false,
ADD COLUMN archived_at TIMESTAMPTZ,
ADD COLUMN archived_by UUID REFERENCES auth.users(id);

-- Create index for performance
CREATE INDEX idx_tardiness_archived ON tardiness_reports(is_archived, created_at DESC);