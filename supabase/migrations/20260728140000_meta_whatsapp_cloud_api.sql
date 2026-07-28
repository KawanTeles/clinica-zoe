-- Migration: Meta WhatsApp Cloud API Integration
-- 1) Create whatsapp_meta_config table
CREATE TABLE IF NOT EXISTS public.whatsapp_meta_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  access_token text,
  phone_number_id text,
  business_account_id text,
  app_id text,
  app_secret text,
  verify_token text DEFAULT 'clinica_zoe_verify_token_2026',
  graph_version text DEFAULT 'v20.0',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- RLS for whatsapp_meta_config
ALTER TABLE public.whatsapp_meta_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage whatsapp_meta_config" ON public.whatsapp_meta_config;
CREATE POLICY "Admins can manage whatsapp_meta_config"
  ON public.whatsapp_meta_config
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'ADMIN'
    )
  );

-- 2) Create whatsapp_message_logs table
CREATE TABLE IF NOT EXISTS public.whatsapp_message_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id uuid REFERENCES public.agendamentos(id) ON DELETE SET NULL,
  destinatario_telefone text NOT NULL,
  paciente_nome text,
  profissional_nome text,
  mensagem text,
  mensagem_recebida text,
  template_name text,
  status_envio text NOT NULL DEFAULT 'PENDENTE',
  wamid text,
  duracao_ms integer,
  ultimo_erro text,
  payload jsonb,
  created_at timestamptz DEFAULT now()
);

-- Index for wamid & status
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_wamid ON public.whatsapp_message_logs(wamid);
CREATE INDEX IF NOT EXISTS idx_whatsapp_logs_status ON public.whatsapp_message_logs(status_envio);

-- RLS for whatsapp_message_logs
ALTER TABLE public.whatsapp_message_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins and Staff can view logs" ON public.whatsapp_message_logs;
CREATE POLICY "Admins and Staff can view logs"
  ON public.whatsapp_message_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('ADMIN', 'RECEPCIONISTA', 'PROFISSIONAL')
    )
  );

-- 3) Create whatsapp_templates table
CREATE TABLE IF NOT EXISTS public.whatsapp_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  language text NOT NULL DEFAULT 'pt_BR',
  category text,
  status text NOT NULL DEFAULT 'APPROVED',
  components jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can manage templates" ON public.whatsapp_templates;
CREATE POLICY "Admins can manage templates"
  ON public.whatsapp_templates
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'ADMIN'
    )
  );

-- Insert Default Official Templates
INSERT INTO public.whatsapp_templates (name, language, category, status, components)
VALUES
  ('solicitacao_consulta', 'pt_BR', 'UTILITY', 'APPROVED', '[{"type":"BODY","text":"Você possui uma nova solicitação de consulta."}]'::jsonb),
  ('confirmacao_consulta', 'pt_BR', 'UTILITY', 'APPROVED', '[{"type":"BODY","text":"Sua consulta foi confirmada com sucesso."}]'::jsonb),
  ('recusa_consulta', 'pt_BR', 'UTILITY', 'APPROVED', '[{"type":"BODY","text":"Sua solicitação de consulta não pôde ser confirmada."}]'::jsonb),
  ('lembrete_consulta', 'pt_BR', 'UTILITY', 'APPROVED', '[{"type":"BODY","text":"Este é um lembrete da sua consulta agendada."}]'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- 4) RPC: processar_resposta_meta_profissional
CREATE OR REPLACE FUNCTION public.processar_resposta_meta_profissional(
  _telefone_prof text,
  _resposta text,
  _wamid text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prof record;
  v_agendamento record;
  v_norm_tel text;
  v_intent text;
  v_existente record;
  v_fin_id uuid;
BEGIN
  v_norm_tel := public.normalizar_whatsapp(_telefone_prof);
  IF v_norm_tel IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Telefone inválido');
  END IF;

  -- Localiza profissional pelo número de WhatsApp ou telefone
  SELECT p.id, p.nome, p.user_id, p.whatsapp
    INTO v_prof
    FROM public.profissionais p
   WHERE public.normalizar_whatsapp(p.whatsapp) = v_norm_tel
      OR public.normalizar_whatsapp(p.telefone) = v_norm_tel
   LIMIT 1;

  IF v_prof.id IS NULL THEN
    SELECT pr.id AS user_id, pr.nome, pr.whatsapp, p.id AS prof_id
      INTO v_prof
      FROM public.profiles pr
      JOIN public.user_roles ur ON ur.user_id = pr.id
      JOIN public.profissionais p ON p.user_id = pr.id
     WHERE ur.role = 'PROFISSIONAL'
       AND (public.normalizar_whatsapp(pr.whatsapp) = v_norm_tel OR public.normalizar_whatsapp(pr.telefone) = v_norm_tel)
     LIMIT 1;
  END IF;

  IF v_prof.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Profissional não encontrado');
  END IF;

  -- Interpreta comando (CONFIRMAR, RECUSAR, REMARCAR)
  IF upper(btrim(_resposta)) IN ('CONFIRMAR', 'OK', 'SIM', 'CONFIRMA', 'APROVAR', 'APROVADO', '1') THEN
    v_intent := 'CONFIRMAR';
  ELSIF upper(btrim(_resposta)) IN ('RECUSAR', 'NAO', 'NÃO', 'RECUSA', 'CANCELAR', 'RECUSADO', '2') THEN
    v_intent := 'RECUSAR';
  ELSIF upper(btrim(_resposta)) IN ('REMARCAR', 'REAGENDAR', '3') THEN
    v_intent := 'REMARCAR';
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'Comando não reconhecido');
  END IF;

  -- Localiza agendamento pendente mais recente
  SELECT ag.*
    INTO v_agendamento
    FROM public.agendamentos ag
   WHERE ag.profissional_id = v_prof.id
     AND ag.status = 'PENDENTE'
   ORDER BY ag.created_at DESC
   LIMIT 1;

  IF v_agendamento.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Nenhum agendamento pendente encontrado');
  END IF;

  IF v_intent = 'CONFIRMAR' THEN
    SELECT id INTO v_existente
      FROM public.agendamentos
     WHERE profissional_id = v_prof.id
       AND data = v_agendamento.data
       AND hora_inicio = v_agendamento.hora_inicio
       AND status = 'APROVADO'
       AND id <> v_agendamento.id
     LIMIT 1;

    IF v_existente.id IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Horário já ocupado');
    END IF;

    UPDATE public.agendamentos
       SET status = 'APROVADO',
           updated_at = now()
     WHERE id = v_agendamento.id;

    SELECT id INTO v_fin_id FROM public.financeiro WHERE agendamento_id = v_agendamento.id LIMIT 1;
    IF v_fin_id IS NULL THEN
      INSERT INTO public.financeiro (
        agendamento_id,
        paciente_id,
        profissional_id,
        valor,
        status_pagamento,
        forma_pagamento
      ) VALUES (
        v_agendamento.id,
        v_agendamento.paciente_id,
        v_agendamento.profissional_id,
        v_agendamento.valor,
        'ABERTO',
        v_agendamento.forma_pagamento
      );
    END IF;

    UPDATE public.notificacoes
       SET status_envio = 'RESPONDIDO',
           mensagem_recebida = _resposta,
           respondido_em = now()
     WHERE agendamento_id = v_agendamento.id
       AND evento = 'SOLICITACAO_NOVA'
       AND canal = 'WHATSAPP';

    RETURN jsonb_build_object('ok', true, 'action', 'CONFIRMADO', 'agendamento_id', v_agendamento.id);

  ELSIF v_intent = 'RECUSAR' THEN
    UPDATE public.agendamentos
       SET status = 'RECUSADO',
           updated_at = now()
     WHERE id = v_agendamento.id;

    UPDATE public.notificacoes
       SET status_envio = 'RESPONDIDO',
           mensagem_recebida = _resposta,
           respondido_em = now()
     WHERE agendamento_id = v_agendamento.id
       AND evento = 'SOLICITACAO_NOVA'
       AND canal = 'WHATSAPP';

    RETURN jsonb_build_object('ok', true, 'action', 'RECUSADO', 'agendamento_id', v_agendamento.id);

  ELSE
    UPDATE public.agendamentos
       SET status = 'REMARCADO',
           updated_at = now()
     WHERE id = v_agendamento.id;

    RETURN jsonb_build_object('ok', true, 'action', 'REMARCADO', 'agendamento_id', v_agendamento.id);
  END IF;
END;
$$;
