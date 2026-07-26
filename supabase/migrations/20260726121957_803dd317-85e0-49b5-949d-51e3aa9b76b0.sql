ALTER VIEW public.profissionais_public SET (security_invoker = false);
GRANT SELECT ON public.profissionais_public TO anon, authenticated;