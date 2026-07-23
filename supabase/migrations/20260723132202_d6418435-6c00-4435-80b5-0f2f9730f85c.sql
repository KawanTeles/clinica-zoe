
-- Enums
DO $$ BEGIN
  CREATE TYPE public.notif_canal AS ENUM ('WHATSAPP','EMAIL','INTERNO');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.notif_status_envio AS ENUM ('PENDENTE','ENVIANDO','ENVIADA','ERRO','CANCELADA');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.notif_evento AS ENUM (
    'SOLICITACAO_NOVA','CONSULTA_APROVADA','CONSULTA_RECUSADA',
    'CONSULTA_CANCELADA','CONSULTA_REMARCADA','LEMBRETE_24H','PAGAMENTO_CONFIRMADO'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Extend notificacoes
ALTER TABLE public.notificacoes
  ADD COLUMN IF NOT EXISTS canal public.notif_canal NOT NULL DEFAULT 'INTERNO',
  ADD COLUMN IF NOT EXISTS status_envio public.notif_status_envio NOT NULL DEFAULT 'PENDENTE',
  ADD COLUMN IF NOT EXISTS tentativas integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ultimo_erro text,
  ADD COLUMN IF NOT EXISTS enviado_em timestamptz,
  ADD COLUMN IF NOT EXISTS evento public.notif_evento,
  ADD COLUMN IF NOT EXISTS agendamento_id uuid REFERENCES public.agendamentos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS destinatario_telefone text,
  ADD COLUMN IF NOT EXISTS destinatario_email text,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_notif_status ON public.notificacoes(status_envio);
CREATE INDEX IF NOT EXISTS idx_notif_canal ON public.notificacoes(canal);
CREATE INDEX IF NOT EXISTS idx_notif_agendamento ON public.notificacoes(agendamento_id);
CREATE INDEX IF NOT EXISTS idx_notif_usuario ON public.notificacoes(usuario_id);

DROP TRIGGER IF EXISTS trg_notif_updated ON public.notificacoes;
CREATE TRIGGER trg_notif_updated BEFORE UPDATE ON public.notificacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Refresh RLS: admin all, owner read, admin update/insert via trigger (SECURITY DEFINER)
DROP POLICY IF EXISTS notif_admin_insert ON public.notificacoes;
DROP POLICY IF EXISTS notif_owner_read ON public.notificacoes;
DROP POLICY IF EXISTS notif_owner_update ON public.notificacoes;
DROP POLICY IF EXISTS notif_admin_all ON public.notificacoes;
DROP POLICY IF EXISTS notif_admin_update ON public.notificacoes;

CREATE POLICY notif_read ON public.notificacoes FOR SELECT TO authenticated
  USING (usuario_id = auth.uid() OR public.has_role(auth.uid(),'ADMIN'));
CREATE POLICY notif_admin_insert ON public.notificacoes FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'ADMIN'));
CREATE POLICY notif_admin_update ON public.notificacoes FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'ADMIN') OR usuario_id = auth.uid())
  WITH CHECK (public.has_role(auth.uid(),'ADMIN') OR usuario_id = auth.uid());
CREATE POLICY notif_admin_delete ON public.notificacoes FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'ADMIN'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;

-- Helper: enqueue notification (SECURITY DEFINER bypasses RLS in trigger context)
CREATE OR REPLACE FUNCTION public.enqueue_notificacao(
  _usuario_id uuid,
  _titulo text,
  _mensagem text,
  _evento public.notif_evento,
  _canal public.notif_canal DEFAULT 'INTERNO',
  _agendamento_id uuid DEFAULT NULL,
  _telefone text DEFAULT NULL,
  _email text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF _usuario_id IS NULL THEN RETURN NULL; END IF;
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

  -- Interno já marca como enviado
  IF _canal = 'INTERNO' THEN
    UPDATE public.notificacoes SET enviado_em = now() WHERE id = v_id;
  END IF;

  RETURN v_id;
END;$$;

REVOKE ALL ON FUNCTION public.enqueue_notificacao(uuid,text,text,notif_evento,notif_canal,uuid,text,text) FROM PUBLIC, anon, authenticated;

-- Trigger: emitir eventos ao mudar agendamentos
CREATE OR REPLACE FUNCTION public.on_agendamento_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_prof_user uuid;
  v_prof_nome text;
  v_prof_tel text;
  v_prof_email text;
  v_pac_nome text;
  v_pac_user uuid;
  v_pac_tel text;
  v_pac_email text;
  v_data_str text;
  v_hora_str text;
BEGIN
  SELECT p.user_id, p.nome, p.telefone, p.email
    INTO v_prof_user, v_prof_nome, v_prof_tel, v_prof_email
    FROM public.profissionais p WHERE p.id = NEW.profissional_id;

  SELECT pa.nome, pa.user_id, pa.telefone, pa.email
    INTO v_pac_nome, v_pac_user, v_pac_tel, v_pac_email
    FROM public.pacientes pa WHERE pa.id = NEW.paciente_id;

  IF v_pac_user IS NULL THEN v_pac_user := NEW.cliente_user_id; END IF;

  v_data_str := to_char(NEW.data,'DD/MM/YYYY');
  v_hora_str := to_char(NEW.hora_inicio,'HH24:MI');

  IF TG_OP = 'INSERT' AND NEW.status = 'PENDENTE' THEN
    PERFORM public.enqueue_notificacao(
      v_prof_user,
      'Nova solicitação de consulta',
      'Você recebeu uma nova solicitação de consulta de ' || COALESCE(v_pac_nome,'um paciente') ||
        ' em ' || v_data_str || ' às ' || v_hora_str || '.',
      'SOLICITACAO_NOVA','INTERNO', NEW.id, v_prof_tel, v_prof_email
    );
    IF v_prof_tel IS NOT NULL THEN
      PERFORM public.enqueue_notificacao(
        v_prof_user,'Nova solicitação (WhatsApp)',
        'Nova solicitação de ' || COALESCE(v_pac_nome,'paciente') || ' em ' || v_data_str || ' ' || v_hora_str,
        'SOLICITACAO_NOVA','WHATSAPP', NEW.id, v_prof_tel, v_prof_email
      );
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'APROVADO' THEN
      PERFORM public.enqueue_notificacao(
        v_pac_user,'Consulta confirmada',
        'Sua consulta com ' || COALESCE(v_prof_nome,'o profissional') ||
          ' foi confirmada para ' || v_data_str || ' às ' || v_hora_str || '.',
        'CONSULTA_APROVADA','INTERNO', NEW.id, v_pac_tel, v_pac_email
      );
      IF v_pac_tel IS NOT NULL THEN
        PERFORM public.enqueue_notificacao(
          v_pac_user,'Consulta confirmada (WhatsApp)',
          'Olá ' || COALESCE(v_pac_nome,'') || ', sua consulta foi confirmada para ' || v_data_str || ' às ' || v_hora_str || '.',
          'CONSULTA_APROVADA','WHATSAPP', NEW.id, v_pac_tel, v_pac_email
        );
      END IF;
    ELSIF NEW.status = 'RECUSADO' THEN
      PERFORM public.enqueue_notificacao(
        v_pac_user,'Solicitação recusada',
        'Sua solicitação de consulta em ' || v_data_str || ' às ' || v_hora_str || ' não foi aprovada.',
        'CONSULTA_RECUSADA','INTERNO', NEW.id, v_pac_tel, v_pac_email
      );
      IF v_pac_tel IS NOT NULL THEN
        PERFORM public.enqueue_notificacao(
          v_pac_user,'Solicitação recusada (WhatsApp)',
          'Sua solicitação em ' || v_data_str || ' ' || v_hora_str || ' não foi aprovada.',
          'CONSULTA_RECUSADA','WHATSAPP', NEW.id, v_pac_tel, v_pac_email
        );
      END IF;
    ELSIF NEW.status = 'CANCELADO' THEN
      PERFORM public.enqueue_notificacao(v_pac_user,'Consulta cancelada',
        'Sua consulta em ' || v_data_str || ' às ' || v_hora_str || ' foi cancelada.',
        'CONSULTA_CANCELADA','INTERNO', NEW.id, v_pac_tel, v_pac_email);
      PERFORM public.enqueue_notificacao(v_prof_user,'Consulta cancelada',
        'A consulta com ' || COALESCE(v_pac_nome,'paciente') || ' em ' || v_data_str || ' às ' || v_hora_str || ' foi cancelada.',
        'CONSULTA_CANCELADA','INTERNO', NEW.id, v_prof_tel, v_prof_email);
    ELSIF NEW.status = 'REMARCADO' THEN
      PERFORM public.enqueue_notificacao(v_pac_user,'Consulta remarcada',
        'Sua consulta foi remarcada para ' || v_data_str || ' às ' || v_hora_str || '.',
        'CONSULTA_REMARCADA','INTERNO', NEW.id, v_pac_tel, v_pac_email);
      PERFORM public.enqueue_notificacao(v_prof_user,'Consulta remarcada',
        'A consulta com ' || COALESCE(v_pac_nome,'paciente') || ' foi remarcada para ' || v_data_str || ' às ' || v_hora_str || '.',
        'CONSULTA_REMARCADA','INTERNO', NEW.id, v_prof_tel, v_prof_email);
    END IF;
  END IF;

  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_agendamento_notify_ins ON public.agendamentos;
CREATE TRIGGER trg_agendamento_notify_ins
  AFTER INSERT ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.on_agendamento_notify();

DROP TRIGGER IF EXISTS trg_agendamento_notify_upd ON public.agendamentos;
CREATE TRIGGER trg_agendamento_notify_upd
  AFTER UPDATE ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.on_agendamento_notify();

-- Trigger: pagamento confirmado
CREATE OR REPLACE FUNCTION public.on_financeiro_notify()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_pac_user uuid; v_pac_nome text; v_pac_tel text; v_pac_email text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status_pagamento = 'PAGO' AND OLD.status_pagamento IS DISTINCT FROM 'PAGO' THEN
    SELECT pa.user_id, pa.nome, pa.telefone, pa.email
      INTO v_pac_user, v_pac_nome, v_pac_tel, v_pac_email
      FROM public.pacientes pa WHERE pa.id = NEW.paciente_id;

    PERFORM public.enqueue_notificacao(
      v_pac_user,'Pagamento confirmado',
      'Recebemos o pagamento de R$ ' || to_char(NEW.valor,'FM999G999D00') || '. Obrigado!',
      'PAGAMENTO_CONFIRMADO','INTERNO', NEW.agendamento_id, v_pac_tel, v_pac_email
    );
  END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_financeiro_notify ON public.financeiro;
CREATE TRIGGER trg_financeiro_notify
  AFTER UPDATE ON public.financeiro
  FOR EACH ROW EXECUTE FUNCTION public.on_financeiro_notify();
