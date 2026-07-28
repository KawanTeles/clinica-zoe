ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS desativado_em timestamptz,
  ADD COLUMN IF NOT EXISTS desativado_por uuid,
  ADD COLUMN IF NOT EXISTS removido_em timestamptz,
  ADD COLUMN IF NOT EXISTS removido_por uuid,
  ADD COLUMN IF NOT EXISTS criado_por uuid;

CREATE TABLE IF NOT EXISTS public.user_audit_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  actor_id uuid,
  actor_nome text,
  target_user_id uuid,
  target_nome text,
  acao text NOT NULL,
  detalhes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.user_audit_log TO authenticated;
GRANT ALL ON public.user_audit_log TO service_role;

ALTER TABLE public.user_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins podem ver auditoria" ON public.user_audit_log;
CREATE POLICY "Admins podem ver auditoria"
ON public.user_audit_log
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE INDEX IF NOT EXISTS idx_user_audit_log_target ON public.user_audit_log (target_user_id, created_at DESC);