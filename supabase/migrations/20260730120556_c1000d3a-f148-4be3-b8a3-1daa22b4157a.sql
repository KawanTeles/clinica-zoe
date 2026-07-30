
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meta_id text,
  name text NOT NULL,
  language text NOT NULL DEFAULT 'pt_BR',
  category text NOT NULL DEFAULT 'UTILITY',
  titulo_interno text,
  header_text text,
  body_text text NOT NULL DEFAULT '',
  footer_text text,
  buttons jsonb NOT NULL DEFAULT '[]'::jsonb,
  variaveis jsonb NOT NULL DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'LOCAL',
  quality_rating text,
  rejected_reason text,
  meta_created_at timestamptz,
  meta_updated_at timestamptz,
  synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, language)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_templates TO authenticated;
GRANT ALL ON public.whatsapp_templates TO service_role;
ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gerenciam templates" ON public.whatsapp_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

CREATE TRIGGER trg_whatsapp_templates_updated
  BEFORE UPDATE ON public.whatsapp_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE IF NOT EXISTS public.whatsapp_evento_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento text NOT NULL UNIQUE,
  template_name text,
  language text NOT NULL DEFAULT 'pt_BR',
  variaveis jsonb NOT NULL DEFAULT '[]'::jsonb,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_evento_templates TO authenticated;
GRANT ALL ON public.whatsapp_evento_templates TO service_role;
ALTER TABLE public.whatsapp_evento_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gerenciam mapeamento de eventos" ON public.whatsapp_evento_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'));

CREATE TRIGGER trg_whatsapp_evento_templates_updated
  BEFORE UPDATE ON public.whatsapp_evento_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.whatsapp_evento_templates (evento, variaveis) VALUES
  ('SOLICITACAO_NOVA', '["PACIENTE"]'::jsonb),
  ('CONSULTA_APROVADA', '["PACIENTE","PROFISSIONAL","ESPECIALIDADE","DATA","HORARIO","ENDERECO"]'::jsonb),
  ('CONSULTA_RECUSADA', '["PACIENTE","DATA","HORARIO"]'::jsonb),
  ('CONSULTA_CANCELADA', '["PACIENTE","DATA","HORARIO"]'::jsonb),
  ('CONSULTA_REMARCADA', '["PACIENTE","PROFISSIONAL","DATA","HORARIO"]'::jsonb),
  ('LEMBRETE_24H', '["PACIENTE","PROFISSIONAL","HORARIO"]'::jsonb),
  ('LEMBRETE_2H', '["PACIENTE","PROFISSIONAL","HORARIO"]'::jsonb),
  ('PAGAMENTO_CONFIRMADO', '["PACIENTE","VALOR"]'::jsonb),
  ('PAGAMENTO_PENDENTE', '["PACIENTE","VALOR"]'::jsonb),
  ('CONSULTA_FINALIZADA', '["PACIENTE","CLINICA"]'::jsonb)
ON CONFLICT (evento) DO NOTHING;

ALTER TABLE public.whatsapp_message_logs
  ADD COLUMN IF NOT EXISTS message_status text,
  ADD COLUMN IF NOT EXISTS conversation_id text,
  ADD COLUMN IF NOT EXISTS conversation_category text,
  ADD COLUMN IF NOT EXISTS erro_codigo text,
  ADD COLUMN IF NOT EXISTS erro_detalhe text,
  ADD COLUMN IF NOT EXISTS evento text,
  ADD COLUMN IF NOT EXISTS accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz,
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS failed_at timestamptz,
  ADD COLUMN IF NOT EXISTS webhook_payload jsonb;

CREATE INDEX IF NOT EXISTS idx_wa_logs_wamid ON public.whatsapp_message_logs (wamid);
CREATE INDEX IF NOT EXISTS idx_wa_logs_created ON public.whatsapp_message_logs (created_at DESC);
