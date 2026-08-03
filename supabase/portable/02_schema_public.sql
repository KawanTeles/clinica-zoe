--
-- PostgreSQL database dump
--



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA IF NOT EXISTS public;


--
-- Name: agendamento_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.agendamento_status AS ENUM (
    'PENDENTE',
    'APROVADO',
    'RECUSADO',
    'CANCELADO',
    'REMARCADO',
    'FINALIZADO'
);


--
-- Name: app_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.app_role AS ENUM (
    'ADMIN',
    'RECEPCIONISTA',
    'PROFISSIONAL',
    'CLIENTE'
);


--
-- Name: financeiro_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.financeiro_status AS ENUM (
    'ABERTO',
    'PAGO',
    'CANCELADO',
    'PARCIAL'
);


--
-- Name: forma_pagamento; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.forma_pagamento AS ENUM (
    'DINHEIRO',
    'PIX',
    'CARTAO_DEBITO',
    'CARTAO_CREDITO',
    'OUTRO'
);


--
-- Name: notif_canal; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notif_canal AS ENUM (
    'WHATSAPP',
    'EMAIL',
    'INTERNO'
);


--
-- Name: notif_evento; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notif_evento AS ENUM (
    'SOLICITACAO_NOVA',
    'CONSULTA_APROVADA',
    'CONSULTA_RECUSADA',
    'CONSULTA_CANCELADA',
    'CONSULTA_REMARCADA',
    'LEMBRETE_24H',
    'PAGAMENTO_CONFIRMADO',
    'LEMBRETE_2H'
);


--
-- Name: notif_status_envio; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notif_status_envio AS ENUM (
    'PENDENTE',
    'ENVIANDO',
    'ENVIADA',
    'ERRO',
    'CANCELADA',
    'ENTREGUE',
    'LIDO',
    'RESPONDIDO'
);


--
-- Name: profissional_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.profissional_status AS ENUM (
    'ATIVO',
    'INATIVO'
);


--
-- Name: wa_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.wa_status AS ENUM (
    'PENDENTE',
    'ENVIADO',
    'FALHOU'
);


--
-- Name: check_agendamento_conflito(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_agendamento_conflito() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  dow SMALLINT;
BEGIN
  IF NEW.status IN ('PENDENTE','APROVADO','REMARCADO') THEN
    -- Conflito com outros agendamentos
    IF EXISTS (
      SELECT 1 FROM public.agendamentos a
      WHERE a.profissional_id = NEW.profissional_id
        AND a.data = NEW.data
        AND a.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND a.status IN ('PENDENTE','APROVADO','REMARCADO')
        AND (NEW.hora_inicio, NEW.hora_fim) OVERLAPS (a.hora_inicio, a.hora_fim)
    ) THEN
      RAISE EXCEPTION 'Conflito de horário: já existe um agendamento neste intervalo.';
    END IF;

    -- Conflito com bloqueio
    IF EXISTS (
      SELECT 1 FROM public.profissional_bloqueio b
      WHERE b.profissional_id = NEW.profissional_id
        AND b.data = NEW.data
        AND (NEW.hora_inicio, NEW.hora_fim) OVERLAPS (b.hora_inicio, b.hora_fim)
    ) THEN
      RAISE EXCEPTION 'Horário bloqueado para este profissional.';
    END IF;

    -- Deve estar dentro da disponibilidade (se houver alguma configurada)
    dow := EXTRACT(DOW FROM NEW.data)::SMALLINT;
    IF EXISTS (SELECT 1 FROM public.profissional_disponibilidade d WHERE d.profissional_id = NEW.profissional_id) THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.profissional_disponibilidade d
        WHERE d.profissional_id = NEW.profissional_id
          AND d.dia_semana = dow
          AND NEW.hora_inicio >= d.hora_inicio
          AND NEW.hora_fim <= d.hora_fim
      ) THEN
        RAISE EXCEPTION 'Fora da disponibilidade do profissional.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;$$;


--
-- Name: current_user_has_role(public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_user_has_role(_role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = _role);
$$;


--
-- Name: enqueue_notificacao(uuid, text, text, public.notif_evento, public.notif_canal, uuid, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.enqueue_notificacao(_usuario_id uuid, _titulo text, _mensagem text, _evento public.notif_evento, _canal public.notif_canal DEFAULT 'INTERNO'::public.notif_canal, _agendamento_id uuid DEFAULT NULL::uuid, _telefone text DEFAULT NULL::text, _email text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
END;$$;


--
-- Name: gerar_lembretes(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gerar_lembretes() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  cfg public.notificacoes_config;
  a record;
  criados int := 0;
  v_pac_user uuid; v_pac_nome text; v_pac_tel text; v_pac_email text; v_prof_nome text;
  v_end text; v_msg text;
  v_when timestamptz;
BEGIN
  SELECT * INTO cfg FROM public.notif_config();
  SELECT endereco INTO v_end FROM public.configuracoes_clinica ORDER BY created_at LIMIT 1;

  FOR a IN
    SELECT ag.*, (ag.data + ag.hora_inicio) AT TIME ZONE 'America/Sao_Paulo' AS inicio_ts
      FROM public.agendamentos ag
     WHERE ag.status IN ('APROVADO','REMARCADO')
       AND ag.data BETWEEN CURRENT_DATE - 1 AND CURRENT_DATE + 2
  LOOP
    SELECT pa.user_id, pa.nome, NULLIF(pa.whatsapp,''), pa.email
      INTO v_pac_user, v_pac_nome, v_pac_tel, v_pac_email
      FROM public.pacientes pa WHERE pa.id = a.paciente_id;
    IF v_pac_user IS NULL THEN v_pac_user := a.cliente_user_id; END IF;
    SELECT nome INTO v_prof_nome FROM public.profissionais WHERE id = a.profissional_id;

    v_when := a.inicio_ts;

    IF COALESCE(cfg.lembrete_24h_ativo, true)
       AND now() >= v_when - interval '24 hours' AND now() < v_when
       AND NOT EXISTS (
         SELECT 1 FROM public.notificacoes n
          WHERE n.agendamento_id = a.id AND n.evento = 'LEMBRETE_24H'
       ) THEN
      v_msg := 'Olá, ' || COALESCE(v_pac_nome,'paciente') || '.' || chr(10) || chr(10) ||
               'Este é um lembrete da sua consulta.' || chr(10) || chr(10) ||
               'Data: ' || to_char(a.data,'DD/MM/YYYY') || chr(10) ||
               'Horário: ' || to_char(a.hora_inicio,'HH24:MI') || chr(10) ||
               'Profissional: ' || COALESCE(v_prof_nome,'—') || chr(10) ||
               'Endereço: ' || COALESCE(v_end,'consulte a clínica') || chr(10) || chr(10) ||
               'Caso não possa comparecer, acesse sua Área do Paciente para remarcar ou cancelar.';
      PERFORM public.enqueue_notificacao(v_pac_user,'Lembrete de consulta', v_msg,
        'LEMBRETE_24H','INTERNO', a.id, v_pac_tel, v_pac_email);
      IF v_pac_tel IS NOT NULL THEN
        PERFORM public.enqueue_notificacao(v_pac_user,'Lembrete de consulta', v_msg,
          'LEMBRETE_24H','WHATSAPP', a.id, v_pac_tel, v_pac_email);
      END IF;
      criados := criados + 1;
    END IF;

    IF COALESCE(cfg.lembrete_2h_ativo, false)
       AND now() >= v_when - interval '2 hours' AND now() < v_when
       AND NOT EXISTS (
         SELECT 1 FROM public.notificacoes n
          WHERE n.agendamento_id = a.id AND n.evento = 'LEMBRETE_2H'
       ) THEN
      v_msg := 'Olá, ' || COALESCE(v_pac_nome,'paciente') || '.' || chr(10) || chr(10) ||
               'Sua consulta começa em breve.' || chr(10) || chr(10) ||
               'Data: ' || to_char(a.data,'DD/MM/YYYY') || chr(10) ||
               'Horário: ' || to_char(a.hora_inicio,'HH24:MI') || chr(10) ||
               'Profissional: ' || COALESCE(v_prof_nome,'—') || chr(10) ||
               'Endereço: ' || COALESCE(v_end,'consulte a clínica') || chr(10) || chr(10) ||
               'Caso não possa comparecer, acesse sua Área do Paciente para remarcar ou cancelar.';
      PERFORM public.enqueue_notificacao(v_pac_user,'Sua consulta é daqui a pouco', v_msg,
        'LEMBRETE_2H','INTERNO', a.id, v_pac_tel, v_pac_email);
      IF v_pac_tel IS NOT NULL THEN
        PERFORM public.enqueue_notificacao(v_pac_user,'Sua consulta é daqui a pouco', v_msg,
          'LEMBRETE_2H','WHATSAPP', a.id, v_pac_tel, v_pac_email);
      END IF;
      criados := criados + 1;
    END IF;
  END LOOP;

  RETURN criados;
END;$$;


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  is_first boolean;
  assigned public.app_role;
BEGIN
  INSERT INTO public.profiles (id, nome, email, telefone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', split_part(NEW.email,'@',1)),
    NEW.email,
    NEW.raw_user_meta_data->>'telefone'
  )
  ON CONFLICT (id) DO NOTHING;

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles) INTO is_first;
  IF is_first THEN
    assigned := 'ADMIN';
  ELSE
    assigned := 'CLIENTE';
  END IF;

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, assigned)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;$$;


--
-- Name: has_role(uuid, public.app_role); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;


--
-- Name: horarios_disponiveis(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.horarios_disponiveis(p_profissional_id uuid, p_data date) RETURNS TABLE(hora_inicio time without time zone, hora_fim time without time zone)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_duracao int;
  v_dia_semana int;
  r record;
  slot_start time;
  slot_end time;
BEGIN
  SELECT COALESCE(duracao_consulta_min, 30) INTO v_duracao
    FROM public.profissionais WHERE id = p_profissional_id AND status = 'ATIVO';
  IF v_duracao IS NULL THEN RETURN; END IF;

  v_dia_semana := EXTRACT(DOW FROM p_data)::int;

  FOR r IN
    SELECT d.hora_inicio AS d_ini, d.hora_fim AS d_fim
    FROM public.profissional_disponibilidade d
    WHERE d.profissional_id = p_profissional_id
      AND d.dia_semana = v_dia_semana
    ORDER BY d.hora_inicio
  LOOP
    slot_start := r.d_ini;
    LOOP
      slot_end := slot_start + (v_duracao || ' minutes')::interval;
      EXIT WHEN slot_end > r.d_fim;

      -- Skip if in the past for today
      IF p_data > CURRENT_DATE
         OR (p_data = CURRENT_DATE AND slot_start > CURRENT_TIME)
      THEN
        -- Not overlapped by bloqueio
        IF NOT EXISTS (
          SELECT 1 FROM public.profissional_bloqueio b
          WHERE b.profissional_id = p_profissional_id
            AND b.data = p_data
            AND b.hora_inicio < slot_end
            AND b.hora_fim > slot_start
        )
        -- Not overlapped by existing non-cancelled agendamento
        AND NOT EXISTS (
          SELECT 1 FROM public.agendamentos a
          WHERE a.profissional_id = p_profissional_id
            AND a.data = p_data
            AND a.status NOT IN ('CANCELADO','RECUSADO')
            AND a.hora_inicio < slot_end
            AND a.hora_fim > slot_start
        )
        THEN
          hora_inicio := slot_start;
          hora_fim := slot_end;
          RETURN NEXT;
        END IF;
      END IF;

      slot_start := slot_end;
    END LOOP;
  END LOOP;
END;
$$;


--
-- Name: normalizar_whatsapp(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalizar_whatsapp(_valor text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
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


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: notificacoes_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notificacoes_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    destinatario_solicitacao text DEFAULT 'PROFISSIONAL'::text NOT NULL,
    lembrete_24h_ativo boolean DEFAULT true NOT NULL,
    lembrete_2h_ativo boolean DEFAULT false NOT NULL,
    provider text DEFAULT 'console'::text NOT NULL,
    provider_url text,
    provider_token text,
    remetente text,
    conexao_status text DEFAULT 'NAO_TESTADA'::text NOT NULL,
    conexao_testada_em timestamp with time zone,
    conexao_erro text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    janela_inicio time without time zone DEFAULT '08:00:00'::time without time zone NOT NULL,
    janela_fim time without time zone DEFAULT '20:00:00'::time without time zone NOT NULL,
    janela_ativa boolean DEFAULT true NOT NULL,
    templates jsonb DEFAULT '{}'::jsonb NOT NULL,
    provider_instancia text,
    provider_phone_number_id text,
    webhook_secret text,
    CONSTRAINT notificacoes_config_destinatario_chk CHECK ((destinatario_solicitacao = ANY (ARRAY['PROFISSIONAL'::text, 'RECEPCIONISTA'::text, 'AMBOS'::text, 'ADMINISTRADOR'::text, 'TODOS'::text])))
);


--
-- Name: notif_config(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.notif_config() RETURNS public.notificacoes_config
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$ SELECT * FROM public.notificacoes_config ORDER BY created_at LIMIT 1 $$;


--
-- Name: on_agendamento_aprovado(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.on_agendamento_aprovado() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_valor numeric(10,2);
BEGIN
  IF NEW.status = 'APROVADO' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'APROVADO') THEN
    v_valor := COALESCE(NEW.valor, 0);

    IF v_valor <= 0 THEN
      RAISE EXCEPTION 'Agendamento sem valor congelado. Defina o valor antes de aprovar.';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.financeiro f WHERE f.agendamento_id = NEW.id) THEN
      INSERT INTO public.financeiro (agendamento_id, paciente_id, profissional_id, valor, forma_pagamento, status_pagamento)
      VALUES (NEW.id, NEW.paciente_id, NEW.profissional_id, v_valor, NEW.forma_pagamento, 'ABERTO');
    ELSE
      UPDATE public.financeiro
         SET valor = v_valor,
             forma_pagamento = NEW.forma_pagamento
       WHERE agendamento_id = NEW.id
         AND valor IS DISTINCT FROM v_valor;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE'
     AND NEW.status IN ('CANCELADO','RECUSADO')
     AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.financeiro
       SET status_pagamento = 'CANCELADO'
     WHERE agendamento_id = NEW.id
       AND status_pagamento = 'ABERTO';
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: on_agendamento_notify(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.on_agendamento_notify() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: on_financeiro_notify(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.on_financeiro_notify() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE
  v_pac_user uuid; v_pac_nome text; v_pac_tel text; v_pac_email text; v_valor text; v_msg text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status_pagamento = 'PAGO' AND OLD.status_pagamento IS DISTINCT FROM 'PAGO' THEN
    SELECT pa.user_id, pa.nome, NULLIF(pa.whatsapp,''), pa.email
      INTO v_pac_user, v_pac_nome, v_pac_tel, v_pac_email
      FROM public.pacientes pa WHERE pa.id = NEW.paciente_id;

    v_valor := translate(to_char(NEW.valor, 'FM999G999D00'), '.,', ',.');

    v_msg := 'Olá, ' || COALESCE(v_pac_nome,'paciente') || '.' || chr(10) || chr(10) ||
             'Pagamento confirmado no valor de R$ ' || v_valor || '.' || chr(10) || chr(10) ||
             'Obrigado pela confiança.';

    PERFORM public.enqueue_notificacao(v_pac_user,'Pagamento confirmado', v_msg,
      'PAGAMENTO_CONFIRMADO','INTERNO', NEW.agendamento_id, v_pac_tel, v_pac_email);

    IF v_pac_tel IS NOT NULL THEN
      PERFORM public.enqueue_notificacao(v_pac_user,'Pagamento confirmado', v_msg,
        'PAGAMENTO_CONFIRMADO','WHATSAPP', NEW.agendamento_id, v_pac_tel, v_pac_email);
    END IF;
  END IF;
  RETURN NEW;
END;$_$;


--
-- Name: resolve_valor_consulta(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_valor_consulta(_profissional_id uuid, _forma_pagamento text) RETURNS numeric
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_avista numeric;
  v_cartao numeric;
BEGIN
  SELECT valor_consulta_avista, valor_consulta_cartao
    INTO v_avista, v_cartao
    FROM public.profissionais
   WHERE id = _profissional_id;

  IF _forma_pagamento IN ('CARTAO_DEBITO', 'CARTAO_CREDITO') THEN
    RETURN COALESCE(NULLIF(v_cartao, 0), NULLIF(v_avista, 0), 0);
  END IF;

  RETURN COALESCE(NULLIF(v_avista, 0), NULLIF(v_cartao, 0), 0);
END;
$$;


--
-- Name: seed_disponibilidade_padrao(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.seed_disponibilidade_padrao() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profissional_disponibilidade d WHERE d.profissional_id = NEW.id) THEN
    INSERT INTO public.profissional_disponibilidade (profissional_id, dia_semana, hora_inicio, hora_fim)
    SELECT NEW.id, dia, faixa.ini, faixa.fim
      FROM generate_series(1,5) AS dia,
           (VALUES ('08:00'::time,'12:00'::time), ('14:00'::time,'18:00'::time)) AS faixa(ini, fim);
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: set_agendamento_valor_congelado(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_agendamento_valor_congelado() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF COALESCE(NEW.valor, 0) = 0 THEN
    NEW.valor := public.resolve_valor_consulta(NEW.profissional_id, NEW.forma_pagamento::text);
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;


--
-- Name: trg_normalizar_whatsapp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_normalizar_whatsapp() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.whatsapp := public.normalizar_whatsapp(NEW.whatsapp);
  RETURN NEW;
END;
$$;


--
-- Name: agendamentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.agendamentos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    paciente_id uuid,
    cliente_user_id uuid,
    profissional_id uuid NOT NULL,
    data date NOT NULL,
    hora_inicio time without time zone NOT NULL,
    hora_fim time without time zone NOT NULL,
    status public.agendamento_status DEFAULT 'PENDENTE'::public.agendamento_status NOT NULL,
    valor numeric(10,2) DEFAULT 0,
    forma_pagamento public.forma_pagamento,
    observacoes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: configuracoes_clinica; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.configuracoes_clinica (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text DEFAULT 'Clínica Zoe'::text NOT NULL,
    tagline text,
    logo_url text,
    hero_titulo text,
    hero_subtitulo text,
    hero_imagem_url text,
    og_imagem_url text,
    texto_institucional text,
    endereco text,
    telefone text,
    whatsapp text,
    email text,
    horarios jsonb DEFAULT '[]'::jsonb NOT NULL,
    redes_sociais jsonb DEFAULT '{}'::jsonb NOT NULL,
    latitude numeric(10,6),
    longitude numeric(10,6),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: especialidades; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.especialidades (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    nome text NOT NULL,
    descricao text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: financeiro; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financeiro (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agendamento_id uuid,
    paciente_id uuid,
    profissional_id uuid,
    valor numeric(10,2) DEFAULT 0 NOT NULL,
    status_pagamento public.financeiro_status DEFAULT 'ABERTO'::public.financeiro_status NOT NULL,
    forma_pagamento public.forma_pagamento,
    pago_em timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    desconto numeric(10,2) DEFAULT 0 NOT NULL,
    juros numeric(10,2) DEFAULT 0 NOT NULL,
    multa numeric(10,2) DEFAULT 0 NOT NULL,
    observacoes text,
    vencimento date
);


--
-- Name: notificacoes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notificacoes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    usuario_id uuid,
    titulo text NOT NULL,
    mensagem text NOT NULL,
    tipo text DEFAULT 'INFO'::text NOT NULL,
    lida boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    canal public.notif_canal DEFAULT 'INTERNO'::public.notif_canal NOT NULL,
    status_envio public.notif_status_envio DEFAULT 'PENDENTE'::public.notif_status_envio NOT NULL,
    tentativas integer DEFAULT 0 NOT NULL,
    ultimo_erro text,
    enviado_em timestamp with time zone,
    evento public.notif_evento,
    agendamento_id uuid,
    destinatario_telefone text,
    destinatario_email text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    provider text,
    duracao_ms integer,
    proxima_tentativa_em timestamp with time zone,
    definitivo boolean DEFAULT false NOT NULL,
    entregue_em timestamp with time zone,
    lido_em timestamp with time zone,
    provider_message_id text,
    mensagem_recebida text,
    respondido_em timestamp with time zone
);


--
-- Name: pacientes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.pacientes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    nome text NOT NULL,
    telefone text,
    email text,
    data_nascimento date,
    observacoes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    foto_url text,
    whatsapp text
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    nome text DEFAULT ''::text NOT NULL,
    email text NOT NULL,
    telefone text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    foto_url text,
    ativo boolean DEFAULT true NOT NULL,
    desativado_em timestamp with time zone,
    desativado_por uuid,
    removido_em timestamp with time zone,
    removido_por uuid,
    criado_por uuid,
    whatsapp text
);


--
-- Name: profissionais; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profissionais (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    nome text NOT NULL,
    foto_url text,
    especialidade_id uuid,
    registro_profissional text,
    email text,
    telefone text,
    descricao text,
    valor_consulta_avista numeric(10,2) DEFAULT 0,
    valor_consulta_cartao numeric(10,2) DEFAULT 0,
    duracao_consulta_min integer DEFAULT 60,
    status public.profissional_status DEFAULT 'ATIVO'::public.profissional_status NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    formacao text,
    anos_experiencia integer,
    whatsapp text
);


--
-- Name: profissionais_public; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.profissionais_public WITH (security_invoker='true') AS
 SELECT id,
    nome,
    foto_url,
    descricao,
    formacao,
    anos_experiencia,
    registro_profissional,
    duracao_consulta_min,
    valor_consulta_avista,
    valor_consulta_cartao,
    especialidade_id,
    status,
    created_at
   FROM public.profissionais
  WHERE (status = 'ATIVO'::public.profissional_status);


--
-- Name: profissional_bloqueio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profissional_bloqueio (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profissional_id uuid NOT NULL,
    data date NOT NULL,
    hora_inicio time without time zone NOT NULL,
    hora_fim time without time zone NOT NULL,
    motivo text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT profissional_bloqueio_check CHECK ((hora_fim > hora_inicio))
);


--
-- Name: profissional_disponibilidade; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profissional_disponibilidade (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    profissional_id uuid NOT NULL,
    dia_semana smallint NOT NULL,
    hora_inicio time without time zone NOT NULL,
    hora_fim time without time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT profissional_disponibilidade_check CHECK ((hora_fim > hora_inicio)),
    CONSTRAINT profissional_disponibilidade_dia_semana_check CHECK (((dia_semana >= 0) AND (dia_semana <= 6)))
);


--
-- Name: user_audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_id uuid,
    actor_nome text,
    target_user_id uuid,
    target_nome text,
    acao text NOT NULL,
    detalhes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    role public.app_role NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: whatsapp_evento_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_evento_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    evento text NOT NULL,
    template_name text,
    language text DEFAULT 'pt_BR'::text NOT NULL,
    variaveis jsonb DEFAULT '[]'::jsonb NOT NULL,
    ativo boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: whatsapp_message_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_message_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    agendamento_id uuid,
    destinatario_telefone text NOT NULL,
    paciente_nome text,
    profissional_nome text,
    mensagem text,
    mensagem_recebida text,
    template_name text,
    status_envio text DEFAULT 'PENDENTE'::text NOT NULL,
    wamid text,
    duracao_ms integer,
    ultimo_erro text,
    payload jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    message_status text,
    conversation_id text,
    conversation_category text,
    erro_codigo text,
    erro_detalhe text,
    evento text,
    accepted_at timestamp with time zone,
    sent_at timestamp with time zone,
    delivered_at timestamp with time zone,
    read_at timestamp with time zone,
    failed_at timestamp with time zone,
    webhook_payload jsonb
);


--
-- Name: whatsapp_meta_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_meta_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    access_token text,
    phone_number_id text,
    business_account_id text,
    app_id text,
    app_secret text,
    verify_token text,
    graph_version text DEFAULT 'v23.0'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: whatsapp_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    destinatario text NOT NULL,
    mensagem text NOT NULL,
    status public.wa_status DEFAULT 'PENDENTE'::public.wa_status NOT NULL,
    tentativas integer DEFAULT 0 NOT NULL,
    erro text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    enviado_em timestamp with time zone
);


--
-- Name: whatsapp_sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_sessions (
    telefone text NOT NULL,
    last_inbound_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: whatsapp_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.whatsapp_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    meta_id text,
    name text NOT NULL,
    language text DEFAULT 'pt_BR'::text NOT NULL,
    category text DEFAULT 'UTILITY'::text NOT NULL,
    titulo_interno text,
    header_text text,
    body_text text DEFAULT ''::text NOT NULL,
    footer_text text,
    buttons jsonb DEFAULT '[]'::jsonb NOT NULL,
    variaveis jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'LOCAL'::text NOT NULL,
    quality_rating text,
    rejected_reason text,
    meta_created_at timestamp with time zone,
    meta_updated_at timestamp with time zone,
    synced_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: agendamentos agendamentos_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agendamentos
    ADD CONSTRAINT agendamentos_pkey PRIMARY KEY (id);


--
-- Name: configuracoes_clinica configuracoes_clinica_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.configuracoes_clinica
    ADD CONSTRAINT configuracoes_clinica_pkey PRIMARY KEY (id);


--
-- Name: especialidades especialidades_nome_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.especialidades
    ADD CONSTRAINT especialidades_nome_key UNIQUE (nome);


--
-- Name: especialidades especialidades_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.especialidades
    ADD CONSTRAINT especialidades_pkey PRIMARY KEY (id);


--
-- Name: financeiro financeiro_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro
    ADD CONSTRAINT financeiro_pkey PRIMARY KEY (id);


--
-- Name: notificacoes_config notificacoes_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificacoes_config
    ADD CONSTRAINT notificacoes_config_pkey PRIMARY KEY (id);


--
-- Name: notificacoes notificacoes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificacoes
    ADD CONSTRAINT notificacoes_pkey PRIMARY KEY (id);


--
-- Name: pacientes pacientes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pacientes
    ADD CONSTRAINT pacientes_pkey PRIMARY KEY (id);


--
-- Name: pacientes pacientes_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pacientes
    ADD CONSTRAINT pacientes_user_id_key UNIQUE (user_id);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profissionais profissionais_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profissionais
    ADD CONSTRAINT profissionais_pkey PRIMARY KEY (id);


--
-- Name: profissionais profissionais_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profissionais
    ADD CONSTRAINT profissionais_user_id_key UNIQUE (user_id);


--
-- Name: profissional_bloqueio profissional_bloqueio_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profissional_bloqueio
    ADD CONSTRAINT profissional_bloqueio_pkey PRIMARY KEY (id);


--
-- Name: profissional_disponibilidade profissional_disponibilidade_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profissional_disponibilidade
    ADD CONSTRAINT profissional_disponibilidade_pkey PRIMARY KEY (id);


--
-- Name: user_audit_log user_audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_audit_log
    ADD CONSTRAINT user_audit_log_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_user_id_role_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_role_key UNIQUE (user_id, role);


--
-- Name: whatsapp_evento_templates whatsapp_evento_templates_evento_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_evento_templates
    ADD CONSTRAINT whatsapp_evento_templates_evento_key UNIQUE (evento);


--
-- Name: whatsapp_evento_templates whatsapp_evento_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_evento_templates
    ADD CONSTRAINT whatsapp_evento_templates_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_message_logs whatsapp_message_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_message_logs
    ADD CONSTRAINT whatsapp_message_logs_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_meta_config whatsapp_meta_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_meta_config
    ADD CONSTRAINT whatsapp_meta_config_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_queue whatsapp_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_queue
    ADD CONSTRAINT whatsapp_queue_pkey PRIMARY KEY (id);


--
-- Name: whatsapp_sessions whatsapp_sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_sessions
    ADD CONSTRAINT whatsapp_sessions_pkey PRIMARY KEY (telefone);


--
-- Name: whatsapp_templates whatsapp_templates_name_language_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_templates
    ADD CONSTRAINT whatsapp_templates_name_language_key UNIQUE (name, language);


--
-- Name: whatsapp_templates whatsapp_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.whatsapp_templates
    ADD CONSTRAINT whatsapp_templates_pkey PRIMARY KEY (id);


--
-- Name: idx_ag_prof_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ag_prof_data ON public.agendamentos USING btree (profissional_id, data);


--
-- Name: idx_agendamentos_paciente; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agendamentos_paciente ON public.agendamentos USING btree (paciente_id);


--
-- Name: idx_agendamentos_prof_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_agendamentos_prof_data ON public.agendamentos USING btree (profissional_id, data);


--
-- Name: idx_bloq_prof_data; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bloq_prof_data ON public.profissional_bloqueio USING btree (profissional_id, data);


--
-- Name: idx_disp_prof; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_disp_prof ON public.profissional_disponibilidade USING btree (profissional_id, dia_semana);


--
-- Name: idx_notif_agendamento; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notif_agendamento ON public.notificacoes USING btree (agendamento_id);


--
-- Name: idx_notif_canal; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notif_canal ON public.notificacoes USING btree (canal);


--
-- Name: idx_notif_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notif_status ON public.notificacoes USING btree (status_envio);


--
-- Name: idx_notif_usuario; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notif_usuario ON public.notificacoes USING btree (usuario_id);


--
-- Name: idx_notificacoes_provider_msg; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notificacoes_provider_msg ON public.notificacoes USING btree (provider_message_id);


--
-- Name: idx_notificacoes_retry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notificacoes_retry ON public.notificacoes USING btree (status_envio, proxima_tentativa_em) WHERE (definitivo = false);


--
-- Name: idx_user_audit_log_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_audit_log_target ON public.user_audit_log USING btree (target_user_id, created_at DESC);


--
-- Name: idx_wa_logs_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wa_logs_created ON public.whatsapp_message_logs USING btree (created_at DESC);


--
-- Name: idx_wa_logs_wamid; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_wa_logs_wamid ON public.whatsapp_message_logs USING btree (wamid);


--
-- Name: whatsapp_message_logs_created_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX whatsapp_message_logs_created_idx ON public.whatsapp_message_logs USING btree (created_at DESC);


--
-- Name: whatsapp_message_logs_wamid_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX whatsapp_message_logs_wamid_idx ON public.whatsapp_message_logs USING btree (wamid);


--
-- Name: agendamentos trg_agendamento_notify_ins; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_agendamento_notify_ins AFTER INSERT ON public.agendamentos FOR EACH ROW EXECUTE FUNCTION public.on_agendamento_notify();


--
-- Name: agendamentos trg_agendamento_notify_upd; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_agendamento_notify_upd AFTER UPDATE ON public.agendamentos FOR EACH ROW EXECUTE FUNCTION public.on_agendamento_notify();


--
-- Name: agendamentos trg_agendamentos_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_agendamentos_updated BEFORE UPDATE ON public.agendamentos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: configuracoes_clinica trg_cfg_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_cfg_updated_at BEFORE UPDATE ON public.configuracoes_clinica FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: agendamentos trg_check_agendamento_conflito; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_check_agendamento_conflito BEFORE INSERT OR UPDATE ON public.agendamentos FOR EACH ROW EXECUTE FUNCTION public.check_agendamento_conflito();


--
-- Name: financeiro trg_financeiro_notify; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_financeiro_notify AFTER UPDATE ON public.financeiro FOR EACH ROW EXECUTE FUNCTION public.on_financeiro_notify();


--
-- Name: financeiro trg_financeiro_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_financeiro_updated BEFORE UPDATE ON public.financeiro FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: notificacoes_config trg_notif_config_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notif_config_updated BEFORE UPDATE ON public.notificacoes_config FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: notificacoes trg_notif_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_notif_updated BEFORE UPDATE ON public.notificacoes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: agendamentos trg_on_agendamento_aprovado; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_on_agendamento_aprovado AFTER INSERT OR UPDATE ON public.agendamentos FOR EACH ROW EXECUTE FUNCTION public.on_agendamento_aprovado();


--
-- Name: pacientes trg_pacientes_norm_whatsapp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pacientes_norm_whatsapp BEFORE INSERT OR UPDATE OF whatsapp ON public.pacientes FOR EACH ROW EXECUTE FUNCTION public.trg_normalizar_whatsapp();


--
-- Name: pacientes trg_pacientes_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_pacientes_updated BEFORE UPDATE ON public.pacientes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: profiles trg_profiles_norm_whatsapp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_profiles_norm_whatsapp BEFORE INSERT OR UPDATE OF whatsapp ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.trg_normalizar_whatsapp();


--
-- Name: profiles trg_profiles_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: profissionais trg_profissionais_norm_whatsapp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_profissionais_norm_whatsapp BEFORE INSERT OR UPDATE OF whatsapp ON public.profissionais FOR EACH ROW EXECUTE FUNCTION public.trg_normalizar_whatsapp();


--
-- Name: profissionais trg_profissionais_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_profissionais_updated BEFORE UPDATE ON public.profissionais FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: profissionais trg_seed_disponibilidade_padrao; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_seed_disponibilidade_padrao AFTER INSERT ON public.profissionais FOR EACH ROW EXECUTE FUNCTION public.seed_disponibilidade_padrao();


--
-- Name: agendamentos trg_set_agendamento_valor_congelado; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_set_agendamento_valor_congelado BEFORE INSERT OR UPDATE OF profissional_id, forma_pagamento, valor, status ON public.agendamentos FOR EACH ROW EXECUTE FUNCTION public.set_agendamento_valor_congelado();


--
-- Name: whatsapp_evento_templates trg_whatsapp_evento_templates_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_whatsapp_evento_templates_updated BEFORE UPDATE ON public.whatsapp_evento_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: whatsapp_templates trg_whatsapp_templates_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_whatsapp_templates_updated BEFORE UPDATE ON public.whatsapp_templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: agendamentos agendamentos_cliente_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agendamentos
    ADD CONSTRAINT agendamentos_cliente_user_id_fkey FOREIGN KEY (cliente_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: agendamentos agendamentos_paciente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agendamentos
    ADD CONSTRAINT agendamentos_paciente_id_fkey FOREIGN KEY (paciente_id) REFERENCES public.pacientes(id) ON DELETE SET NULL;


--
-- Name: agendamentos agendamentos_profissional_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.agendamentos
    ADD CONSTRAINT agendamentos_profissional_id_fkey FOREIGN KEY (profissional_id) REFERENCES public.profissionais(id) ON DELETE CASCADE;


--
-- Name: financeiro financeiro_agendamento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro
    ADD CONSTRAINT financeiro_agendamento_id_fkey FOREIGN KEY (agendamento_id) REFERENCES public.agendamentos(id) ON DELETE SET NULL;


--
-- Name: financeiro financeiro_paciente_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro
    ADD CONSTRAINT financeiro_paciente_id_fkey FOREIGN KEY (paciente_id) REFERENCES public.pacientes(id) ON DELETE SET NULL;


--
-- Name: financeiro financeiro_profissional_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.financeiro
    ADD CONSTRAINT financeiro_profissional_id_fkey FOREIGN KEY (profissional_id) REFERENCES public.profissionais(id) ON DELETE SET NULL;


--
-- Name: notificacoes notificacoes_agendamento_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificacoes
    ADD CONSTRAINT notificacoes_agendamento_id_fkey FOREIGN KEY (agendamento_id) REFERENCES public.agendamentos(id) ON DELETE SET NULL;


--
-- Name: notificacoes notificacoes_usuario_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notificacoes
    ADD CONSTRAINT notificacoes_usuario_id_fkey FOREIGN KEY (usuario_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: pacientes pacientes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.pacientes
    ADD CONSTRAINT pacientes_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: profissionais profissionais_especialidade_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profissionais
    ADD CONSTRAINT profissionais_especialidade_id_fkey FOREIGN KEY (especialidade_id) REFERENCES public.especialidades(id) ON DELETE SET NULL;


--
-- Name: profissionais profissionais_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profissionais
    ADD CONSTRAINT profissionais_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;


--
-- Name: profissional_bloqueio profissional_bloqueio_profissional_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profissional_bloqueio
    ADD CONSTRAINT profissional_bloqueio_profissional_id_fkey FOREIGN KEY (profissional_id) REFERENCES public.profissionais(id) ON DELETE CASCADE;


--
-- Name: profissional_disponibilidade profissional_disponibilidade_profissional_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profissional_disponibilidade
    ADD CONSTRAINT profissional_disponibilidade_profissional_id_fkey FOREIGN KEY (profissional_id) REFERENCES public.profissionais(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: whatsapp_meta_config Admins gerenciam config meta; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins gerenciam config meta" ON public.whatsapp_meta_config TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::public.app_role));


--
-- Name: whatsapp_evento_templates Admins gerenciam mapeamento de eventos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins gerenciam mapeamento de eventos" ON public.whatsapp_evento_templates TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::public.app_role));


--
-- Name: whatsapp_templates Admins gerenciam templates; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins gerenciam templates" ON public.whatsapp_templates TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::public.app_role));


--
-- Name: whatsapp_message_logs Admins leem logs whatsapp; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins leem logs whatsapp" ON public.whatsapp_message_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'::public.app_role));


--
-- Name: whatsapp_sessions Admins leem sessoes whatsapp; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins leem sessoes whatsapp" ON public.whatsapp_sessions FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'::public.app_role));


--
-- Name: user_audit_log Admins podem ver auditoria; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins podem ver auditoria" ON public.user_audit_log FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'::public.app_role));


--
-- Name: agendamentos ag_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ag_admin_delete ON public.agendamentos FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'::public.app_role));


--
-- Name: agendamentos ag_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ag_insert ON public.agendamentos FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'ADMIN'::public.app_role) OR public.has_role(auth.uid(), 'RECEPCIONISTA'::public.app_role) OR (cliente_user_id = auth.uid())));


--
-- Name: agendamentos ag_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ag_read ON public.agendamentos FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'ADMIN'::public.app_role) OR public.has_role(auth.uid(), 'RECEPCIONISTA'::public.app_role) OR (cliente_user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.profissionais p
  WHERE ((p.id = agendamentos.profissional_id) AND (p.user_id = auth.uid()))))));


--
-- Name: agendamentos ag_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ag_update ON public.agendamentos FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), 'ADMIN'::public.app_role) OR public.has_role(auth.uid(), 'RECEPCIONISTA'::public.app_role) OR (cliente_user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.profissionais p
  WHERE ((p.id = agendamentos.profissional_id) AND (p.user_id = auth.uid())))))) WITH CHECK ((public.has_role(auth.uid(), 'ADMIN'::public.app_role) OR public.has_role(auth.uid(), 'RECEPCIONISTA'::public.app_role) OR (cliente_user_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM public.profissionais p
  WHERE ((p.id = agendamentos.profissional_id) AND (p.user_id = auth.uid()))))));


--
-- Name: agendamentos; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;

--
-- Name: profissional_bloqueio bloq_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bloq_delete ON public.profissional_bloqueio FOR DELETE TO authenticated USING ((public.has_role(auth.uid(), 'ADMIN'::public.app_role) OR (EXISTS ( SELECT 1
   FROM public.profissionais p
  WHERE ((p.id = profissional_bloqueio.profissional_id) AND (p.user_id = auth.uid()))))));


--
-- Name: profissional_bloqueio bloq_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bloq_read ON public.profissional_bloqueio FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'ADMIN'::public.app_role) OR public.has_role(auth.uid(), 'RECEPCIONISTA'::public.app_role) OR (EXISTS ( SELECT 1
   FROM public.profissionais p
  WHERE ((p.id = profissional_bloqueio.profissional_id) AND (p.user_id = auth.uid()))))));


--
-- Name: profissional_bloqueio bloq_read_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bloq_read_public ON public.profissional_bloqueio FOR SELECT TO anon USING ((EXISTS ( SELECT 1
   FROM public.profissionais p
  WHERE ((p.id = profissional_bloqueio.profissional_id) AND (p.status = 'ATIVO'::public.profissional_status)))));


--
-- Name: profissional_bloqueio bloq_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bloq_update ON public.profissional_bloqueio FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), 'ADMIN'::public.app_role) OR (EXISTS ( SELECT 1
   FROM public.profissionais p
  WHERE ((p.id = profissional_bloqueio.profissional_id) AND (p.user_id = auth.uid())))))) WITH CHECK ((public.has_role(auth.uid(), 'ADMIN'::public.app_role) OR (EXISTS ( SELECT 1
   FROM public.profissionais p
  WHERE ((p.id = profissional_bloqueio.profissional_id) AND (p.user_id = auth.uid()))))));


--
-- Name: profissional_bloqueio bloq_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY bloq_write ON public.profissional_bloqueio FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'ADMIN'::public.app_role) OR (EXISTS ( SELECT 1
   FROM public.profissionais p
  WHERE ((p.id = profissional_bloqueio.profissional_id) AND (p.user_id = auth.uid()))))));


--
-- Name: configuracoes_clinica cfg_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cfg_admin_insert ON public.configuracoes_clinica FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::public.app_role));


--
-- Name: configuracoes_clinica cfg_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cfg_admin_update ON public.configuracoes_clinica FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::public.app_role));


--
-- Name: configuracoes_clinica cfg_read_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY cfg_read_public ON public.configuracoes_clinica FOR SELECT TO authenticated, anon USING (true);


--
-- Name: configuracoes_clinica; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.configuracoes_clinica ENABLE ROW LEVEL SECURITY;

--
-- Name: profissional_disponibilidade disp_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY disp_delete ON public.profissional_disponibilidade FOR DELETE TO authenticated USING ((public.has_role(auth.uid(), 'ADMIN'::public.app_role) OR (EXISTS ( SELECT 1
   FROM public.profissionais p
  WHERE ((p.id = profissional_disponibilidade.profissional_id) AND (p.user_id = auth.uid()))))));


--
-- Name: profissional_disponibilidade disp_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY disp_read ON public.profissional_disponibilidade FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'ADMIN'::public.app_role) OR public.has_role(auth.uid(), 'RECEPCIONISTA'::public.app_role) OR (EXISTS ( SELECT 1
   FROM public.profissionais p
  WHERE ((p.id = profissional_disponibilidade.profissional_id) AND ((p.user_id = auth.uid()) OR (p.status = 'ATIVO'::public.profissional_status)))))));


--
-- Name: profissional_disponibilidade disp_read_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY disp_read_public ON public.profissional_disponibilidade FOR SELECT TO anon USING ((EXISTS ( SELECT 1
   FROM public.profissionais p
  WHERE ((p.id = profissional_disponibilidade.profissional_id) AND (p.status = 'ATIVO'::public.profissional_status)))));


--
-- Name: profissional_disponibilidade disp_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY disp_update ON public.profissional_disponibilidade FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), 'ADMIN'::public.app_role) OR (EXISTS ( SELECT 1
   FROM public.profissionais p
  WHERE ((p.id = profissional_disponibilidade.profissional_id) AND (p.user_id = auth.uid())))))) WITH CHECK ((public.has_role(auth.uid(), 'ADMIN'::public.app_role) OR (EXISTS ( SELECT 1
   FROM public.profissionais p
  WHERE ((p.id = profissional_disponibilidade.profissional_id) AND (p.user_id = auth.uid()))))));


--
-- Name: profissional_disponibilidade disp_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY disp_write ON public.profissional_disponibilidade FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'ADMIN'::public.app_role) OR (EXISTS ( SELECT 1
   FROM public.profissionais p
  WHERE ((p.id = profissional_disponibilidade.profissional_id) AND (p.user_id = auth.uid()))))));


--
-- Name: especialidades esp_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY esp_admin_delete ON public.especialidades FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'::public.app_role));


--
-- Name: especialidades esp_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY esp_admin_update ON public.especialidades FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::public.app_role));


--
-- Name: especialidades esp_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY esp_admin_write ON public.especialidades FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::public.app_role));


--
-- Name: especialidades esp_read_all_auth; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY esp_read_all_auth ON public.especialidades FOR SELECT TO authenticated USING (true);


--
-- Name: especialidades esp_read_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY esp_read_public ON public.especialidades FOR SELECT TO anon USING (true);


--
-- Name: especialidades; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.especialidades ENABLE ROW LEVEL SECURITY;

--
-- Name: financeiro fin_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fin_admin_delete ON public.financeiro FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'::public.app_role));


--
-- Name: financeiro fin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fin_insert ON public.financeiro FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::public.app_role));


--
-- Name: financeiro fin_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fin_read ON public.financeiro FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'ADMIN'::public.app_role) OR (EXISTS ( SELECT 1
   FROM public.profissionais p
  WHERE ((p.id = financeiro.profissional_id) AND (p.user_id = auth.uid()))))));


--
-- Name: financeiro fin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fin_update ON public.financeiro FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), 'ADMIN'::public.app_role) OR (EXISTS ( SELECT 1
   FROM public.profissionais p
  WHERE ((p.id = financeiro.profissional_id) AND (p.user_id = auth.uid())))))) WITH CHECK ((public.has_role(auth.uid(), 'ADMIN'::public.app_role) OR (EXISTS ( SELECT 1
   FROM public.profissionais p
  WHERE ((p.id = financeiro.profissional_id) AND (p.user_id = auth.uid()))))));


--
-- Name: financeiro; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;

--
-- Name: notificacoes notif_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notif_admin_delete ON public.notificacoes FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'::public.app_role));


--
-- Name: notificacoes notif_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notif_admin_insert ON public.notificacoes FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::public.app_role));


--
-- Name: notificacoes notif_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notif_admin_update ON public.notificacoes FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), 'ADMIN'::public.app_role) OR (usuario_id = auth.uid()))) WITH CHECK ((public.has_role(auth.uid(), 'ADMIN'::public.app_role) OR (usuario_id = auth.uid())));


--
-- Name: notificacoes notif_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY notif_read ON public.notificacoes FOR SELECT TO authenticated USING (((usuario_id = auth.uid()) OR public.has_role(auth.uid(), 'ADMIN'::public.app_role) OR (EXISTS ( SELECT 1
   FROM public.agendamentos a
  WHERE ((a.id = notificacoes.agendamento_id) AND ((a.cliente_user_id = auth.uid()) OR (EXISTS ( SELECT 1
           FROM public.pacientes p
          WHERE ((p.id = a.paciente_id) AND (p.user_id = auth.uid())))) OR (EXISTS ( SELECT 1
           FROM public.profissionais pr
          WHERE ((pr.id = a.profissional_id) AND (pr.user_id = auth.uid()))))))))));


--
-- Name: notificacoes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

--
-- Name: notificacoes_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notificacoes_config ENABLE ROW LEVEL SECURITY;

--
-- Name: pacientes pac_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pac_admin_delete ON public.pacientes FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'::public.app_role));


--
-- Name: pacientes pac_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pac_read ON public.pacientes FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'ADMIN'::public.app_role) OR public.has_role(auth.uid(), 'RECEPCIONISTA'::public.app_role) OR (user_id = auth.uid()) OR (public.has_role(auth.uid(), 'PROFISSIONAL'::public.app_role) AND (EXISTS ( SELECT 1
   FROM (public.agendamentos a
     JOIN public.profissionais p ON ((p.id = a.profissional_id)))
  WHERE ((a.paciente_id = pacientes.id) AND (p.user_id = auth.uid())))))));


--
-- Name: pacientes pac_staff_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pac_staff_insert ON public.pacientes FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'ADMIN'::public.app_role) OR public.has_role(auth.uid(), 'RECEPCIONISTA'::public.app_role) OR (user_id = auth.uid())));


--
-- Name: pacientes pac_staff_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pac_staff_update ON public.pacientes FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), 'ADMIN'::public.app_role) OR public.has_role(auth.uid(), 'RECEPCIONISTA'::public.app_role) OR (user_id = auth.uid()))) WITH CHECK ((public.has_role(auth.uid(), 'ADMIN'::public.app_role) OR public.has_role(auth.uid(), 'RECEPCIONISTA'::public.app_role) OR (user_id = auth.uid())));


--
-- Name: pacientes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;

--
-- Name: profissionais prof_admin_delete; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY prof_admin_delete ON public.profissionais FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'::public.app_role));


--
-- Name: profissionais prof_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY prof_admin_insert ON public.profissionais FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::public.app_role));


--
-- Name: profissionais prof_admin_or_self_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY prof_admin_or_self_update ON public.profissionais FOR UPDATE TO authenticated USING ((public.has_role(auth.uid(), 'ADMIN'::public.app_role) OR (user_id = auth.uid()))) WITH CHECK ((public.has_role(auth.uid(), 'ADMIN'::public.app_role) OR (user_id = auth.uid())));


--
-- Name: profissionais prof_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY prof_read ON public.profissionais FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'ADMIN'::public.app_role) OR public.has_role(auth.uid(), 'RECEPCIONISTA'::public.app_role) OR (user_id = auth.uid()) OR (status = 'ATIVO'::public.profissional_status)));


--
-- Name: profissionais prof_read_public_ativos; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY prof_read_public_ativos ON public.profissionais FOR SELECT TO anon USING ((status = 'ATIVO'::public.profissional_status));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: profiles profiles_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_admin_insert ON public.profiles FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'ADMIN'::public.app_role) OR (id = auth.uid())));


--
-- Name: profiles profiles_self_select; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_self_select ON public.profiles FOR SELECT TO authenticated USING (((id = auth.uid()) OR public.has_role(auth.uid(), 'ADMIN'::public.app_role) OR public.has_role(auth.uid(), 'RECEPCIONISTA'::public.app_role)));


--
-- Name: profiles profiles_self_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY profiles_self_update ON public.profiles FOR UPDATE TO authenticated USING (((id = auth.uid()) OR public.has_role(auth.uid(), 'ADMIN'::public.app_role))) WITH CHECK (((id = auth.uid()) OR public.has_role(auth.uid(), 'ADMIN'::public.app_role)));


--
-- Name: profissionais; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profissionais ENABLE ROW LEVEL SECURITY;

--
-- Name: profissional_bloqueio; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profissional_bloqueio ENABLE ROW LEVEL SECURITY;

--
-- Name: profissional_disponibilidade; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profissional_disponibilidade ENABLE ROW LEVEL SECURITY;

--
-- Name: user_audit_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_audit_log ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

--
-- Name: user_roles user_roles_self_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_roles_self_read ON public.user_roles FOR SELECT TO authenticated USING (((user_id = auth.uid()) OR public.has_role(auth.uid(), 'ADMIN'::public.app_role)));


--
-- Name: whatsapp_queue wa_admin_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wa_admin_all ON public.whatsapp_queue FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'::public.app_role));


--
-- Name: whatsapp_queue wa_admin_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wa_admin_insert ON public.whatsapp_queue FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::public.app_role));


--
-- Name: whatsapp_queue wa_admin_update; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY wa_admin_update ON public.whatsapp_queue FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::public.app_role));


--
-- Name: whatsapp_evento_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.whatsapp_evento_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: whatsapp_message_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.whatsapp_message_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: whatsapp_meta_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.whatsapp_meta_config ENABLE ROW LEVEL SECURITY;

--
-- Name: whatsapp_queue; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.whatsapp_queue ENABLE ROW LEVEL SECURITY;

--
-- Name: whatsapp_sessions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.whatsapp_sessions ENABLE ROW LEVEL SECURITY;

--
-- Name: whatsapp_templates; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.whatsapp_templates ENABLE ROW LEVEL SECURITY;

--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION check_agendamento_conflito(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.check_agendamento_conflito() TO anon;
GRANT ALL ON FUNCTION public.check_agendamento_conflito() TO authenticated;
GRANT ALL ON FUNCTION public.check_agendamento_conflito() TO service_role;


--
-- Name: FUNCTION current_user_has_role(_role public.app_role); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.current_user_has_role(_role public.app_role) FROM PUBLIC;
GRANT ALL ON FUNCTION public.current_user_has_role(_role public.app_role) TO service_role;


--
-- Name: FUNCTION enqueue_notificacao(_usuario_id uuid, _titulo text, _mensagem text, _evento public.notif_evento, _canal public.notif_canal, _agendamento_id uuid, _telefone text, _email text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.enqueue_notificacao(_usuario_id uuid, _titulo text, _mensagem text, _evento public.notif_evento, _canal public.notif_canal, _agendamento_id uuid, _telefone text, _email text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.enqueue_notificacao(_usuario_id uuid, _titulo text, _mensagem text, _evento public.notif_evento, _canal public.notif_canal, _agendamento_id uuid, _telefone text, _email text) TO service_role;


--
-- Name: FUNCTION gerar_lembretes(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.gerar_lembretes() FROM PUBLIC;
GRANT ALL ON FUNCTION public.gerar_lembretes() TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION has_role(_user_id uuid, _role public.app_role); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) FROM PUBLIC;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO authenticated;
GRANT ALL ON FUNCTION public.has_role(_user_id uuid, _role public.app_role) TO service_role;


--
-- Name: FUNCTION horarios_disponiveis(p_profissional_id uuid, p_data date); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.horarios_disponiveis(p_profissional_id uuid, p_data date) FROM PUBLIC;
GRANT ALL ON FUNCTION public.horarios_disponiveis(p_profissional_id uuid, p_data date) TO anon;
GRANT ALL ON FUNCTION public.horarios_disponiveis(p_profissional_id uuid, p_data date) TO authenticated;
GRANT ALL ON FUNCTION public.horarios_disponiveis(p_profissional_id uuid, p_data date) TO service_role;


--
-- Name: FUNCTION normalizar_whatsapp(_valor text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.normalizar_whatsapp(_valor text) TO anon;
GRANT ALL ON FUNCTION public.normalizar_whatsapp(_valor text) TO authenticated;
GRANT ALL ON FUNCTION public.normalizar_whatsapp(_valor text) TO service_role;


--
-- Name: TABLE notificacoes_config; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.notificacoes_config TO anon;
GRANT ALL ON TABLE public.notificacoes_config TO authenticated;
GRANT ALL ON TABLE public.notificacoes_config TO service_role;


--
-- Name: FUNCTION notif_config(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.notif_config() FROM PUBLIC;
GRANT ALL ON FUNCTION public.notif_config() TO service_role;


--
-- Name: FUNCTION on_agendamento_aprovado(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.on_agendamento_aprovado() FROM PUBLIC;
GRANT ALL ON FUNCTION public.on_agendamento_aprovado() TO service_role;


--
-- Name: FUNCTION on_agendamento_notify(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.on_agendamento_notify() FROM PUBLIC;
GRANT ALL ON FUNCTION public.on_agendamento_notify() TO service_role;


--
-- Name: FUNCTION on_financeiro_notify(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.on_financeiro_notify() FROM PUBLIC;
GRANT ALL ON FUNCTION public.on_financeiro_notify() TO service_role;


--
-- Name: FUNCTION resolve_valor_consulta(_profissional_id uuid, _forma_pagamento text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.resolve_valor_consulta(_profissional_id uuid, _forma_pagamento text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.resolve_valor_consulta(_profissional_id uuid, _forma_pagamento text) TO service_role;


--
-- Name: FUNCTION seed_disponibilidade_padrao(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.seed_disponibilidade_padrao() FROM PUBLIC;
GRANT ALL ON FUNCTION public.seed_disponibilidade_padrao() TO service_role;


--
-- Name: FUNCTION set_agendamento_valor_congelado(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_agendamento_valor_congelado() FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_agendamento_valor_congelado() TO service_role;


--
-- Name: FUNCTION set_updated_at(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.set_updated_at() TO anon;
GRANT ALL ON FUNCTION public.set_updated_at() TO authenticated;
GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;


--
-- Name: FUNCTION trg_normalizar_whatsapp(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.trg_normalizar_whatsapp() TO anon;
GRANT ALL ON FUNCTION public.trg_normalizar_whatsapp() TO authenticated;
GRANT ALL ON FUNCTION public.trg_normalizar_whatsapp() TO service_role;


--
-- Name: TABLE agendamentos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.agendamentos TO anon;
GRANT ALL ON TABLE public.agendamentos TO authenticated;
GRANT ALL ON TABLE public.agendamentos TO service_role;


--
-- Name: TABLE configuracoes_clinica; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.configuracoes_clinica TO anon;
GRANT ALL ON TABLE public.configuracoes_clinica TO authenticated;
GRANT ALL ON TABLE public.configuracoes_clinica TO service_role;


--
-- Name: TABLE especialidades; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.especialidades TO anon;
GRANT ALL ON TABLE public.especialidades TO authenticated;
GRANT ALL ON TABLE public.especialidades TO service_role;


--
-- Name: TABLE financeiro; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.financeiro TO anon;
GRANT ALL ON TABLE public.financeiro TO authenticated;
GRANT ALL ON TABLE public.financeiro TO service_role;


--
-- Name: TABLE notificacoes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.notificacoes TO anon;
GRANT ALL ON TABLE public.notificacoes TO authenticated;
GRANT ALL ON TABLE public.notificacoes TO service_role;


--
-- Name: TABLE pacientes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.pacientes TO anon;
GRANT ALL ON TABLE public.pacientes TO authenticated;
GRANT ALL ON TABLE public.pacientes TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE profissionais; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profissionais TO anon;
GRANT ALL ON TABLE public.profissionais TO authenticated;
GRANT ALL ON TABLE public.profissionais TO service_role;


--
-- Name: COLUMN profissionais.id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(id) ON TABLE public.profissionais TO anon;


--
-- Name: COLUMN profissionais.nome; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(nome) ON TABLE public.profissionais TO anon;


--
-- Name: COLUMN profissionais.foto_url; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(foto_url) ON TABLE public.profissionais TO anon;


--
-- Name: COLUMN profissionais.especialidade_id; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(especialidade_id) ON TABLE public.profissionais TO anon;


--
-- Name: COLUMN profissionais.registro_profissional; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(registro_profissional) ON TABLE public.profissionais TO anon;


--
-- Name: COLUMN profissionais.descricao; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(descricao) ON TABLE public.profissionais TO anon;


--
-- Name: COLUMN profissionais.valor_consulta_avista; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(valor_consulta_avista) ON TABLE public.profissionais TO anon;


--
-- Name: COLUMN profissionais.valor_consulta_cartao; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(valor_consulta_cartao) ON TABLE public.profissionais TO anon;


--
-- Name: COLUMN profissionais.duracao_consulta_min; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(duracao_consulta_min) ON TABLE public.profissionais TO anon;


--
-- Name: COLUMN profissionais.status; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(status) ON TABLE public.profissionais TO anon;


--
-- Name: COLUMN profissionais.created_at; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(created_at) ON TABLE public.profissionais TO anon;


--
-- Name: COLUMN profissionais.formacao; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(formacao) ON TABLE public.profissionais TO anon;


--
-- Name: COLUMN profissionais.anos_experiencia; Type: ACL; Schema: public; Owner: -
--

GRANT SELECT(anos_experiencia) ON TABLE public.profissionais TO anon;


--
-- Name: TABLE profissionais_public; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profissionais_public TO anon;
GRANT ALL ON TABLE public.profissionais_public TO authenticated;
GRANT ALL ON TABLE public.profissionais_public TO service_role;


--
-- Name: TABLE profissional_bloqueio; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profissional_bloqueio TO anon;
GRANT ALL ON TABLE public.profissional_bloqueio TO authenticated;
GRANT ALL ON TABLE public.profissional_bloqueio TO service_role;


--
-- Name: TABLE profissional_disponibilidade; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.profissional_disponibilidade TO anon;
GRANT ALL ON TABLE public.profissional_disponibilidade TO authenticated;
GRANT ALL ON TABLE public.profissional_disponibilidade TO service_role;


--
-- Name: TABLE user_audit_log; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_audit_log TO anon;
GRANT ALL ON TABLE public.user_audit_log TO authenticated;
GRANT ALL ON TABLE public.user_audit_log TO service_role;


--
-- Name: TABLE user_roles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_roles TO anon;
GRANT ALL ON TABLE public.user_roles TO authenticated;
GRANT ALL ON TABLE public.user_roles TO service_role;


--
-- Name: TABLE whatsapp_evento_templates; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.whatsapp_evento_templates TO anon;
GRANT ALL ON TABLE public.whatsapp_evento_templates TO authenticated;
GRANT ALL ON TABLE public.whatsapp_evento_templates TO service_role;


--
-- Name: TABLE whatsapp_message_logs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.whatsapp_message_logs TO anon;
GRANT ALL ON TABLE public.whatsapp_message_logs TO authenticated;
GRANT ALL ON TABLE public.whatsapp_message_logs TO service_role;


--
-- Name: TABLE whatsapp_meta_config; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.whatsapp_meta_config TO anon;
GRANT ALL ON TABLE public.whatsapp_meta_config TO authenticated;
GRANT ALL ON TABLE public.whatsapp_meta_config TO service_role;


--
-- Name: TABLE whatsapp_queue; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.whatsapp_queue TO anon;
GRANT ALL ON TABLE public.whatsapp_queue TO authenticated;
GRANT ALL ON TABLE public.whatsapp_queue TO service_role;


--
-- Name: TABLE whatsapp_sessions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.whatsapp_sessions TO anon;
GRANT ALL ON TABLE public.whatsapp_sessions TO authenticated;
GRANT ALL ON TABLE public.whatsapp_sessions TO service_role;


--
-- Name: TABLE whatsapp_templates; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.whatsapp_templates TO anon;
GRANT ALL ON TABLE public.whatsapp_templates TO authenticated;
GRANT ALL ON TABLE public.whatsapp_templates TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--



--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--



-- =====================================================================
-- Financeiro — Fase 1 (Fundação): Contas a Receber completo
-- (parcelamento, baixas/pagamento parcial, desconto/juros/multa, anexos,
-- auditoria). Ver supabase/migrations/20260803160000_financeiro_enum_parcial.sql
-- e 20260803160100_financeiro_contas_a_receber.sql para o histórico
-- incremental — este bloco reflete o estado final para provisionar um
-- projeto novo do zero.
-- =====================================================================

--
-- Name: financeiro_parcelas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financeiro_parcelas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    financeiro_id uuid NOT NULL,
    numero smallint NOT NULL,
    valor numeric(10,2) NOT NULL,
    vencimento date NOT NULL,
    status_pagamento public.financeiro_status DEFAULT 'ABERTO'::public.financeiro_status NOT NULL,
    pago_em timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT financeiro_parcelas_numero_check CHECK ((numero > 0)),
    CONSTRAINT financeiro_parcelas_valor_check CHECK ((valor > (0)::numeric))
);

ALTER TABLE ONLY public.financeiro_parcelas
    ADD CONSTRAINT financeiro_parcelas_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.financeiro_parcelas
    ADD CONSTRAINT financeiro_parcelas_financeiro_id_numero_key UNIQUE (financeiro_id, numero);

ALTER TABLE ONLY public.financeiro_parcelas
    ADD CONSTRAINT financeiro_parcelas_financeiro_id_fkey FOREIGN KEY (financeiro_id) REFERENCES public.financeiro(id) ON DELETE CASCADE;

CREATE INDEX financeiro_parcelas_financeiro_id_idx ON public.financeiro_parcelas USING btree (financeiro_id);
CREATE INDEX financeiro_parcelas_vencimento_idx ON public.financeiro_parcelas USING btree (vencimento);

--
-- Name: financeiro_pagamentos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financeiro_pagamentos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    financeiro_id uuid NOT NULL,
    parcela_id uuid,
    valor_pago numeric(10,2) NOT NULL,
    forma_pagamento public.forma_pagamento NOT NULL,
    pago_em timestamp with time zone DEFAULT now() NOT NULL,
    registrado_por uuid DEFAULT auth.uid() NOT NULL,
    observacoes text,
    estornado boolean DEFAULT false NOT NULL,
    estornado_em timestamp with time zone,
    estornado_por uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT financeiro_pagamentos_valor_pago_check CHECK ((valor_pago > (0)::numeric))
);

ALTER TABLE ONLY public.financeiro_pagamentos
    ADD CONSTRAINT financeiro_pagamentos_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.financeiro_pagamentos
    ADD CONSTRAINT financeiro_pagamentos_financeiro_id_fkey FOREIGN KEY (financeiro_id) REFERENCES public.financeiro(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.financeiro_pagamentos
    ADD CONSTRAINT financeiro_pagamentos_parcela_id_fkey FOREIGN KEY (parcela_id) REFERENCES public.financeiro_parcelas(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.financeiro_pagamentos
    ADD CONSTRAINT financeiro_pagamentos_registrado_por_fkey FOREIGN KEY (registrado_por) REFERENCES auth.users(id);

ALTER TABLE ONLY public.financeiro_pagamentos
    ADD CONSTRAINT financeiro_pagamentos_estornado_por_fkey FOREIGN KEY (estornado_por) REFERENCES auth.users(id);

CREATE INDEX financeiro_pagamentos_financeiro_id_idx ON public.financeiro_pagamentos USING btree (financeiro_id);
CREATE INDEX financeiro_pagamentos_parcela_id_idx ON public.financeiro_pagamentos USING btree (parcela_id);

--
-- Name: financeiro_anexos; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financeiro_anexos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    financeiro_id uuid NOT NULL,
    arquivo_path text NOT NULL,
    nome_arquivo text NOT NULL,
    enviado_por uuid DEFAULT auth.uid() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.financeiro_anexos
    ADD CONSTRAINT financeiro_anexos_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.financeiro_anexos
    ADD CONSTRAINT financeiro_anexos_financeiro_id_fkey FOREIGN KEY (financeiro_id) REFERENCES public.financeiro(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.financeiro_anexos
    ADD CONSTRAINT financeiro_anexos_enviado_por_fkey FOREIGN KEY (enviado_por) REFERENCES auth.users(id);

CREATE INDEX financeiro_anexos_financeiro_id_idx ON public.financeiro_anexos USING btree (financeiro_id);

--
-- Name: financeiro_auditoria; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.financeiro_auditoria (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    financeiro_id uuid NOT NULL,
    actor_id uuid,
    actor_nome text,
    acao text NOT NULL,
    valor_anterior jsonb,
    valor_novo jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

ALTER TABLE ONLY public.financeiro_auditoria
    ADD CONSTRAINT financeiro_auditoria_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.financeiro_auditoria
    ADD CONSTRAINT financeiro_auditoria_financeiro_id_fkey FOREIGN KEY (financeiro_id) REFERENCES public.financeiro(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.financeiro_auditoria
    ADD CONSTRAINT financeiro_auditoria_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id);

CREATE INDEX financeiro_auditoria_financeiro_id_idx ON public.financeiro_auditoria USING btree (financeiro_id);

--
-- Name: recalcular_status_financeiro(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recalcular_status_financeiro(p_financeiro_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_devido numeric(10,2);
  v_pago numeric(10,2);
  v_status_atual public.financeiro_status;
BEGIN
  SELECT (f.valor - f.desconto + f.juros + f.multa), f.status_pagamento
    INTO v_devido, v_status_atual
    FROM public.financeiro f WHERE f.id = p_financeiro_id;

  IF v_status_atual IS NULL THEN
    RETURN;
  END IF;

  SELECT COALESCE(SUM(p.valor_pago), 0) INTO v_pago
    FROM public.financeiro_pagamentos p
    WHERE p.financeiro_id = p_financeiro_id AND p.estornado = false;

  UPDATE public.financeiro
     SET status_pagamento = CASE
           WHEN v_status_atual = 'CANCELADO' THEN 'CANCELADO'::public.financeiro_status
           WHEN v_pago <= 0 THEN 'ABERTO'::public.financeiro_status
           WHEN v_devido > 0 AND v_pago < v_devido THEN 'PARCIAL'::public.financeiro_status
           ELSE 'PAGO'::public.financeiro_status
         END,
         pago_em = CASE
           WHEN v_status_atual != 'CANCELADO' AND v_devido > 0 AND v_pago >= v_devido THEN (
             SELECT MAX(p.pago_em) FROM public.financeiro_pagamentos p
              WHERE p.financeiro_id = p_financeiro_id AND p.estornado = false
           )
           ELSE NULL
         END
   WHERE id = p_financeiro_id;

  IF EXISTS (SELECT 1 FROM public.financeiro_parcelas WHERE financeiro_id = p_financeiro_id) THEN
    UPDATE public.financeiro_parcelas fp
       SET status_pagamento = CASE
             WHEN COALESCE((
               SELECT SUM(p.valor_pago) FROM public.financeiro_pagamentos p
                WHERE p.parcela_id = fp.id AND p.estornado = false
             ), 0) <= 0 THEN 'ABERTO'::public.financeiro_status
             WHEN COALESCE((
               SELECT SUM(p.valor_pago) FROM public.financeiro_pagamentos p
                WHERE p.parcela_id = fp.id AND p.estornado = false
             ), 0) < fp.valor THEN 'PARCIAL'::public.financeiro_status
             ELSE 'PAGO'::public.financeiro_status
           END,
           pago_em = (
             SELECT MAX(p.pago_em) FROM public.financeiro_pagamentos p
              WHERE p.parcela_id = fp.id AND p.estornado = false
           )
     WHERE fp.financeiro_id = p_financeiro_id;
  END IF;
END;
$$;

--
-- Name: trg_financeiro_pagamentos_recalc(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_financeiro_pagamentos_recalc() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.recalcular_status_financeiro(COALESCE(NEW.financeiro_id, OLD.financeiro_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_financeiro_pagamentos_recalc
  AFTER INSERT OR UPDATE OR DELETE ON public.financeiro_pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.trg_financeiro_pagamentos_recalc();

CREATE TRIGGER trg_financeiro_parcelas_updated
  BEFORE UPDATE ON public.financeiro_parcelas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

--
-- Name: bloquear_edicao_financeiro_pago(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bloquear_edicao_financeiro_pago() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  IF OLD.status_pagamento = 'PAGO' AND (
       NEW.valor IS DISTINCT FROM OLD.valor OR
       NEW.desconto IS DISTINCT FROM OLD.desconto OR
       NEW.juros IS DISTINCT FROM OLD.juros OR
       NEW.multa IS DISTINCT FROM OLD.multa
     ) THEN
    RAISE EXCEPTION 'Lançamento já pago não pode ter valor/desconto/juros/multa alterado diretamente. Registre um estorno da baixa em vez disso.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_bloquear_edicao_financeiro_pago
  BEFORE UPDATE ON public.financeiro
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_edicao_financeiro_pago();

--
-- Name: log_financeiro_auditoria(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_financeiro_auditoria() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_actor_nome text;
  v_acao text;
BEGIN
  SELECT nome INTO v_actor_nome FROM public.profiles WHERE id = auth.uid();

  IF TG_OP = 'UPDATE' AND TG_TABLE_NAME = 'financeiro' THEN
    IF NEW.status_pagamento IS DISTINCT FROM OLD.status_pagamento THEN
      v_acao := CASE
        WHEN NEW.status_pagamento = 'CANCELADO' THEN 'CANCELADO'
        WHEN OLD.status_pagamento = 'PAGO' AND NEW.status_pagamento IN ('ABERTO','PARCIAL') THEN 'REABERTO'
        ELSE 'STATUS_ALTERADO'
      END;
      INSERT INTO public.financeiro_auditoria (financeiro_id, actor_id, actor_nome, acao, valor_anterior, valor_novo)
      VALUES (
        NEW.id, auth.uid(), v_actor_nome, v_acao,
        jsonb_build_object('status_pagamento', OLD.status_pagamento, 'valor', OLD.valor, 'desconto', OLD.desconto, 'juros', OLD.juros, 'multa', OLD.multa),
        jsonb_build_object('status_pagamento', NEW.status_pagamento, 'valor', NEW.valor, 'desconto', NEW.desconto, 'juros', NEW.juros, 'multa', NEW.multa)
      );
    ELSIF NEW.desconto IS DISTINCT FROM OLD.desconto OR NEW.juros IS DISTINCT FROM OLD.juros
       OR NEW.multa IS DISTINCT FROM OLD.multa OR NEW.observacoes IS DISTINCT FROM OLD.observacoes THEN
      INSERT INTO public.financeiro_auditoria (financeiro_id, actor_id, actor_nome, acao, valor_anterior, valor_novo)
      VALUES (
        NEW.id, auth.uid(), v_actor_nome, 'EDITADO',
        jsonb_build_object('desconto', OLD.desconto, 'juros', OLD.juros, 'multa', OLD.multa, 'observacoes', OLD.observacoes),
        jsonb_build_object('desconto', NEW.desconto, 'juros', NEW.juros, 'multa', NEW.multa, 'observacoes', NEW.observacoes)
      );
    END IF;
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'financeiro_pagamentos' THEN
    IF TG_OP = 'INSERT' THEN
      INSERT INTO public.financeiro_auditoria (financeiro_id, actor_id, actor_nome, acao, valor_novo)
      VALUES (NEW.financeiro_id, auth.uid(), v_actor_nome, 'BAIXA_REGISTRADA',
        jsonb_build_object('valor_pago', NEW.valor_pago, 'forma_pagamento', NEW.forma_pagamento, 'pago_em', NEW.pago_em));
      RETURN NEW;
    ELSIF TG_OP = 'UPDATE' AND NEW.estornado = true AND OLD.estornado = false THEN
      INSERT INTO public.financeiro_auditoria (financeiro_id, actor_id, actor_nome, acao, valor_anterior)
      VALUES (NEW.financeiro_id, auth.uid(), v_actor_nome, 'BAIXA_ESTORNADA',
        jsonb_build_object('valor_pago', NEW.valor_pago, 'forma_pagamento', NEW.forma_pagamento));
      RETURN NEW;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_financeiro_auditoria
  AFTER UPDATE ON public.financeiro
  FOR EACH ROW EXECUTE FUNCTION public.log_financeiro_auditoria();

CREATE TRIGGER trg_financeiro_pagamentos_auditoria
  AFTER INSERT OR UPDATE ON public.financeiro_pagamentos
  FOR EACH ROW EXECUTE FUNCTION public.log_financeiro_auditoria();

--
-- Name: financeiro_evolucao_mensal(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.financeiro_evolucao_mensal(p_meses integer DEFAULT 12)
RETURNS TABLE(mes date, recebido numeric, aberto numeric, qtd integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_is_admin boolean := public.has_role(auth.uid(), 'ADMIN'::public.app_role);
  v_profissional_id uuid;
BEGIN
  IF NOT v_is_admin THEN
    SELECT p.id INTO v_profissional_id FROM public.profissionais p WHERE p.user_id = auth.uid();
    IF v_profissional_id IS NULL THEN
      RETURN;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    date_trunc('month', COALESCE(f.pago_em, f.created_at))::date AS mes,
    SUM(CASE WHEN f.status_pagamento = 'PAGO' THEN (f.valor - f.desconto + f.juros + f.multa) ELSE 0 END) AS recebido,
    SUM(CASE WHEN f.status_pagamento IN ('ABERTO','PARCIAL') THEN (f.valor - f.desconto + f.juros + f.multa) ELSE 0 END) AS aberto,
    COUNT(*)::integer AS qtd
  FROM public.financeiro f
  WHERE COALESCE(f.pago_em, f.created_at) >= (date_trunc('month', now()) - (p_meses - 1) * interval '1 month')
    AND (v_is_admin OR f.profissional_id = v_profissional_id)
  GROUP BY 1
  ORDER BY 1;
END;
$$;

--
-- Name: financeiro_parcelas Row Security; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.financeiro_parcelas ENABLE ROW LEVEL SECURITY;

CREATE POLICY parcelas_read ON public.financeiro_parcelas FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'ADMIN'::public.app_role) OR (EXISTS ( SELECT 1
   FROM (public.financeiro f
     JOIN public.profissionais p ON ((p.id = f.profissional_id)))
  WHERE ((f.id = financeiro_parcelas.financeiro_id) AND (p.user_id = auth.uid()))))));

CREATE POLICY parcelas_admin_write ON public.financeiro_parcelas FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::public.app_role));

CREATE POLICY parcelas_admin_update ON public.financeiro_parcelas FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::public.app_role));

CREATE POLICY parcelas_admin_delete ON public.financeiro_parcelas FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'::public.app_role));

--
-- Name: financeiro_pagamentos Row Security; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.financeiro_pagamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY pagamentos_read ON public.financeiro_pagamentos FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'ADMIN'::public.app_role) OR (EXISTS ( SELECT 1
   FROM (public.financeiro f
     JOIN public.profissionais p ON ((p.id = f.profissional_id)))
  WHERE ((f.id = financeiro_pagamentos.financeiro_id) AND (p.user_id = auth.uid()))))));

CREATE POLICY pagamentos_admin_write ON public.financeiro_pagamentos FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'ADMIN'::public.app_role) AND (registrado_por = auth.uid())));

CREATE POLICY pagamentos_admin_update ON public.financeiro_pagamentos FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'::public.app_role)) WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::public.app_role));

--
-- Name: financeiro_anexos Row Security; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.financeiro_anexos ENABLE ROW LEVEL SECURITY;

CREATE POLICY anexos_read ON public.financeiro_anexos FOR SELECT TO authenticated USING ((public.has_role(auth.uid(), 'ADMIN'::public.app_role) OR (EXISTS ( SELECT 1
   FROM (public.financeiro f
     JOIN public.profissionais p ON ((p.id = f.profissional_id)))
  WHERE ((f.id = financeiro_anexos.financeiro_id) AND (p.user_id = auth.uid()))))));

CREATE POLICY anexos_admin_write ON public.financeiro_anexos FOR INSERT TO authenticated WITH CHECK ((public.has_role(auth.uid(), 'ADMIN'::public.app_role) AND (enviado_por = auth.uid())));

CREATE POLICY anexos_admin_delete ON public.financeiro_anexos FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'::public.app_role));

--
-- Name: financeiro_auditoria Row Security; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.financeiro_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY auditoria_admin_read ON public.financeiro_auditoria FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'ADMIN'::public.app_role));

--
-- Name: TABLE financeiro_parcelas; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.financeiro_parcelas TO authenticated;
GRANT ALL ON TABLE public.financeiro_parcelas TO service_role;

--
-- Name: TABLE financeiro_pagamentos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.financeiro_pagamentos TO authenticated;
GRANT ALL ON TABLE public.financeiro_pagamentos TO service_role;

--
-- Name: TABLE financeiro_anexos; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.financeiro_anexos TO authenticated;
GRANT ALL ON TABLE public.financeiro_anexos TO service_role;

--
-- Name: TABLE financeiro_auditoria; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.financeiro_auditoria TO authenticated;
GRANT ALL ON TABLE public.financeiro_auditoria TO service_role;

--
-- PostgreSQL database dump complete
--


