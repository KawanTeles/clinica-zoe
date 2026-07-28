-- Migration: Evolution API WhatsApp Confirmation Flow & Status Tracking
-- 1) Extend notif_status_envio enum
ALTER TYPE public.notif_status_envio ADD VALUE IF NOT EXISTS 'ENTREGUE';
ALTER TYPE public.notif_status_envio ADD VALUE IF NOT EXISTS 'LIDO';
ALTER TYPE public.notif_status_envio ADD VALUE IF NOT EXISTS 'RESPONDIDO';

-- 2) Extend notificacoes table for inbound messages and delivery tracking
ALTER TABLE public.notificacoes
  ADD COLUMN IF NOT EXISTS direcao text NOT NULL DEFAULT 'OUTBOUND',
  ADD COLUMN IF NOT EXISTS mensagem_recebida text,
  ADD COLUMN IF NOT EXISTS respondido_em timestamptz;

-- 3) Function for atomic professional response processing
CREATE OR REPLACE FUNCTION public.processar_resposta_profissional(
  _telefone_prof text,
  _resposta text,
  _provider_msg_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prof record;
  v_agendamento record;
  v_paciente record;
  v_norm_tel text;
  v_intent text;
  v_existente record;
  v_fin_id uuid;
BEGIN
  v_norm_tel := public.normalizar_whatsapp(_telefone_prof);
  IF v_norm_tel IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Telefone inválido');
  END IF;

  -- Match professional by whatsapp/telefone
  SELECT p.id, p.nome, p.user_id, p.whatsapp
    INTO v_prof
    FROM public.profissionais p
   WHERE public.normalizar_whatsapp(p.whatsapp) = v_norm_tel
      OR public.normalizar_whatsapp(p.telefone) = v_norm_tel
   LIMIT 1;

  IF v_prof.id IS NULL THEN
    -- Fallback: match profile with PROFISSIONAL role
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
    RETURN jsonb_build_object('ok', false, 'error', 'Profissional não encontrado para este telefone');
  END IF;

  -- Determine intent
  IF upper(btrim(_resposta)) IN ('CONFIRMAR', 'OK', 'SIM', 'CONFIRMA', 'APROVAR', 'APROVADO', '1') THEN
    v_intent := 'CONFIRMAR';
  ELSIF upper(btrim(_resposta)) IN ('RECUSAR', 'NAO', 'NÃO', 'RECUSA', 'CANCELAR', 'RECUSADO', '2') THEN
    v_intent := 'RECUSAR';
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'Comando não reconhecido. Responda CONFIRMAR ou RECUSAR.');
  END IF;

  -- Find latest PENDENTE appointment for this professional
  SELECT ag.*
    INTO v_agendamento
    FROM public.agendamentos ag
   WHERE ag.profissional_id = v_prof.id
     AND ag.status = 'PENDENTE'
   ORDER BY ag.created_at DESC
   LIMIT 1;

  IF v_agendamento.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Nenhuma solicitação pendente encontrada para este profissional');
  END IF;

  IF v_intent = 'CONFIRMAR' THEN
    -- Collision check: ensure slot is free
    SELECT id INTO v_existente
      FROM public.agendamentos
     WHERE profissional_id = v_prof.id
       AND data = v_agendamento.data
       AND hora_inicio = v_agendamento.hora_inicio
       AND status = 'APROVADO'
       AND id <> v_agendamento.id
     LIMIT 1;

    IF v_existente.id IS NOT NULL THEN
      RETURN jsonb_build_object('ok', false, 'error', 'Horário já está ocupado por outro agendamento confirmado');
    END IF;

    -- Update status to APROVADO
    UPDATE public.agendamentos
       SET status = 'APROVADO',
           updated_at = now()
     WHERE id = v_agendamento.id;

    -- Ensure financial record exists
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

    -- Update notification log
    UPDATE public.notificacoes
       SET status_envio = 'RESPONDIDO',
           mensagem_recebida = _resposta,
           respondido_em = now()
     WHERE agendamento_id = v_agendamento.id
       AND evento = 'SOLICITACAO_NOVA'
       AND canal = 'WHATSAPP';

    RETURN jsonb_build_object('ok', true, 'action', 'CONFIRMADO', 'agendamento_id', v_agendamento.id);

  ELSE
    -- Update status to RECUSADO
    UPDATE public.agendamentos
       SET status = 'RECUSADO',
           updated_at = now()
     WHERE id = v_agendamento.id;

    -- Update notification log
    UPDATE public.notificacoes
       SET status_envio = 'RESPONDIDO',
           mensagem_recebida = _resposta,
           respondido_em = now()
     WHERE agendamento_id = v_agendamento.id
       AND evento = 'SOLICITACAO_NOVA'
       AND canal = 'WHATSAPP';

    RETURN jsonb_build_object('ok', true, 'action', 'RECUSADO', 'agendamento_id', v_agendamento.id);
  END IF;
END;
$$;

-- 4) Update Trigger for Agendamento Notifications
CREATE OR REPLACE FUNCTION public.on_agendamento_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_prof_user uuid; v_prof_nome text; v_prof_tel text; v_prof_email text; v_esp text;
  v_pac_nome text; v_pac_user uuid; v_pac_tel text; v_pac_email text;
  v_data_str text; v_hora_str text; v_end text; v_clinica_nome text;
  v_valor_str text; v_forma text; v_obs text;
  v_msg text;
  v_dest text;
  v_roles public.app_role[];
  r record;
BEGIN
  SELECT p.user_id, p.nome, NULLIF(p.whatsapp,''), p.email, e.nome
    INTO v_prof_user, v_prof_nome, v_prof_tel, v_prof_email, v_esp
    FROM public.profissionais p
    LEFT JOIN public.especialidades e ON e.id = p.especialidade_id
   WHERE p.id = NEW.profissional_id;

  SELECT pa.nome, pa.user_id, NULLIF(pa.whatsapp,''), pa.email, pa.telefone
    INTO v_pac_nome, v_pac_user, v_pac_tel, v_pac_email, v_obs
    FROM public.pacientes pa WHERE pa.id = NEW.paciente_id;

  IF v_pac_tel IS NULL THEN v_pac_tel := NULLIF(v_obs,''); END IF;

  IF v_pac_user IS NULL THEN v_pac_user := NEW.cliente_user_id; END IF;

  SELECT nome, endereco INTO v_clinica_nome, v_end FROM public.configuracoes_clinica ORDER BY created_at LIMIT 1;
  IF v_clinica_nome IS NULL THEN v_clinica_nome := 'Clínica'; END IF;
  IF v_end IS NULL THEN v_end := 'Endereço da clínica'; END IF;

  v_data_str := to_char(NEW.data,'DD/MM/YYYY');
  v_hora_str := to_char(NEW.hora_inicio,'HH24:MI');
  v_valor_str := translate(to_char(COALESCE(NEW.valor, 0), 'FM999G999D00'), '.,', ',.');
  v_forma := CASE NEW.forma_pagamento
    WHEN 'PIX' THEN 'Pix'
    WHEN 'CARTAO_CREDITO' THEN 'Cartão de Crédito'
    WHEN 'CARTAO_DEBITO' THEN 'Cartão de Débito'
    WHEN 'DINHEIRO' THEN 'Dinheiro'
    WHEN 'CONVENIO' THEN 'Convênio'
    ELSE COALESCE(NEW.forma_pagamento, 'A combinar')
  END;
  v_obs := COALESCE(NEW.observacoes, 'Nenhuma');

  SELECT COALESCE(destinatario_solicitacao,'PROFISSIONAL') INTO v_dest FROM public.notif_config();
  v_dest := COALESCE(v_dest, 'PROFISSIONAL');

  IF TG_OP = 'INSERT' AND NEW.status = 'PENDENTE' THEN
    -- Professional internal notification
    PERFORM public.enqueue_notificacao(
      v_prof_user,'Nova solicitação de consulta',
      'Você recebeu uma nova solicitação de consulta de ' || COALESCE(v_pac_nome,'um paciente') ||
        ' em ' || v_data_str || ' às ' || v_hora_str || '.',
      'SOLICITACAO_NOVA','INTERNO', NEW.id, v_prof_tel, v_prof_email
    );

    -- Professional WhatsApp message (Section 2)
    IF v_prof_tel IS NOT NULL THEN
      v_msg := 'Você possui uma nova solicitação de consulta.' || chr(10) || chr(10) ||
               'Paciente: ' || COALESCE(v_pac_nome,'—') || chr(10) ||
               'Especialidade: ' || COALESCE(v_esp,'—') || chr(10) ||
               'Data: ' || v_data_str || chr(10) ||
               'Horário: ' || v_hora_str || chr(10) ||
               'Valor: R$ ' || v_valor_str || chr(10) ||
               'Forma de pagamento: ' || v_forma || chr(10) ||
               'Telefone do paciente: ' || COALESCE(v_pac_tel,'—') || chr(10) ||
               'Observações: ' || v_obs || chr(10) || chr(10) ||
               'Responda com:' || chr(10) || chr(10) ||
               'CONFIRMAR' || chr(10) || chr(10) ||
               'ou' || chr(10) || chr(10) ||
               'RECUSAR';

      PERFORM public.enqueue_notificacao(
        v_prof_user, 'Nova solicitação de consulta',
        v_msg, 'SOLICITACAO_NOVA', 'WHATSAPP', NEW.id, v_prof_tel, v_prof_email
      );
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'APROVADO' THEN
      -- Patient WhatsApp confirmation message (Section 4)
      v_msg := 'Olá, ' || COALESCE(v_pac_nome,'') || '.' || chr(10) || chr(10) ||
               'Sua consulta foi confirmada com sucesso.' || chr(10) || chr(10) ||
               'Profissional:' || chr(10) || COALESCE(v_prof_nome,'—') || chr(10) || chr(10) ||
               'Especialidade:' || chr(10) || COALESCE(v_esp,'—') || chr(10) || chr(10) ||
               'Data:' || chr(10) || v_data_str || chr(10) || chr(10) ||
               'Horário:' || chr(10) || v_hora_str || chr(10) || chr(10) ||
               'Valor:' || chr(10) || 'R$ ' || v_valor_str || chr(10) || chr(10) ||
               'Forma de pagamento:' || chr(10) || v_forma || chr(10) || chr(10) ||
               'Endereço da clínica:' || chr(10) || v_end || chr(10) || chr(10) ||
               'Orientações para chegada:' || chr(10) || 'Por favor, chegue com 10 minutos de antecedência apresentando um documento com foto.' || chr(10) || chr(10) ||
               'Aguardamos você.' || chr(10) || 'Até breve!';

      PERFORM public.enqueue_notificacao(v_pac_user,'Consulta confirmada', v_msg,
        'CONSULTA_APROVADA','INTERNO', NEW.id, v_pac_tel, v_pac_email);
      IF v_pac_tel IS NOT NULL THEN
        PERFORM public.enqueue_notificacao(v_pac_user,'Consulta confirmada', v_msg,
          'CONSULTA_APROVADA','WHATSAPP', NEW.id, v_pac_tel, v_pac_email);
      END IF;

    ELSIF NEW.status = 'RECUSADO' THEN
      -- Patient WhatsApp refusal message (Section 5)
      v_msg := 'Olá, ' || COALESCE(v_pac_nome,'') || '.' || chr(10) || chr(10) ||
               'Sua solicitação de consulta para ' || v_data_str || ' às ' || v_hora_str ||
               ' com ' || COALESCE(v_prof_nome,'o profissional') || ' não pôde ser confirmada pelo profissional.' || chr(10) || chr(10) ||
               'Por favor, acesse nosso site para escolher outro horário ou profissional disponível.' || chr(10) || chr(10) ||
               'Agradecemos a compreensão.';

      PERFORM public.enqueue_notificacao(v_pac_user,'Solicitação recusada', v_msg,
        'CONSULTA_RECUSADA','INTERNO', NEW.id, v_pac_tel, v_pac_email);
      IF v_pac_tel IS NOT NULL THEN
        PERFORM public.enqueue_notificacao(v_pac_user,'Solicitação recusada', v_msg,
          'CONSULTA_RECUSADA','WHATSAPP', NEW.id, v_pac_tel, v_pac_email);
      END IF;

    ELSIF NEW.status = 'CANCELADO' THEN
      v_msg := 'Olá, ' || COALESCE(v_pac_nome,'') || '.' || chr(10) || chr(10) ||
               'Sua consulta foi CANCELADA.' || chr(10) || chr(10) ||
               'Profissional: ' || COALESCE(v_prof_nome,'—') || chr(10) ||
               'Data: ' || v_data_str || chr(10) ||
               'Horário: ' || v_hora_str || chr(10) || chr(10) ||
               'Para agendar novamente, acesse nossa Área do Paciente.';
      PERFORM public.enqueue_notificacao(v_pac_user,'Consulta cancelada', v_msg,
        'CONSULTA_CANCELADA','INTERNO', NEW.id, v_pac_tel, v_pac_email);
      IF v_pac_tel IS NOT NULL THEN
        PERFORM public.enqueue_notificacao(v_pac_user,'Consulta cancelada', v_msg,
          'CONSULTA_CANCELADA','WHATSAPP', NEW.id, v_pac_tel, v_pac_email);
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 5) Update generar_lembretes() for both Patient and Professional (Section 6)
CREATE OR REPLACE FUNCTION public.gerar_lembretes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  cfg public.notificacoes_config;
  a record;
  criados int := 0;
  v_pac_user uuid; v_pac_nome text; v_pac_tel text; v_pac_email text;
  v_prof_user uuid; v_prof_nome text; v_prof_tel text; v_prof_email text;
  v_end text; v_msg_pac text; v_msg_prof text;
  v_when timestamptz;
BEGIN
  SELECT * INTO cfg FROM public.notif_config();
  SELECT endereco INTO v_end FROM public.configuracoes_clinica ORDER BY created_at LIMIT 1;
  IF v_end IS NULL THEN v_end := 'Endereço da clínica'; END IF;

  FOR a IN
    SELECT ag.*, (ag.data + ag.hora_inicio) AT TIME ZONE 'America/Sao_Paulo' AS inicio_ts
      FROM public.agendamentos ag
     WHERE ag.status IN ('APROVADO','REMARCADO')
       AND ag.data BETWEEN CURRENT_DATE - 1 AND CURRENT_DATE + 2
  LOOP
    -- Patient data
    SELECT pa.user_id, pa.nome, NULLIF(pa.whatsapp,''), pa.email
      INTO v_pac_user, v_pac_nome, v_pac_tel, v_pac_email
      FROM public.pacientes pa WHERE pa.id = a.paciente_id;
    IF v_pac_user IS NULL THEN v_pac_user := a.cliente_user_id; END IF;

    -- Professional data
    SELECT pr.user_id, pr.nome, NULLIF(pr.whatsapp,''), pr.email
      INTO v_prof_user, v_prof_nome, v_prof_tel, v_prof_email
      FROM public.profissionais pr WHERE pr.id = a.profissional_id;

    v_when := a.inicio_ts;

    -- 24h Reminder
    IF COALESCE(cfg.lembrete_24h_ativo, true)
       AND now() >= v_when - interval '24 hours' AND now() < v_when
       AND NOT EXISTS (
         SELECT 1 FROM public.notificacoes n
          WHERE n.agendamento_id = a.id AND n.evento = 'LEMBRETE_24H'
       ) THEN

      -- Patient reminder text
      v_msg_pac := 'Olá, ' || COALESCE(v_pac_nome,'paciente') || '.' || chr(10) || chr(10) ||
                   'Este é um lembrete da sua consulta amanhã.' || chr(10) || chr(10) ||
                   'Data: ' || to_char(a.data,'DD/MM/YYYY') || chr(10) ||
                   'Horário: ' || to_char(a.hora_inicio,'HH24:MI') || chr(10) ||
                   'Profissional: ' || COALESCE(v_prof_nome,'—') || chr(10) ||
                   'Endereço: ' || v_end || chr(10) || chr(10) ||
                   'Caso precise remarcar ou cancelar, acesse a Área do Paciente.';

      PERFORM public.enqueue_notificacao(v_pac_user,'Lembrete de consulta (24h)', v_msg_pac,
        'LEMBRETE_24H','INTERNO', a.id, v_pac_tel, v_pac_email);
      IF v_pac_tel IS NOT NULL THEN
        PERFORM public.enqueue_notificacao(v_pac_user,'Lembrete de consulta (24h)', v_msg_pac,
          'LEMBRETE_24H','WHATSAPP', a.id, v_pac_tel, v_pac_email);
      END IF;

      -- Professional reminder text
      IF v_prof_tel IS NOT NULL THEN
        v_msg_prof := 'Lembrete de atendimento amanhã.' || chr(10) || chr(10) ||
                      'Paciente: ' || COALESCE(v_pac_nome,'—') || chr(10) ||
                      'Data: ' || to_char(a.data,'DD/MM/YYYY') || chr(10) ||
                      'Horário: ' || to_char(a.hora_inicio,'HH24:MI');
        PERFORM public.enqueue_notificacao(v_prof_user,'Lembrete de atendimento (24h)', v_msg_prof,
          'LEMBRETE_24H','WHATSAPP', a.id, v_prof_tel, v_prof_email);
      END IF;

      criados := criados + 1;
    END IF;

    -- 2h Reminder
    IF COALESCE(cfg.lembrete_2h_ativo, true)
       AND now() >= v_when - interval '2 hours' AND now() < v_when
       AND NOT EXISTS (
         SELECT 1 FROM public.notificacoes n
          WHERE n.agendamento_id = a.id AND n.evento = 'LEMBRETE_2H'
       ) THEN

      -- Patient reminder text
      v_msg_pac := 'Olá, ' || COALESCE(v_pac_nome,'paciente') || '.' || chr(10) || chr(10) ||
                   'Sua consulta é daqui a pouco (em 2 horas).' || chr(10) || chr(10) ||
                   'Data: ' || to_char(a.data,'DD/MM/YYYY') || chr(10) ||
                   'Horário: ' || to_char(a.hora_inicio,'HH24:MI') || chr(10) ||
                   'Profissional: ' || COALESCE(v_prof_nome,'—') || chr(10) ||
                   'Endereço: ' || v_end;

      PERFORM public.enqueue_notificacao(v_pac_user,'Lembrete de consulta (2h)', v_msg_pac,
        'LEMBRETE_2H','INTERNO', a.id, v_pac_tel, v_pac_email);
      IF v_pac_tel IS NOT NULL THEN
        PERFORM public.enqueue_notificacao(v_pac_user,'Lembrete de consulta (2h)', v_msg_pac,
          'LEMBRETE_2H','WHATSAPP', a.id, v_pac_tel, v_pac_email);
      END IF;

      -- Professional reminder text
      IF v_prof_tel IS NOT NULL THEN
        v_msg_prof := 'Lembrete de atendimento em 2 horas.' || chr(10) || chr(10) ||
                      'Paciente: ' || COALESCE(v_pac_nome,'—') || chr(10) ||
                      'Horário: ' || to_char(a.hora_inicio,'HH24:MI');
        PERFORM public.enqueue_notificacao(v_prof_user,'Lembrete de atendimento (2h)', v_msg_prof,
          'LEMBRETE_2H','WHATSAPP', a.id, v_prof_tel, v_prof_email);
      END IF;

      criados := criados + 1;
    END IF;
  END LOOP;

  RETURN criados;
END;$function$;
