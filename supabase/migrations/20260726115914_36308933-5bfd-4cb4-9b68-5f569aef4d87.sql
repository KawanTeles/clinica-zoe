DROP POLICY IF EXISTS "clinica_read_public" ON storage.objects;
CREATE POLICY "clinica_read_public"
ON storage.objects FOR SELECT
TO anon, authenticated
USING (bucket_id = 'clinica');

DROP POLICY IF EXISTS "clinica_admin_insert" ON storage.objects;
CREATE POLICY "clinica_admin_insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'clinica' AND public.has_role(auth.uid(), 'ADMIN'));

DROP POLICY IF EXISTS "clinica_admin_update" ON storage.objects;
CREATE POLICY "clinica_admin_update"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'clinica' AND public.has_role(auth.uid(), 'ADMIN'))
WITH CHECK (bucket_id = 'clinica' AND public.has_role(auth.uid(), 'ADMIN'));

DROP POLICY IF EXISTS "clinica_admin_delete" ON storage.objects;
CREATE POLICY "clinica_admin_delete"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'clinica' AND public.has_role(auth.uid(), 'ADMIN'));