DROP POLICY IF EXISTS avatars_read_public ON storage.objects;

CREATE POLICY profissionais_read_public ON storage.objects
FOR SELECT TO anon, authenticated
USING (bucket_id = 'profissionais');

CREATE POLICY clientes_read_own_or_staff ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'clientes'
  AND (
    (storage.foldername(name))[1] = (auth.uid())::text
    OR public.has_role(auth.uid(), 'ADMIN'::app_role)
    OR public.has_role(auth.uid(), 'RECEPCIONISTA'::app_role)
    OR public.has_role(auth.uid(), 'PROFISSIONAL'::app_role)
  )
);