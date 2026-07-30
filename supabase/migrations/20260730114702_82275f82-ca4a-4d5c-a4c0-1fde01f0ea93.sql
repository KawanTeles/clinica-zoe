CREATE TABLE IF NOT EXISTS public.whatsapp_message_logs (
  id uuid primary key default gen_random_uuid(),
  agendamento_id uuid,
  destinatario_telefone text not null,
  paciente_nome text,
  profissional_nome text,
  mensagem text,
  mensagem_recebida text,
  template_name text,
  status_envio text not null default 'PENDENTE',
  wamid text,
  duracao_ms integer,
  ultimo_erro text,
  payload jsonb,
  created_at timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS whatsapp_message_logs_wamid_idx ON public.whatsapp_message_logs(wamid);
CREATE INDEX IF NOT EXISTS whatsapp_message_logs_created_idx ON public.whatsapp_message_logs(created_at desc);
GRANT SELECT ON public.whatsapp_message_logs TO authenticated;
GRANT ALL ON public.whatsapp_message_logs TO service_role;
ALTER TABLE public.whatsapp_message_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins leem logs whatsapp" ON public.whatsapp_message_logs;
CREATE POLICY "Admins leem logs whatsapp" ON public.whatsapp_message_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'));

CREATE TABLE IF NOT EXISTS public.whatsapp_meta_config (
  id uuid primary key default gen_random_uuid(),
  access_token text,
  phone_number_id text,
  business_account_id text,
  app_id text,
  app_secret text,
  verify_token text,
  graph_version text not null default 'v23.0',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_meta_config TO authenticated;
GRANT ALL ON public.whatsapp_meta_config TO service_role;
ALTER TABLE public.whatsapp_meta_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins gerenciam config meta" ON public.whatsapp_meta_config;
CREATE POLICY "Admins gerenciam config meta" ON public.whatsapp_meta_config FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'ADMIN')) WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

CREATE TABLE IF NOT EXISTS public.whatsapp_sessions (
  telefone text primary key,
  last_inbound_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT ON public.whatsapp_sessions TO authenticated;
GRANT ALL ON public.whatsapp_sessions TO service_role;
ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admins leem sessoes whatsapp" ON public.whatsapp_sessions;
CREATE POLICY "Admins leem sessoes whatsapp" ON public.whatsapp_sessions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'));