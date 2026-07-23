
CREATE OR REPLACE FUNCTION public.on_agendamento_aprovado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_valor numeric(10,2);
  v_avista numeric(10,2);
  v_cartao numeric(10,2);
BEGIN
  IF NEW.status = 'APROVADO' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'APROVADO') THEN
    v_valor := COALESCE(NEW.valor, 0);

    IF v_valor = 0 THEN
      SELECT valor_consulta_avista, valor_consulta_cartao
        INTO v_avista, v_cartao
        FROM public.profissionais
       WHERE id = NEW.profissional_id;

      IF NEW.forma_pagamento IN ('CARTAO_DEBITO','CARTAO_CREDITO') THEN
        v_valor := COALESCE(NULLIF(v_cartao,0), v_avista, 0);
      ELSE
        v_valor := COALESCE(NULLIF(v_avista,0), v_cartao, 0);
      END IF;

      IF v_valor > 0 AND COALESCE(NEW.valor,0) = 0 THEN
        UPDATE public.agendamentos SET valor = v_valor WHERE id = NEW.id;
        NEW.valor := v_valor;
      END IF;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM public.financeiro f WHERE f.agendamento_id = NEW.id) THEN
      INSERT INTO public.financeiro (agendamento_id, paciente_id, profissional_id, valor, forma_pagamento, status_pagamento)
      VALUES (NEW.id, NEW.paciente_id, NEW.profissional_id, v_valor, NEW.forma_pagamento, 'ABERTO');
    ELSE
      UPDATE public.financeiro
         SET valor = v_valor,
             forma_pagamento = NEW.forma_pagamento
       WHERE agendamento_id = NEW.id
         AND status_pagamento = 'ABERTO'
         AND (valor IS DISTINCT FROM v_valor OR valor = 0);
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
$function$;

REVOKE ALL ON FUNCTION public.on_agendamento_aprovado() FROM PUBLIC, anon, authenticated;

-- Backfill: corrige financeiros com valor zero herdando do agendamento
UPDATE public.financeiro f
   SET valor = a.valor
  FROM public.agendamentos a
 WHERE f.agendamento_id = a.id
   AND COALESCE(f.valor,0) = 0
   AND COALESCE(a.valor,0) > 0;
