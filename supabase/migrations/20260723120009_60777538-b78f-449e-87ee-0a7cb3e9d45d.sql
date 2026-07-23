
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('ADMIN','RECEPCIONISTA','PROFISSIONAL','CLIENTE');
CREATE TYPE public.agendamento_status AS ENUM ('PENDENTE','APROVADO','RECUSADO','CANCELADO','REMARCADO','FINALIZADO');
CREATE TYPE public.financeiro_status AS ENUM ('ABERTO','PAGO','CANCELADO');
CREATE TYPE public.forma_pagamento AS ENUM ('DINHEIRO','PIX','CARTAO_DEBITO','CARTAO_CREDITO','OUTRO');
CREATE TYPE public.profissional_status AS ENUM ('ATIVO','INATIVO');
CREATE TYPE public.wa_status AS ENUM ('PENDENTE','ENVIADO','FALHOU');

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL DEFAULT '',
  email text NOT NULL,
  telefone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============ USER_ROLES ============
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.current_user_has_role(_role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = _role);
$$;

-- ============ ESPECIALIDADES ============
CREATE TABLE public.especialidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  descricao text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.especialidades TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.especialidades TO authenticated;
GRANT ALL ON public.especialidades TO service_role;
ALTER TABLE public.especialidades ENABLE ROW LEVEL SECURITY;

-- ============ PROFISSIONAIS ============
CREATE TABLE public.profissionais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  nome text NOT NULL,
  foto_url text,
  especialidade_id uuid REFERENCES public.especialidades(id) ON DELETE SET NULL,
  registro_profissional text,
  email text,
  telefone text,
  descricao text,
  valor_consulta_avista numeric(10,2) DEFAULT 0,
  valor_consulta_cartao numeric(10,2) DEFAULT 0,
  duracao_consulta_min int DEFAULT 60,
  status public.profissional_status NOT NULL DEFAULT 'ATIVO',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profissionais TO authenticated;
GRANT ALL ON public.profissionais TO service_role;
ALTER TABLE public.profissionais ENABLE ROW LEVEL SECURITY;

-- ============ PACIENTES ============
CREATE TABLE public.pacientes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  nome text NOT NULL,
  telefone text,
  email text,
  data_nascimento date,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pacientes TO authenticated;
GRANT ALL ON public.pacientes TO service_role;
ALTER TABLE public.pacientes ENABLE ROW LEVEL SECURITY;

-- ============ AGENDAMENTOS ============
CREATE TABLE public.agendamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id uuid REFERENCES public.pacientes(id) ON DELETE SET NULL,
  cliente_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  profissional_id uuid NOT NULL REFERENCES public.profissionais(id) ON DELETE CASCADE,
  data date NOT NULL,
  hora_inicio time NOT NULL,
  hora_fim time NOT NULL,
  status public.agendamento_status NOT NULL DEFAULT 'PENDENTE',
  valor numeric(10,2) DEFAULT 0,
  forma_pagamento public.forma_pagamento,
  observacoes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_agendamentos_prof_data ON public.agendamentos(profissional_id, data);
CREATE INDEX idx_agendamentos_paciente ON public.agendamentos(paciente_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agendamentos TO authenticated;
GRANT ALL ON public.agendamentos TO service_role;
ALTER TABLE public.agendamentos ENABLE ROW LEVEL SECURITY;

-- Impede sobreposição de horários para o mesmo profissional em agendamentos ativos
CREATE OR REPLACE FUNCTION public.check_agendamento_conflito()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status IN ('PENDENTE','APROVADO','REMARCADO') THEN
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
  END IF;
  RETURN NEW;
END;$$;
CREATE TRIGGER trg_agendamento_conflito
BEFORE INSERT OR UPDATE ON public.agendamentos
FOR EACH ROW EXECUTE FUNCTION public.check_agendamento_conflito();

-- ============ FINANCEIRO ============
CREATE TABLE public.financeiro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id uuid REFERENCES public.agendamentos(id) ON DELETE SET NULL,
  paciente_id uuid REFERENCES public.pacientes(id) ON DELETE SET NULL,
  profissional_id uuid REFERENCES public.profissionais(id) ON DELETE SET NULL,
  valor numeric(10,2) NOT NULL DEFAULT 0,
  status_pagamento public.financeiro_status NOT NULL DEFAULT 'ABERTO',
  forma_pagamento public.forma_pagamento,
  pago_em timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro TO authenticated;
GRANT ALL ON public.financeiro TO service_role;
ALTER TABLE public.financeiro ENABLE ROW LEVEL SECURITY;

-- ============ NOTIFICACOES ============
CREATE TABLE public.notificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  mensagem text NOT NULL,
  tipo text NOT NULL DEFAULT 'INFO',
  lida boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notificacoes TO authenticated;
GRANT ALL ON public.notificacoes TO service_role;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY;

-- ============ WHATSAPP QUEUE ============
CREATE TABLE public.whatsapp_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  destinatario text NOT NULL,
  mensagem text NOT NULL,
  status public.wa_status NOT NULL DEFAULT 'PENDENTE',
  tentativas int NOT NULL DEFAULT 0,
  erro text,
  created_at timestamptz NOT NULL DEFAULT now(),
  enviado_em timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_queue TO authenticated;
GRANT ALL ON public.whatsapp_queue TO service_role;
ALTER TABLE public.whatsapp_queue ENABLE ROW LEVEL SECURITY;

-- ============ POLICIES ============
-- PROFILES
CREATE POLICY "profiles_self_select" ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR public.has_role(auth.uid(),'ADMIN') OR public.has_role(auth.uid(),'RECEPCIONISTA'));
CREATE POLICY "profiles_self_update" ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid() OR public.has_role(auth.uid(),'ADMIN'))
WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(),'ADMIN'));
CREATE POLICY "profiles_admin_insert" ON public.profiles FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'ADMIN') OR id = auth.uid());

-- USER_ROLES
CREATE POLICY "user_roles_self_read" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'ADMIN'));

-- ESPECIALIDADES
CREATE POLICY "esp_read_all_auth" ON public.especialidades FOR SELECT TO authenticated USING (true);
CREATE POLICY "esp_admin_write" ON public.especialidades FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'ADMIN'));
CREATE POLICY "esp_admin_update" ON public.especialidades FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'ADMIN')) WITH CHECK (public.has_role(auth.uid(),'ADMIN'));
CREATE POLICY "esp_admin_delete" ON public.especialidades FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'ADMIN'));

-- PROFISSIONAIS
CREATE POLICY "prof_read" ON public.profissionais FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'ADMIN')
  OR public.has_role(auth.uid(),'RECEPCIONISTA')
  OR user_id = auth.uid()
  OR status = 'ATIVO'
);
CREATE POLICY "prof_admin_insert" ON public.profissionais FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'ADMIN'));
CREATE POLICY "prof_admin_or_self_update" ON public.profissionais FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'ADMIN') OR user_id = auth.uid())
WITH CHECK (public.has_role(auth.uid(),'ADMIN') OR user_id = auth.uid());
CREATE POLICY "prof_admin_delete" ON public.profissionais FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'ADMIN'));

-- PACIENTES
CREATE POLICY "pac_read" ON public.pacientes FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'ADMIN')
  OR public.has_role(auth.uid(),'RECEPCIONISTA')
  OR user_id = auth.uid()
  OR (public.has_role(auth.uid(),'PROFISSIONAL') AND EXISTS (
      SELECT 1 FROM public.agendamentos a
      JOIN public.profissionais p ON p.id = a.profissional_id
      WHERE a.paciente_id = pacientes.id AND p.user_id = auth.uid()
  ))
);
CREATE POLICY "pac_staff_insert" ON public.pacientes FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(),'ADMIN')
  OR public.has_role(auth.uid(),'RECEPCIONISTA')
  OR user_id = auth.uid()
);
CREATE POLICY "pac_staff_update" ON public.pacientes FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(),'ADMIN')
  OR public.has_role(auth.uid(),'RECEPCIONISTA')
  OR user_id = auth.uid()
) WITH CHECK (
  public.has_role(auth.uid(),'ADMIN')
  OR public.has_role(auth.uid(),'RECEPCIONISTA')
  OR user_id = auth.uid()
);
CREATE POLICY "pac_admin_delete" ON public.pacientes FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'ADMIN'));

-- AGENDAMENTOS
CREATE POLICY "ag_read" ON public.agendamentos FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'ADMIN')
  OR public.has_role(auth.uid(),'RECEPCIONISTA')
  OR cliente_user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profissionais p WHERE p.id = profissional_id AND p.user_id = auth.uid())
);
CREATE POLICY "ag_insert" ON public.agendamentos FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(),'ADMIN')
  OR public.has_role(auth.uid(),'RECEPCIONISTA')
  OR cliente_user_id = auth.uid()
);
CREATE POLICY "ag_update" ON public.agendamentos FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(),'ADMIN')
  OR public.has_role(auth.uid(),'RECEPCIONISTA')
  OR cliente_user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profissionais p WHERE p.id = profissional_id AND p.user_id = auth.uid())
) WITH CHECK (
  public.has_role(auth.uid(),'ADMIN')
  OR public.has_role(auth.uid(),'RECEPCIONISTA')
  OR cliente_user_id = auth.uid()
  OR EXISTS (SELECT 1 FROM public.profissionais p WHERE p.id = profissional_id AND p.user_id = auth.uid())
);
CREATE POLICY "ag_admin_delete" ON public.agendamentos FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'ADMIN'));

-- FINANCEIRO (Admin e profissional dono)
CREATE POLICY "fin_read" ON public.financeiro FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'ADMIN')
  OR EXISTS (SELECT 1 FROM public.profissionais p WHERE p.id = profissional_id AND p.user_id = auth.uid())
);
CREATE POLICY "fin_insert" ON public.financeiro FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'ADMIN'));
CREATE POLICY "fin_update" ON public.financeiro FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(),'ADMIN')
  OR EXISTS (SELECT 1 FROM public.profissionais p WHERE p.id = profissional_id AND p.user_id = auth.uid())
) WITH CHECK (
  public.has_role(auth.uid(),'ADMIN')
  OR EXISTS (SELECT 1 FROM public.profissionais p WHERE p.id = profissional_id AND p.user_id = auth.uid())
);
CREATE POLICY "fin_admin_delete" ON public.financeiro FOR DELETE TO authenticated
USING (public.has_role(auth.uid(),'ADMIN'));

-- NOTIFICACOES
CREATE POLICY "notif_owner_read" ON public.notificacoes FOR SELECT TO authenticated
USING (usuario_id = auth.uid() OR public.has_role(auth.uid(),'ADMIN'));
CREATE POLICY "notif_owner_update" ON public.notificacoes FOR UPDATE TO authenticated
USING (usuario_id = auth.uid()) WITH CHECK (usuario_id = auth.uid());
CREATE POLICY "notif_admin_insert" ON public.notificacoes FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'ADMIN'));

-- WHATSAPP_QUEUE (apenas admin)
CREATE POLICY "wa_admin_all" ON public.whatsapp_queue FOR SELECT TO authenticated
USING (public.has_role(auth.uid(),'ADMIN'));
CREATE POLICY "wa_admin_insert" ON public.whatsapp_queue FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(),'ADMIN'));
CREATE POLICY "wa_admin_update" ON public.whatsapp_queue FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(),'ADMIN')) WITH CHECK (public.has_role(auth.uid(),'ADMIN'));

-- ============ HANDLE NEW USER (trigger auth.users) ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_profissionais_updated BEFORE UPDATE ON public.profissionais FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_pacientes_updated BEFORE UPDATE ON public.pacientes FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_agendamentos_updated BEFORE UPDATE ON public.agendamentos FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER trg_financeiro_updated BEFORE UPDATE ON public.financeiro FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Especialidades iniciais
INSERT INTO public.especialidades (nome) VALUES
  ('Clínica Geral'),
  ('Psicologia'),
  ('Nutrição'),
  ('Fisioterapia'),
  ('Dermatologia')
ON CONFLICT DO NOTHING;
