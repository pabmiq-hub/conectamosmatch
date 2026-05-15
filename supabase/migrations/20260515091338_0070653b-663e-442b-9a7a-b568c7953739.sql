
ALTER TABLE public.empresa_profiles ADD COLUMN IF NOT EXISTS responsables jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.sponsor_profiles ADD COLUMN IF NOT EXISTS responsables jsonb NOT NULL DEFAULT '[]'::jsonb;

INSERT INTO storage.buckets (id, name, public)
VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "logos public read" ON storage.objects;
CREATE POLICY "logos public read" ON storage.objects FOR SELECT USING (bucket_id = 'logos');

DROP POLICY IF EXISTS "logos own insert" ON storage.objects;
CREATE POLICY "logos own insert" ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "logos own update" ON storage.objects;
CREATE POLICY "logos own update" ON storage.objects FOR UPDATE
  USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "logos own delete" ON storage.objects;
CREATE POLICY "logos own delete" ON storage.objects FOR DELETE
  USING (bucket_id = 'logos' AND auth.uid()::text = (storage.foldername(name))[1]);
