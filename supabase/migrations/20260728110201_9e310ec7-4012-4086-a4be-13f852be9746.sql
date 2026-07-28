
-- 1) Permitir notificações para destinatários sem conta (somente canais externos)
ALTER TABLE public.notificacoes ALTER COLUMN usuario_id DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.enqueue_notificacao(_usuario_id uuid, _titulo text, _mensagem text, _evento notif_evento, _canal notif_canal DEFAULT 'INTERNO'::notif_canal, _agendamento_id uuid DEFAULT NULL::uuid, _telefone text DEFAULT NULL::text, _email text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_id uuid;
BEGIN
  -- Sem usuário interno só faz sentido enfileirar canais externos com contato
  IF _usuario_id IS NULL AND (_canal = 'INTERNO' OR (_telefone IS NULL AND _email IS NULL)) THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.notificacoes (
    usuario_id, titulo, mensagem, tipo, evento, canal,
    agendamento_id, destinatario_telefone, destinatario_email,
    status_envio
  ) VALUES (
    _usuario_id, _titulo, _mensagem, 'INFO', _evento, _canal,
    _agendamento_id, _telefone, _email,
    CASE WHEN _canal = 'INTERNO' THEN 'ENVIADA'::notif_status_envio ELSE 'PENDENTE'::notif_status_envio END
  )
  RETURNING id INTO v_id;

  IF _canal = 'INTERNO' THEN
    UPDATE public.notificacoes SET enviado_em = now() WHERE id = v_id;
  END IF;

  RETURN v_id;
END;$function$;

-- 2) Mensagens mais completas (especialidade + endereço na confirmação, profissional na remarcação)
CREATE OR REPLACE FUNCTION public.on_agendamento_notify()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_prof_user uuid; v_prof_nome text; v_prof_tel text; v_prof_email text; v_esp text;
  v_pac_nome text; v_pac_user uuid; v_pac_tel text; v_pac_email text;
  v_data_str text; v_hora_str text; v_end text; v_sufixo text;
  v_dest text;
  r record;
BEGIN
  SELECT p.user_id, p.nome, COALESCE(NULLIF(p.whatsapp,''), p.telefone), p.email, e.nome
    INTO v_prof_user, v_prof_nome, v_prof_tel, v_prof_email, v_esp
    FROM public.profissionais p
    LEFT JOIN public.especialidades e ON e.id = p.especialidade_id
   WHERE p.id = NEW.profissional_id;

  SELECT pa.nome, pa.user_id, COALESCE(NULLIF(pa.whatsapp,''), pa.telefone), pa.email
    INTO v_pac_nome, v_pac_user, v_pac_tel, v_pac_email
    FROM public.pacientes pa WHERE pa.id = NEW.paciente_id;

  IF v_pac_user IS NULL THEN v_pac_user := NEW.cliente_user_id; END IF;

  SELECT endereco INTO v_end FROM public.configuracoes_clinica ORDER BY created_at LIMIT 1;

  v_data_str := to_char(NEW.data,'DD/MM/YYYY');
  v_hora_str := to_char(NEW.hora_inicio,'HH24:MI');
  v_sufixo := CASE WHEN v_esp IS NOT NULL THEN ' Especialidade: ' || v_esp || '.' ELSE '' END
           || CASE WHEN v_end IS NOT NULL THEN ' Local: ' || v_end || '.' ELSE '' END;

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
        'Sua consulta com ' || COALESCE(v_prof_nome,'o profissional') || ' foi confirmada para ' || v_data_str || ' às ' || v_hora_str || '.' || v_sufixo,
        'CONSULTA_APROVADA','INTERNO', NEW.id, v_pac_tel, v_pac_email);
      IF v_pac_tel IS NOT NULL THEN
        PERFORM public.enqueue_notificacao(v_pac_user,'Consulta confirmada (WhatsApp)',
          'Olá ' || COALESCE(v_pac_nome,'') || ', sua consulta com ' || COALESCE(v_prof_nome,'o profissional') ||
          ' foi confirmada para ' || v_data_str || ' às ' || v_hora_str || '.' || v_sufixo,
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
        'Sua consulta com ' || COALESCE(v_prof_nome,'o profissional') || ' em ' || v_data_str || ' às ' || v_hora_str || ' foi cancelada.',
        'CONSULTA_CANCELADA','INTERNO', NEW.id, v_pac_tel, v_pac_email);
      IF v_pac_tel IS NOT NULL THEN
        PERFORM public.enqueue_notificacao(v_pac_user,'Consulta cancelada (WhatsApp)',
          'Sua consulta com ' || COALESCE(v_prof_nome,'o profissional') || ' em ' || v_data_str || ' às ' || v_hora_str || ' foi cancelada.',
          'CONSULTA_CANCELADA','WHATSAPP', NEW.id, v_pac_tel, v_pac_email);
      END IF;
      PERFORM public.enqueue_notificacao(v_prof_user,'Consulta cancelada',
        'A consulta com ' || COALESCE(v_pac_nome,'paciente') || ' em ' || v_data_str || ' às ' || v_hora_str || ' foi cancelada.',
        'CONSULTA_CANCELADA','INTERNO', NEW.id, v_prof_tel, v_prof_email);
    ELSIF NEW.status = 'REMARCADO' THEN
      PERFORM public.enqueue_notificacao(v_pac_user,'Consulta remarcada',
        'Sua consulta com ' || COALESCE(v_prof_nome,'o profissional') || ' foi remarcada para ' || v_data_str || ' às ' || v_hora_str || '.' || v_sufixo,
        'CONSULTA_REMARCADA','INTERNO', NEW.id, v_pac_tel, v_pac_email);
      IF v_pac_tel IS NOT NULL THEN
        PERFORM public.enqueue_notificacao(v_pac_user,'Consulta remarcada (WhatsApp)',
          'Sua consulta com ' || COALESCE(v_prof_nome,'o profissional') || ' foi remarcada para ' || v_data_str || ' às ' || v_hora_str || '.' || v_sufixo,
          'CONSULTA_REMARCADA','WHATSAPP', NEW.id, v_pac_tel, v_pac_email);
      END IF;
      PERFORM public.enqueue_notificacao(v_prof_user,'Consulta remarcada',
        'A consulta com ' || COALESCE(v_pac_nome,'paciente') || ' foi remarcada para ' || v_data_str || ' às ' || v_hora_str || '.',
        'CONSULTA_REMARCADA','INTERNO', NEW.id, v_prof_tel, v_prof_email);
    END IF;
  END IF;

  RETURN NEW;
END;$function$;

-- 3) Verificação de conflito duplicada
DROP TRIGGER IF EXISTS trg_agendamento_conflito ON public.agendamentos;

-- 4) Limpeza dos dados de teste da homologação
DELETE FROM public.notificacoes WHERE agendamento_id IN (SELECT id FROM public.agendamentos WHERE observacoes LIKE '\_\_homolog%');
DELETE FROM public.financeiro WHERE agendamento_id IN (SELECT id FROM public.agendamentos WHERE observacoes LIKE '\_\_homolog%');
DELETE FROM public.agendamentos WHERE observacoes LIKE '\_\_homolog%';
