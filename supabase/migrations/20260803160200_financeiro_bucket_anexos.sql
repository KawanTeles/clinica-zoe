-- Financeiro — Fase 1 (Fundação): bucket privado para comprovantes
-- (public.financeiro_anexos). Segue exatamente o padrão dos buckets
-- privados já existentes (clinica_admin_*): leitura via signed URL,
-- escrita restrita a ADMIN (mesma regra de escrita dos lançamentos
-- financeiros nesta fase).

INSERT INTO storage.buckets (id, name, public)
VALUES ('financeiro', 'financeiro', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DROP POLICY IF EXISTS "financeiro_read_staff" ON storage.objects;
DROP POLICY IF EXISTS "financeiro_admin_insert" ON storage.objects;
DROP POLICY IF EXISTS "financeiro_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "financeiro_admin_delete" ON storage.objects;

-- Convenção de path igual à de avatar.tsx: o valor salvo em
-- financeiro_anexos.arquivo_path é "financeiro/<financeiro_id>/<arquivo>"
-- (primeiro segmento = bucket). Dentro do bucket, o objeto fica em
-- "<financeiro_id>/<arquivo>" — por isso (storage.foldername(name))[1] é o
-- financeiro_id, usado aqui para restringir PROFISSIONAL aos próprios
-- comprovantes, do mesmo jeito que a tabela financeiro_anexos já faz.
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
