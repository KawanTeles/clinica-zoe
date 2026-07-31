-- A view pública só expõe colunas não sensíveis de profissionais ATIVOS.
-- Como o acesso à tabela base é restrito por RLS/colunas, a view passa a
-- rodar com privilégios do dono para servir tanto visitantes quanto usuários logados.
ALTER VIEW public.profissionais_public SET (security_invoker = false);

REVOKE ALL ON public.profissionais_public FROM anon, authenticated;
GRANT SELECT ON public.profissionais_public TO anon, authenticated;