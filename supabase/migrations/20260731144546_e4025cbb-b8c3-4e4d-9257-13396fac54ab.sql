-- 1) Restringe colunas visíveis ao público (anon) no cadastro de profissionais
REVOKE SELECT ON public.profissionais FROM anon;
GRANT SELECT (
  id, nome, foto_url, descricao, formacao, anos_experiencia,
  registro_profissional, duracao_consulta_min, valor_consulta_avista,
  valor_consulta_cartao, especialidade_id, status, created_at, updated_at
) ON public.profissionais TO anon;

-- 2) Restringe a leitura do cadastro completo à equipe e ao próprio profissional
DROP POLICY IF EXISTS prof_read ON public.profissionais;
CREATE POLICY prof_read ON public.profissionais
FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'ADMIN')
  OR public.has_role(auth.uid(), 'RECEPCIONISTA')
  OR user_id = auth.uid()
);

-- 3) Pacientes autenticados leem apenas os campos públicos (mesma regra do site)
CREATE POLICY prof_read_publico_ativos_auth ON public.profissionais
FOR SELECT TO authenticated
USING (status = 'ATIVO');

REVOKE SELECT ON public.profissionais FROM authenticated;
GRANT SELECT ON public.profissionais TO authenticated;
