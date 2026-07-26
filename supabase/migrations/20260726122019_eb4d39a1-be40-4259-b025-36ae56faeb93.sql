ALTER VIEW public.profissionais_public SET (security_invoker = true);

-- Acesso por coluna: nada sensível fica exposto ao público
GRANT SELECT (
  id, nome, foto_url, descricao, formacao, anos_experiencia,
  registro_profissional, duracao_consulta_min,
  valor_consulta_avista, valor_consulta_cartao,
  especialidade_id, status, created_at
) ON public.profissionais TO anon;

DROP POLICY IF EXISTS prof_read_public_ativos ON public.profissionais;
CREATE POLICY prof_read_public_ativos
  ON public.profissionais
  FOR SELECT
  TO anon
  USING (status = 'ATIVO'::profissional_status);

GRANT SELECT ON public.profissionais_public TO anon, authenticated;