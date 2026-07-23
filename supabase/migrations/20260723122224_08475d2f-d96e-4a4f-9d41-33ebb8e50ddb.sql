
-- Disponibilidade semanal recorrente
CREATE TABLE public.profissional_disponibilidade (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id UUID NOT NULL REFERENCES public.profissionais(id) ON DELETE CASCADE,
  dia_semana SMALLINT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (hora_fim > hora_inicio)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profissional_disponibilidade TO authenticated;
GRANT ALL ON public.profissional_disponibilidade TO service_role;
ALTER TABLE public.profissional_disponibilidade ENABLE ROW LEVEL SECURITY;

CREATE POLICY disp_read ON public.profissional_disponibilidade FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'ADMIN') OR public.has_role(auth.uid(),'RECEPCIONISTA')
  OR EXISTS (SELECT 1 FROM public.profissionais p WHERE p.id = profissional_id AND (p.user_id = auth.uid() OR p.status='ATIVO'))
);
CREATE POLICY disp_write ON public.profissional_disponibilidade FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(),'ADMIN')
  OR EXISTS (SELECT 1 FROM public.profissionais p WHERE p.id = profissional_id AND p.user_id = auth.uid())
);
CREATE POLICY disp_update ON public.profissional_disponibilidade FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(),'ADMIN')
  OR EXISTS (SELECT 1 FROM public.profissionais p WHERE p.id = profissional_id AND p.user_id = auth.uid())
) WITH CHECK (
  public.has_role(auth.uid(),'ADMIN')
  OR EXISTS (SELECT 1 FROM public.profissionais p WHERE p.id = profissional_id AND p.user_id = auth.uid())
);
CREATE POLICY disp_delete ON public.profissional_disponibilidade FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(),'ADMIN')
  OR EXISTS (SELECT 1 FROM public.profissionais p WHERE p.id = profissional_id AND p.user_id = auth.uid())
);

-- Bloqueios pontuais
CREATE TABLE public.profissional_bloqueio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id UUID NOT NULL REFERENCES public.profissionais(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  hora_inicio TIME NOT NULL,
  hora_fim TIME NOT NULL,
  motivo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (hora_fim > hora_inicio)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profissional_bloqueio TO authenticated;
GRANT ALL ON public.profissional_bloqueio TO service_role;
ALTER TABLE public.profissional_bloqueio ENABLE ROW LEVEL SECURITY;

CREATE POLICY bloq_read ON public.profissional_bloqueio FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(),'ADMIN') OR public.has_role(auth.uid(),'RECEPCIONISTA')
  OR EXISTS (SELECT 1 FROM public.profissionais p WHERE p.id = profissional_id AND p.user_id = auth.uid())
);
CREATE POLICY bloq_write ON public.profissional_bloqueio FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(),'ADMIN')
  OR EXISTS (SELECT 1 FROM public.profissionais p WHERE p.id = profissional_id AND p.user_id = auth.uid())
);
CREATE POLICY bloq_update ON public.profissional_bloqueio FOR UPDATE TO authenticated
USING (
  public.has_role(auth.uid(),'ADMIN')
  OR EXISTS (SELECT 1 FROM public.profissionais p WHERE p.id = profissional_id AND p.user_id = auth.uid())
) WITH CHECK (
  public.has_role(auth.uid(),'ADMIN')
  OR EXISTS (SELECT 1 FROM public.profissionais p WHERE p.id = profissional_id AND p.user_id = auth.uid())
);
CREATE POLICY bloq_delete ON public.profissional_bloqueio FOR DELETE TO authenticated
USING (
  public.has_role(auth.uid(),'ADMIN')
  OR EXISTS (SELECT 1 FROM public.profissionais p WHERE p.id = profissional_id AND p.user_id = auth.uid())
);

-- Enhanced conflict trigger: also validate blocks & availability
CREATE OR REPLACE FUNCTION public.check_agendamento_conflito()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
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

DROP TRIGGER IF EXISTS trg_check_agendamento_conflito ON public.agendamentos;
CREATE TRIGGER trg_check_agendamento_conflito
BEFORE INSERT OR UPDATE ON public.agendamentos
FOR EACH ROW EXECUTE FUNCTION public.check_agendamento_conflito();

-- Auto-cria lançamento financeiro quando agendamento vai a APROVADO
CREATE OR REPLACE FUNCTION public.on_agendamento_aprovado()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'APROVADO' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'APROVADO') THEN
    IF NOT EXISTS (SELECT 1 FROM public.financeiro f WHERE f.agendamento_id = NEW.id) THEN
      INSERT INTO public.financeiro (agendamento_id, paciente_id, profissional_id, valor, forma_pagamento, status_pagamento)
      VALUES (NEW.id, NEW.paciente_id, NEW.profissional_id, COALESCE(NEW.valor,0), NEW.forma_pagamento, 'ABERTO');
    END IF;
  END IF;
  RETURN NEW;
END;$$;

DROP TRIGGER IF EXISTS trg_on_agendamento_aprovado ON public.agendamentos;
CREATE TRIGGER trg_on_agendamento_aprovado
AFTER INSERT OR UPDATE ON public.agendamentos
FOR EACH ROW EXECUTE FUNCTION public.on_agendamento_aprovado();

CREATE INDEX IF NOT EXISTS idx_ag_prof_data ON public.agendamentos(profissional_id, data);
CREATE INDEX IF NOT EXISTS idx_bloq_prof_data ON public.profissional_bloqueio(profissional_id, data);
CREATE INDEX IF NOT EXISTS idx_disp_prof ON public.profissional_disponibilidade(profissional_id, dia_semana);
