CREATE OR REPLACE FUNCTION public.resolve_valor_consulta(
  _profissional_id uuid,
  _forma_pagamento text
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
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

CREATE OR REPLACE FUNCTION public.set_agendamento_valor_congelado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF COALESCE(NEW.valor, 0) = 0 THEN
    NEW.valor := public.resolve_valor_consulta(NEW.profissional_id, NEW.forma_pagamento::text);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_agendamento_valor_congelado ON public.agendamentos;
CREATE TRIGGER trg_set_agendamento_valor_congelado
BEFORE INSERT OR UPDATE OF profissional_id, forma_pagamento, valor, status
ON public.agendamentos
FOR EACH ROW
EXECUTE FUNCTION public.set_agendamento_valor_congelado();

CREATE OR REPLACE FUNCTION public.on_agendamento_aprovado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
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

UPDATE public.agendamentos
   SET valor = public.resolve_valor_consulta(profissional_id, forma_pagamento::text)
 WHERE COALESCE(valor, 0) = 0;

UPDATE public.financeiro f
   SET valor = a.valor,
       forma_pagamento = a.forma_pagamento
  FROM public.agendamentos a
 WHERE f.agendamento_id = a.id
   AND (f.valor IS DISTINCT FROM a.valor OR f.forma_pagamento IS DISTINCT FROM a.forma_pagamento);

REVOKE EXECUTE ON FUNCTION public.resolve_valor_consulta(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_agendamento_valor_congelado() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.on_agendamento_aprovado() FROM PUBLIC, anon, authenticated;