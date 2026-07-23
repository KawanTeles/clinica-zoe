
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE FUNCTION public.check_agendamento_conflito()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
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
