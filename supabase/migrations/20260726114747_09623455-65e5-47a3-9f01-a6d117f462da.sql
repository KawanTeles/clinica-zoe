-- Photo columns
ALTER TABLE public.pacientes ADD COLUMN IF NOT EXISTS foto_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS foto_url text;

-- Keep public professionals view in sync (recreate with foto_url already present)
-- (view already exposes foto_url; no change needed)

-- Storage policies for avatar buckets
DROP POLICY IF EXISTS "avatars_read_public" ON storage.objects;
CREATE POLICY "avatars_read_public"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id IN ('profissionais', 'clientes'));

DROP POLICY IF EXISTS "avatars_insert_own_or_admin" ON storage.objects;
CREATE POLICY "avatars_insert_own_or_admin"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id IN ('profissionais', 'clientes')
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'ADMIN')
  )
);

DROP POLICY IF EXISTS "avatars_update_own_or_admin" ON storage.objects;
CREATE POLICY "avatars_update_own_or_admin"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id IN ('profissionais', 'clientes')
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'ADMIN')
  )
)
WITH CHECK (
  bucket_id IN ('profissionais', 'clientes')
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'ADMIN')
  )
);

DROP POLICY IF EXISTS "avatars_delete_own_or_admin" ON storage.objects;
CREATE POLICY "avatars_delete_own_or_admin"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id IN ('profissionais', 'clientes')
  AND (
    (storage.foldername(name))[1] = auth.uid()::text
    OR public.has_role(auth.uid(), 'ADMIN')
  )
);