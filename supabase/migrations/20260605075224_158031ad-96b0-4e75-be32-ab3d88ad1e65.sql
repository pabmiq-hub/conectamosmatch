
DROP POLICY IF EXISTS "logos own insert" ON storage.objects;
DROP POLICY IF EXISTS "logos own update" ON storage.objects;
DROP POLICY IF EXISTS "logos own delete" ON storage.objects;

CREATE POLICY "logos authenticated insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'logos');

CREATE POLICY "logos authenticated update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'logos')
  WITH CHECK (bucket_id = 'logos');

CREATE POLICY "logos authenticated delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'logos');

CREATE POLICY "logos public read" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'logos');
