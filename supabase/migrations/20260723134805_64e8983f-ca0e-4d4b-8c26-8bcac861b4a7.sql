
-- Fase 9: reforço de segurança nas leituras públicas
-- 1) Restringir dados de profissionais expostos ao público via view sem colunas sensíveis
CREATE OR REPLACE VIEW public.profissionais_public
WITH (security_invoker = true)
AS
SELECT
  id,
  nome,
  foto_url,
  descricao,
  duracao_consulta_min,
  valor_consulta_avista,
  valor_consulta_cartao,
  especialidade_id,
  status,
  created_at
FROM public.profissionais
WHERE status = 'ATIVO';

GRANT SELECT ON public.profissionais_public TO anon, authenticated;

-- 2) Remover policy anon direta na tabela profissionais (expunha email/telefone)
DROP POLICY IF EXISTS prof_read_public ON public.profissionais;

-- 3) Restringir leituras públicas de disponibilidade/bloqueios a profissionais ATIVOS
DROP POLICY IF EXISTS disp_read_public ON public.profissional_disponibilidade;
CREATE POLICY disp_read_public ON public.profissional_disponibilidade
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.profissionais p
      WHERE p.id = profissional_disponibilidade.profissional_id
        AND p.status = 'ATIVO'
    )
  );

DROP POLICY IF EXISTS bloq_read_public ON public.profissional_bloqueio;
CREATE POLICY bloq_read_public ON public.profissional_bloqueio
  FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.profissionais p
      WHERE p.id = profissional_bloqueio.profissional_id
        AND p.status = 'ATIVO'
    )
  );

-- 4) Revogar EXECUTE público de funções SECURITY DEFINER sensíveis; manter apenas o necessário
REVOKE EXECUTE ON FUNCTION public.enqueue_notificacao(uuid, text, text, notif_evento, notif_canal, uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.resolve_valor_consulta(uuid, text) FROM PUBLIC, anon, authenticated;
-- has_role e current_user_has_role são usadas nas policies — manter execução para authenticated
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_has_role(app_role) FROM PUBLIC, anon;
-- horarios_disponiveis precisa ser público (site anon consulta horários)
GRANT EXECUTE ON FUNCTION public.horarios_disponiveis(uuid, date) TO anon, authenticated;
