-- Helper: contato preferencial do paciente
CREATE OR REPLACE FUNCTION public.notif_config()
RETURNS public.notificacoes_config
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT * FROM public.notificacoes_config ORDER BY created_at LIMIT 1 $$;

REVOKE EXECUTE ON FUNCTION public.notif_config() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.on_agendamento_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_prof_user uuid; v_prof_nome text; v_prof_tel text; v_prof_email text;
  v_pac_nome text; v_pac_user uuid; v_pac_tel text; v_pac_email text;
  v_data_str text; v_hora_str text;
  v_dest text;
  r record;
BEGIN
  SELECT p.user_id, p.nome, COALESCE(NULLIF(p.whatsapp,''), p.telefone), p.email
    INTO v_prof_user, v_prof_nome, v_prof_tel, v_prof_email
    FROM public.profissionais p WHERE p.id = NEW.profissional_id;

  SELECT pa.nome, pa.user_id, COALESCE(NULLIF(pa.whatsapp,''), pa.telefone), pa.email
    INTO v_pac_nome, v_pac_user, v_pac_tel, v_pac_email
    FROM public.pacientes pa WHERE pa.id = NEW.paciente_id;

  IF v_pac_user IS NULL THEN v_pac_user := NEW.cliente_user_id; END IF;

  v_data_str := to_char(NEW.data,'DD/MM/YYYY');
  v_hora_str := to_char(NEW.hora_inicio,'HH24:MI');

  SELECT COALESCE(destinatario_solicitacao,'PROFISSIONAL') INTO v_dest FROM public.notif_config();
  v_dest := COALESCE(v_dest, 'PROFISSIONAL');

  IF TG_OP = 'INSERT' AND NEW.status = 'PENDENTE' THEN
    PERFORM public.enqueue_notificacao(
      v_prof_user,'Nova solicitação de consulta',
      'Você recebeu uma nova solicitação de consulta de ' || COALESCE(v_pac_nome,'um paciente') ||
        ' em ' || v_data_str || ' às ' || v_hora_str || '.',
      'SOLICITACAO_NOVA','INTERNO', NEW.id, v_prof_tel, v_prof_email
    );

    IF v_dest IN ('PROFISSIONAL','AMBOS') AND v_prof_tel IS NOT NULL THEN
      PERFORM public.enqueue_notificacao(
        v_prof_user,'Nova solicitação (WhatsApp)',
        'Nova solicitação de ' || COALESCE(v_pac_nome,'paciente') || ' em ' || v_data_str || ' às ' || v_hora_str || '.',
        'SOLICITACAO_NOVA','WHATSAPP', NEW.id, v_prof_tel, v_prof_email
      );
    END IF;

    IF v_dest IN ('RECEPCIONISTA','AMBOS') THEN
      FOR r IN
        SELECT pr.id AS user_id, pr.telefone, pr.email
          FROM public.user_roles ur
          JOIN public.profiles pr ON pr.id = ur.user_id
         WHERE ur.role = 'RECEPCIONISTA' AND COALESCE(pr.ativo, true)
      LOOP
        PERFORM public.enqueue_notificacao(
          r.user_id,'Nova solicitação de consulta',
          'Nova solicitação de ' || COALESCE(v_pac_nome,'paciente') || ' com ' || COALESCE(v_prof_nome,'profissional') ||
            ' em ' || v_data_str || ' às ' || v_hora_str || '.',
          'SOLICITACAO_NOVA','INTERNO', NEW.id, r.telefone, r.email
        );
        IF r.telefone IS NOT NULL THEN
          PERFORM public.enqueue_notificacao(
            r.user_id,'Nova solicitação (WhatsApp)',
            'Nova solicitação de ' || COALESCE(v_pac_nome,'paciente') || ' em ' || v_data_str || ' às ' || v_hora_str || '.',
            'SOLICITACAO_NOVA','WHATSAPP', NEW.id, r.telefone, r.email
          );
        END IF;
      END LOOP;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'APROVADO' THEN
      PERFORM public.enqueue_notificacao(v_pac_user,'Consulta confirmada',
        'Sua consulta com ' || COALESCE(v_prof_nome,'o profissional') || ' foi confirmada para ' || v_data_str || ' às ' || v_hora_str || '.',
        'CONSULTA_APROVADA','INTERNO', NEW.id, v_pac_tel, v_pac_email);
      IF v_pac_tel IS NOT NULL THEN
        PERFORM public.enqueue_notificacao(v_pac_user,'Consulta confirmada (WhatsApp)',
          'Olá ' || COALESCE(v_pac_nome,'') || ', sua consulta foi confirmada para ' || v_data_str || ' às ' || v_hora_str || '.',
          'CONSULTA_APROVADA','WHATSAPP', NEW.id, v_pac_tel, v_pac_email);
      END IF;
    ELSIF NEW.status = 'RECUSADO' THEN
      PERFORM public.enqueue_notificacao(v_pac_user,'Solicitação recusada',
        'Sua solicitação de consulta em ' || v_data_str || ' às ' || v_hora_str || ' não foi aprovada.',
        'CONSULTA_RECUSADA','INTERNO', NEW.id, v_pac_tel, v_pac_email);
      IF v_pac_tel IS NOT NULL THEN
        PERFORM public.enqueue_notificacao(v_pac_user,'Solicitação recusada (WhatsApp)',
          'Sua solicitação em ' || v_data_str || ' às ' || v_hora_str || ' não foi aprovada.',
          'CONSULTA_RECUSADA','WHATSAPP', NEW.id, v_pac_tel, v_pac_email);
      END IF;
    ELSIF NEW.status = 'CANCELADO' THEN
      PERFORM public.enqueue_notificacao(v_pac_user,'Consulta cancelada',
        'Sua consulta em ' || v_data_str || ' às ' || v_hora_str || ' foi cancelada.',
        'CONSULTA_CANCELADA','INTERNO', NEW.id, v_pac_tel, v_pac_email);
      IF v_pac_tel IS NOT NULL THEN
        PERFORM public.enqueue_notificacao(v_pac_user,'Consulta cancelada (WhatsApp)',
          'Sua consulta em ' || v_data_str || ' às ' || v_hora_str || ' foi cancelada.',
          'CONSULTA_CANCELADA','WHATSAPP', NEW.id, v_pac_tel, v_pac_email);
      END IF;
      PERFORM public.enqueue_notificacao(v_prof_user,'Consulta cancelada',
        'A consulta com ' || COALESCE(v_pac_nome,'paciente') || ' em ' || v_data_str || ' às ' || v_hora_str || ' foi cancelada.',
        'CONSULTA_CANCELADA','INTERNO', NEW.id, v_prof_tel, v_prof_email);
    ELSIF NEW.status = 'REMARCADO' THEN
      PERFORM public.enqueue_notificacao(v_pac_user,'Consulta remarcada',
        'Sua consulta foi remarcada para ' || v_data_str || ' às ' || v_hora_str || '.',
        'CONSULTA_REMARCADA','INTERNO', NEW.id, v_pac_tel, v_pac_email);
      IF v_pac_tel IS NOT NULL THEN
        PERFORM public.enqueue_notificacao(v_pac_user,'Consulta remarcada (WhatsApp)',
          'Sua consulta foi remarcada para ' || v_data_str || ' às ' || v_hora_str || '.',
          'CONSULTA_REMARCADA','WHATSAPP', NEW.id, v_pac_tel, v_pac_email);
      END IF;
      PERFORM public.enqueue_notificacao(v_prof_user,'Consulta remarcada',
        'A consulta com ' || COALESCE(v_pac_nome,'paciente') || ' foi remarcada para ' || v_data_str || ' às ' || v_hora_str || '.',
        'CONSULTA_REMARCADA','INTERNO', NEW.id, v_prof_tel, v_prof_email);
    END IF;
  END IF;

  RETURN NEW;
END;$function$;

CREATE OR REPLACE FUNCTION public.on_financeiro_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  v_pac_user uuid; v_pac_nome text; v_pac_tel text; v_pac_email text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status_pagamento = 'PAGO' AND OLD.status_pagamento IS DISTINCT FROM 'PAGO' THEN
    SELECT pa.user_id, pa.nome, COALESCE(NULLIF(pa.whatsapp,''), pa.telefone), pa.email
      INTO v_pac_user, v_pac_nome, v_pac_tel, v_pac_email
      FROM public.pacientes pa WHERE pa.id = NEW.paciente_id;

    PERFORM public.enqueue_notificacao(
      v_pac_user,'Pagamento confirmado',
      'Recebemos o pagamento de R$ ' || to_char(NEW.valor,'FM999G999D00') || '. Obrigado!',
      'PAGAMENTO_CONFIRMADO','INTERNO', NEW.agendamento_id, v_pac_tel, v_pac_email
    );

    IF v_pac_tel IS NOT NULL THEN
      PERFORM public.enqueue_notificacao(
        v_pac_user,'Pagamento confirmado (WhatsApp)',
        'Recebemos o pagamento de R$ ' || to_char(NEW.valor,'FM999G999D00') || '. Obrigado!',
        'PAGAMENTO_CONFIRMADO','WHATSAPP', NEW.agendamento_id, v_pac_tel, v_pac_email
      );
    END IF;
  END IF;
  RETURN NEW;
END;$function$;

-- Geração de lembretes (24h e 2h)
CREATE OR REPLACE FUNCTION public.gerar_lembretes()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  cfg public.notificacoes_config;
  a record;
  criados int := 0;
  v_pac_user uuid; v_pac_nome text; v_pac_tel text; v_pac_email text; v_prof_nome text;
  v_when timestamptz;
BEGIN
  SELECT * INTO cfg FROM public.notif_config();

  FOR a IN
    SELECT ag.*, (ag.data + ag.hora_inicio) AT TIME ZONE 'America/Sao_Paulo' AS inicio_ts
      FROM public.agendamentos ag
     WHERE ag.status IN ('APROVADO','REMARCADO')
       AND ag.data BETWEEN CURRENT_DATE - 1 AND CURRENT_DATE + 2
  LOOP
    SELECT pa.user_id, pa.nome, COALESCE(NULLIF(pa.whatsapp,''), pa.telefone), pa.email
      INTO v_pac_user, v_pac_nome, v_pac_tel, v_pac_email
      FROM public.pacientes pa WHERE pa.id = a.paciente_id;
    IF v_pac_user IS NULL THEN v_pac_user := a.cliente_user_id; END IF;
    SELECT nome INTO v_prof_nome FROM public.profissionais WHERE id = a.profissional_id;

    v_when := a.inicio_ts;

    -- 24h
    IF COALESCE(cfg.lembrete_24h_ativo, true)
       AND now() >= v_when - interval '24 hours' AND now() < v_when
       AND NOT EXISTS (
         SELECT 1 FROM public.notificacoes n
          WHERE n.agendamento_id = a.id AND n.evento = 'LEMBRETE_24H'
       ) THEN
      PERFORM public.enqueue_notificacao(v_pac_user,'Lembrete de consulta',
        'Lembrete: sua consulta com ' || COALESCE(v_prof_nome,'o profissional') || ' é em ' ||
        to_char(a.data,'DD/MM/YYYY') || ' às ' || to_char(a.hora_inicio,'HH24:MI') || '.',
        'LEMBRETE_24H','INTERNO', a.id, v_pac_tel, v_pac_email);
      IF v_pac_tel IS NOT NULL THEN
        PERFORM public.enqueue_notificacao(v_pac_user,'Lembrete de consulta (WhatsApp)',
          'Lembrete: sua consulta é em ' || to_char(a.data,'DD/MM/YYYY') || ' às ' || to_char(a.hora_inicio,'HH24:MI') || '.',
          'LEMBRETE_24H','WHATSAPP', a.id, v_pac_tel, v_pac_email);
      END IF;
      criados := criados + 1;
    END IF;

    -- 2h (opcional)
    IF COALESCE(cfg.lembrete_2h_ativo, false)
       AND now() >= v_when - interval '2 hours' AND now() < v_when
       AND NOT EXISTS (
         SELECT 1 FROM public.notificacoes n
          WHERE n.agendamento_id = a.id AND n.evento = 'LEMBRETE_2H'
       ) THEN
      PERFORM public.enqueue_notificacao(v_pac_user,'Sua consulta é daqui a pouco',
        'Sua consulta com ' || COALESCE(v_prof_nome,'o profissional') || ' começa às ' ||
        to_char(a.hora_inicio,'HH24:MI') || ' hoje.',
        'LEMBRETE_2H','INTERNO', a.id, v_pac_tel, v_pac_email);
      IF v_pac_tel IS NOT NULL THEN
        PERFORM public.enqueue_notificacao(v_pac_user,'Sua consulta é daqui a pouco (WhatsApp)',
          'Sua consulta começa às ' || to_char(a.hora_inicio,'HH24:MI') || ' hoje.',
          'LEMBRETE_2H','WHATSAPP', a.id, v_pac_tel, v_pac_email);
      END IF;
      criados := criados + 1;
    END IF;
  END LOOP;

  RETURN criados;
END;$function$;

REVOKE EXECUTE ON FUNCTION public.gerar_lembretes() FROM PUBLIC, anon, authenticated;
