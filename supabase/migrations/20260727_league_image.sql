-- Obrázek tabulky + public Storage bucket
ALTER TABLE public.leagues
  ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Public bucket for league cover images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'league-covers',
  'league-covers',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "league_covers_public_read" ON storage.objects;
CREATE POLICY "league_covers_public_read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'league-covers');

DROP POLICY IF EXISTS "league_covers_auth_upload" ON storage.objects;
CREATE POLICY "league_covers_auth_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'league-covers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "league_covers_auth_update" ON storage.objects;
CREATE POLICY "league_covers_auth_update"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'league-covers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'league-covers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "league_covers_auth_delete" ON storage.objects;
CREATE POLICY "league_covers_auth_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'league-covers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
