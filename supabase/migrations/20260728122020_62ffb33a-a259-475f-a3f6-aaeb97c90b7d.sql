-- 1) Normalizador de WhatsApp -----------------------------------------------
CREATE OR REPLACE FUNCTION public.normalizar_whatsapp(_valor text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE d text;
BEGIN
  IF _valor IS NULL THEN RETURN NULL; END IF;
  d := regexp_replace(_valor, '\D', '', 'g');
  IF d = '' THEN RETURN NULL; END IF;
  -- Remove zeros à esquerda (ex.: 082...)
  d := regexp_replace(d, '^0+', '');
  -- Já tem DDI 55 e comprimento de número brasileiro completo
  IF length(d) IN (12, 13) AND left(d, 2) = '55' THEN
    RETURN d;
  END IF;
  -- Número brasileiro sem DDI (DDD + 8 ou 9 dígitos)
  IF length(d) IN (10, 11) THEN
    RETURN '55' || d;
  END IF;
  -- Outros formatos (internacionais) permanecem apenas com os dígitos
  RETURN d;
END;
$$;

-- 2) profiles.whatsapp -------------------------------------------------------
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp text;

-- 3) Triggers de normalização ------------------------------------------------
CREATE OR REPLACE FUNCTION public.trg_normalizar_whatsapp()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.whatsapp := public.normalizar_whatsapp(NEW.whatsapp);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pacientes_norm_whatsapp ON public.pacientes;
CREATE TRIGGER trg_pacientes_norm_whatsapp
  BEFORE INSERT OR UPDATE OF whatsapp ON public.pacientes
  FOR EACH ROW EXECUTE FUNCTION public.trg_normalizar_whatsapp();

DROP TRIGGER IF EXISTS trg_profissionais_norm_whatsapp ON public.profissionais;
CREATE TRIGGER trg_profissionais_norm_whatsapp
  BEFORE INSERT OR UPDATE OF whatsapp ON public.profissionais
  FOR EACH ROW EXECUTE FUNCTION public.trg_normalizar_whatsapp();

DROP TRIGGER IF EXISTS trg_profiles_norm_whatsapp ON public.profiles;
CREATE TRIGGER trg_profiles_norm_whatsapp
  BEFORE INSERT OR UPDATE OF whatsapp ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.trg_normalizar_whatsapp();

-- Padroniza registros existentes
UPDATE public.pacientes SET whatsapp = public.normalizar_whatsapp(whatsapp) WHERE whatsapp IS NOT NULL;
UPDATE public.profissionais SET whatsapp = public.normalizar_whatsapp(whatsapp) WHERE whatsapp IS NOT NULL;

-- 4) Controle de reenvio automático e status de entrega ----------------------
ALTER TABLE public.notificacoes
  ADD COLUMN IF NOT EXISTS proxima_tentativa_em timestamptz,
  ADD COLUMN IF NOT EXISTS definitivo boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS entregue_em timestamptz,
  ADD COLUMN IF NOT EXISTS lido_em timestamptz,
  ADD COLUMN IF NOT EXISTS provider_message_id text;

CREATE INDEX IF NOT EXISTS idx_notificacoes_retry
  ON public.notificacoes (status_envio, proxima_tentativa_em)
  WHERE definitivo = false;

CREATE INDEX IF NOT EXISTS idx_notificacoes_provider_msg
  ON public.notificacoes (provider_message_id);

-- 5) Configuração do provider -----------------------------------------------
ALTER TABLE public.notificacoes_config
  ADD COLUMN IF NOT EXISTS provider_instancia text,
  ADD COLUMN IF NOT EXISTS provider_phone_number_id text,
  ADD COLUMN IF NOT EXISTS webhook_secret text;

-- 6) Destinatários das solicitações (PROFISSIONAL | RECEPCIONISTA | AMBOS |
--    ADMINISTRADOR | TODOS) ------------------------------------------------
CREATE OR REPLACE FUNCTION public.on_agendamento_notify()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_prof_user uuid; v_prof_nome text; v_prof_tel text; v_prof_email text; v_esp text;
  v_pac_nome text; v_pac_user uuid; v_pac_tel text; v_pac_email text;
  v_data_str text; v_hora_str text; v_end text;
  v_dest text;
  v_roles public.app_role[];
  v_msg text;
  r record;
BEGIN
  SELECT p.user_id, p.nome, NULLIF(p.whatsapp,''), p.email, e.nome
    INTO v_prof_user, v_prof_nome, v_prof_tel, v_prof_email, v_esp
    FROM public.profissionais p
    LEFT JOIN public.especialidades e ON e.id = p.especialidade_id
   WHERE p.id = NEW.profissional_id;

  SELECT pa.nome, pa.user_id, NULLIF(pa.whatsapp,''), pa.email
    INTO v_pac_nome, v_pac_user, v_pac_tel, v_pac_email
    FROM public.pacientes pa WHERE pa.id = NEW.paciente_id;

  IF v_pac_user IS NULL THEN v_pac_user := NEW.cliente_user_id; END IF;

  SELECT endereco INTO v_end FROM public.configuracoes_clinica ORDER BY created_at LIMIT 1;

  v_data_str := to_char(NEW.data,'DD/MM/YYYY');
  v_hora_str := to_char(NEW.hora_inicio,'HH24:MI');

  SELECT COALESCE(destinatario_solicitacao,'PROFISSIONAL') INTO v_dest FROM public.notif_config();
  v_dest := COALESCE(v_dest, 'PROFISSIONAL');

  v_roles := CASE v_dest
    WHEN 'RECEPCIONISTA'  THEN ARRAY['RECEPCIONISTA']::public.app_role[]
    WHEN 'AMBOS'          THEN ARRAY['RECEPCIONISTA']::public.app_role[]
    WHEN 'ADMINISTRADOR'  THEN ARRAY['ADMIN']::public.app_role[]
    WHEN 'TODOS'          THEN ARRAY['RECEPCIONISTA','ADMIN']::public.app_role[]
    ELSE ARRAY[]::public.app_role[]
  END;

  IF TG_OP = 'INSERT' AND NEW.status = 'PENDENTE' THEN
    -- Profissional sempre recebe a notificação interna
    PERFORM public.enqueue_notificacao(
      v_prof_user,'Nova solicitação de consulta',
      'Você recebeu uma nova solicitação de consulta de ' || COALESCE(v_pac_nome,'um paciente') ||
        ' em ' || v_data_str || ' às ' || v_hora_str || '.',
      'SOLICITACAO_NOVA','INTERNO', NEW.id, v_prof_tel, v_prof_email
    );

    IF v_dest IN ('PROFISSIONAL','AMBOS','TODOS') AND v_prof_tel IS NOT NULL THEN
      PERFORM public.enqueue_notificacao(
        v_prof_user,'Nova solicitação de consulta',
        'Nova solicitação de consulta.' || chr(10) ||
        'Paciente: ' || COALESCE(v_pac_nome,'—') || chr(10) ||
        'Data: ' || v_data_str || chr(10) ||
        'Horário: ' || v_hora_str || chr(10) || chr(10) ||
        'Acesse o painel da clínica para aprovar ou recusar.',
        'SOLICITACAO_NOVA','WHATSAPP', NEW.id, v_prof_tel, v_prof_email
      );
    END IF;

    IF array_length(v_roles, 1) > 0 THEN
      FOR r IN
        SELECT DISTINCT pr.id AS user_id,
               COALESCE(NULLIF(pr.whatsapp,''), NULLIF(pr.telefone,'')) AS telefone,
               pr.email
          FROM public.user_roles ur
          JOIN public.profiles pr ON pr.id = ur.user_id
         WHERE ur.role = ANY(v_roles) AND COALESCE(pr.ativo, true)
      LOOP
        PERFORM public.enqueue_notificacao(
          r.user_id,'Nova solicitação de consulta',
          'Nova solicitação de ' || COALESCE(v_pac_nome,'paciente') || ' com ' || COALESCE(v_prof_nome,'profissional') ||
            ' em ' || v_data_str || ' às ' || v_hora_str || '.',
          'SOLICITACAO_NOVA','INTERNO', NEW.id, r.telefone, r.email
        );
        IF r.telefone IS NOT NULL THEN
          PERFORM public.enqueue_notificacao(
            r.user_id,'Nova solicitação de consulta',
            'Nova solicitação de consulta.' || chr(10) ||
            'Paciente: ' || COALESCE(v_pac_nome,'—') || chr(10) ||
            'Profissional: ' || COALESCE(v_prof_nome,'—') || chr(10) ||
            'Data: ' || v_data_str || chr(10) ||
            'Horário: ' || v_hora_str,
            'SOLICITACAO_NOVA','WHATSAPP', NEW.id, r.telefone, r.email
          );
        END IF;
      END LOOP;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'APROVADO' THEN
      v_msg := 'Olá, ' || COALESCE(v_pac_nome,'paciente') || '.' || chr(10) || chr(10) ||
               'Sua consulta foi CONFIRMADA.' || chr(10) || chr(10) ||
               'Profissional: ' || COALESCE(v_prof_nome,'—') || chr(10) ||
               'Especialidade: ' || COALESCE(v_esp,'—') || chr(10) ||
               'Data: ' || v_data_str || chr(10) ||
               'Horário: ' || v_hora_str || chr(10) ||
               'Endereço: ' || COALESCE(v_end,'consulte a clínica') || chr(10) || chr(10) ||
               'Caso precise remarcar ou cancelar, acesse sua Área do Paciente.';
      PERFORM public.enqueue_notificacao(v_pac_user,'Consulta confirmada', v_msg,
        'CONSULTA_APROVADA','INTERNO', NEW.id, v_pac_tel, v_pac_email);
      IF v_pac_tel IS NOT NULL THEN
        PERFORM public.enqueue_notificacao(v_pac_user,'Consulta confirmada', v_msg,
          'CONSULTA_APROVADA','WHATSAPP', NEW.id, v_pac_tel, v_pac_email);
      END IF;

    ELSIF NEW.status = 'RECUSADO' THEN
      v_msg := 'Olá, ' || COALESCE(v_pac_nome,'paciente') || '.' || chr(10) || chr(10) ||
               'Infelizmente sua solicitação de consulta para ' || v_data_str || ' às ' || v_hora_str ||
               ' não pôde ser aprovada.' || chr(10) || chr(10) ||
               'Acesse sua Área do Paciente para escolher outro horário.';
      PERFORM public.enqueue_notificacao(v_pac_user,'Solicitação recusada', v_msg,
        'CONSULTA_RECUSADA','INTERNO', NEW.id, v_pac_tel, v_pac_email);
      IF v_pac_tel IS NOT NULL THEN
        PERFORM public.enqueue_notificacao(v_pac_user,'Solicitação recusada', v_msg,
          'CONSULTA_RECUSADA','WHATSAPP', NEW.id, v_pac_tel, v_pac_email);
      END IF;

    ELSIF NEW.status = 'CANCELADO' THEN
      v_msg := 'Olá, ' || COALESCE(v_pac_nome,'paciente') || '.' || chr(10) || chr(10) ||
               'Sua consulta foi CANCELADA.' || chr(10) || chr(10) ||
               'Profissional: ' || COALESCE(v_prof_nome,'—') || chr(10) ||
               'Data: ' || v_data_str || chr(10) ||
               'Horário: ' || v_hora_str || chr(10) || chr(10) ||
               'Para agendar novamente, acesse sua Área do Paciente.';
      PERFORM public.enqueue_notificacao(v_pac_user,'Consulta cancelada', v_msg,
        'CONSULTA_CANCELADA','INTERNO', NEW.id, v_pac_tel, v_pac_email);
      IF v_pac_tel IS NOT NULL THEN
        PERFORM public.enqueue_notificacao(v_pac_user,'Consulta cancelada', v_msg,
          'CONSULTA_CANCELADA','WHATSAPP', NEW.id, v_pac_tel, v_pac_email);
      END IF;
      PERFORM public.enqueue_notificacao(v_prof_user,'Consulta cancelada',
        'A consulta com ' || COALESCE(v_pac_nome,'paciente') || ' em ' || v_data_str || ' às ' || v_hora_str || ' foi cancelada.',
        'CONSULTA_CANCELADA','INTERNO', NEW.id, v_prof_tel, v_prof_email);

    ELSIF NEW.status = 'REMARCADO' THEN
      v_msg := 'Olá, ' || COALESCE(v_pac_nome,'paciente') || '.' || chr(10) || chr(10) ||
               'Sua consulta foi REMARCADA.' || chr(10) || chr(10) ||
               'Profissional: ' || COALESCE(v_prof_nome,'—') || chr(10) ||
               'Especialidade: ' || COALESCE(v_esp,'—') || chr(10) ||
               'Nova data: ' || v_data_str || chr(10) ||
               'Novo horário: ' || v_hora_str || chr(10) ||
               'Endereço: ' || COALESCE(v_end,'consulte a clínica') || chr(10) || chr(10) ||
               'Caso precise remarcar ou cancelar, acesse sua Área do Paciente.';
      PERFORM public.enqueue_notificacao(v_pac_user,'Consulta remarcada', v_msg,
        'CONSULTA_REMARCADA','INTERNO', NEW.id, v_pac_tel, v_pac_email);
      IF v_pac_tel IS NOT NULL THEN
        PERFORM public.enqueue_notificacao(v_pac_user,'Consulta remarcada', v_msg,
          'CONSULTA_REMARCADA','WHATSAPP', NEW.id, v_pac_tel, v_pac_email);
      END IF;
      PERFORM public.enqueue_notificacao(v_prof_user,'Consulta remarcada',
        'A consulta com ' || COALESCE(v_pac_nome,'paciente') || ' foi remarcada para ' || v_data_str || ' às ' || v_hora_str || '.',
        'CONSULTA_REMARCADA','INTERNO', NEW.id, v_prof_tel, v_prof_email);
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
