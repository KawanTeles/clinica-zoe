-- Restrict anonymous access to non-sensitive columns only
REVOKE ALL ON public.profissionais FROM anon;
GRANT SELECT (id, nome, foto_url, descricao, formacao, anos_experiencia, registro_profissional, duracao_consulta_min, valor_consulta_avista, valor_consulta_cartao, especialidade_id, status, created_at) ON public.profissionais TO anon;

REVOKE ALL ON public.profissional_bloqueio FROM anon;
GRANT SELECT (id, profissional_id, data, hora_inicio, hora_fim, created_at) ON public.profissional_bloqueio TO anon;