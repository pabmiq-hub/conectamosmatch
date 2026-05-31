
-- 1. Add cargo column to profiles and responsable_requests
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cargo TEXT;
ALTER TABLE public.responsable_requests ADD COLUMN IF NOT EXISTS cargo TEXT;

-- 2. Restore SELECT policy on logos bucket (was inadvertently dropped without replacement)
DROP POLICY IF EXISTS "logos public read" ON storage.objects;
CREATE POLICY "logos public read" ON storage.objects
FOR SELECT USING (bucket_id = 'logos');
