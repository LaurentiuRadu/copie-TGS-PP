-- Create storage bucket for profile photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-photos',
  'profile-photos',
  false,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png']::text[]
);

-- Create RLS policies for profile photos bucket
CREATE POLICY "Users can view their own profile photo"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'profile-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload their own profile photo"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'profile-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own profile photo"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'profile-photos' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Admins can view all profile photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'profile-photos' 
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- Add reference photo URL to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS reference_photo_url text,
ADD COLUMN IF NOT EXISTS reference_photo_enrolled_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS photo_quality_score numeric;