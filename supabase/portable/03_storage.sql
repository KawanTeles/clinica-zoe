-- =====================================================================
-- Clínica Zoe — 03. Storage (buckets + políticas)
-- Execute DEPOIS de 02_schema_public.sql (as políticas usam has_role()).
-- =====================================================================

-- ---------- Buckets (todos privados, como na origem) ----------
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('profissionais', 'profissionais', false),
  ('clientes',      'clientes',      false),
  ('clinica',       'clinica',       false),
  ('financeiro',    'financeiro',    false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- ---------- Políticas em storage.objects ----------
DROP POLICY IF EXISTS "avatars_insert_own_or_admin"  ON storage.objects;
DROP POLICY IF EXISTS "avatars_update_own_or_admin"  ON storage.objects;
DROP POLICY IF EXISTS "avatars_delete_own_or_admin"  ON storage.objects;
DROP POLICY IF EXISTS "clientes_read_own_or_staff"   ON storage.objects;
DROP POLICY IF EXISTS "profissionais_read_public"    ON storage.objects;
DROP POLICY IF EXISTS "clinica_read_public"          ON storage.objects;
DROP POLICY IF EXISTS "clinica_admin_insert"         ON storage.objects;
DROP POLICY IF EXISTS "clinica_admin_update"         ON storage.objects;
DROP POLICY IF EXISTS "clinica_admin_delete"         ON storage.objects;

CREATE POLICY "avatars_insert_own_or_admin" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = ANY (ARRAY['profissionais'::text, 'clientes'::text])
    AND (((storage.foldername(name))[1] = (auth.uid())::text) OR public.has_role(auth.uid(), 'ADMIN'::public.app_role))
  );

CREATE POLICY "avatars_update_own_or_admin" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = ANY (ARRAY['profissionais'::text, 'clientes'::text])
    AND (((storage.foldername(name))[1] = (auth.uid())::text) OR public.has_role(auth.uid(), 'ADMIN'::public.app_role))
  )
  WITH CHECK (
    bucket_id = ANY (ARRAY['profissionais'::text, 'clientes'::text])
    AND (((storage.foldername(name))[1] = (auth.uid())::text) OR public.has_role(auth.uid(), 'ADMIN'::public.app_role))
  );

CREATE POLICY "avatars_delete_own_or_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = ANY (ARRAY['profissionais'::text, 'clientes'::text])
    AND (((storage.foldername(name))[1] = (auth.uid())::text) OR public.has_role(auth.uid(), 'ADMIN'::public.app_role))
  );

CREATE POLICY "clientes_read_own_or_staff" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'clientes'::text
    AND (
      ((storage.foldername(name))[1] = (auth.uid())::text)
      OR public.has_role(auth.uid(), 'ADMIN'::public.app_role)
      OR public.has_role(auth.uid(), 'RECEPCIONISTA'::public.app_role)
      OR public.has_role(auth.uid(), 'PROFISSIONAL'::public.app_role)
    )
  );

CREATE POLICY "profissionais_read_public" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'profissionais'::text);

CREATE POLICY "clinica_read_public" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'clinica'::text);

CREATE POLICY "clinica_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'clinica'::text AND public.has_role(auth.uid(), 'ADMIN'::public.app_role));

CREATE POLICY "clinica_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'clinica'::text AND public.has_role(auth.uid(), 'ADMIN'::public.app_role))
  WITH CHECK (bucket_id = 'clinica'::text AND public.has_role(auth.uid(), 'ADMIN'::public.app_role));

CREATE POLICY "clinica_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'clinica'::text AND public.has_role(auth.uid(), 'ADMIN'::public.app_role));

-- ---------- Financeiro (Fase 1 — comprovantes de pagamento) ----------
-- Convenção de path igual à de avatar.tsx: o valor salvo em
-- financeiro_anexos.arquivo_path é "financeiro/<financeiro_id>/<arquivo>"
-- (primeiro segmento = bucket). Dentro do bucket, o objeto fica em
-- "<financeiro_id>/<arquivo>" — (storage.foldername(name))[1] é o
-- financeiro_id, usado para restringir PROFISSIONAL aos próprios
-- comprovantes, do mesmo jeito que a tabela financeiro_anexos já faz.
DROP POLICY IF EXISTS "financeiro_read_staff"    ON storage.objects;
DROP POLICY IF EXISTS "financeiro_admin_insert"  ON storage.objects;
DROP POLICY IF EXISTS "financeiro_admin_update"  ON storage.objects;
DROP POLICY IF EXISTS "financeiro_admin_delete"  ON storage.objects;

CREATE POLICY "financeiro_read_staff" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'financeiro'::text
    AND (
      public.has_role(auth.uid(), 'ADMIN'::public.app_role)
      OR EXISTS (
        SELECT 1 FROM public.financeiro f
        JOIN public.profissionais p ON p.id = f.profissional_id
        WHERE f.id::text = (storage.foldername(name))[1]
          AND p.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "financeiro_admin_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'financeiro'::text AND public.has_role(auth.uid(), 'ADMIN'::public.app_role));

CREATE POLICY "financeiro_admin_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'financeiro'::text AND public.has_role(auth.uid(), 'ADMIN'::public.app_role))
  WITH CHECK (bucket_id = 'financeiro'::text AND public.has_role(auth.uid(), 'ADMIN'::public.app_role));

CREATE POLICY "financeiro_admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'financeiro'::text AND public.has_role(auth.uid(), 'ADMIN'::public.app_role));
