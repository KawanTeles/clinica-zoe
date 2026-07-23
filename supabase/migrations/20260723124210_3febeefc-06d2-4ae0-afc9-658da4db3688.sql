
-- Make the approval trigger run with definer privileges so the automatic
-- financeiro INSERT bypasses RLS while remaining scoped to the exact row.
CREATE OR REPLACE FUNCTION public.on_agendamento_aprovado()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.status = 'APROVADO' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'APROVADO') THEN
    IF NOT EXISTS (SELECT 1 FROM public.financeiro f WHERE f.agendamento_id = NEW.id) THEN
      INSERT INTO public.financeiro (agendamento_id, paciente_id, profissional_id, valor, forma_pagamento, status_pagamento)
      VALUES (NEW.id, NEW.paciente_id, NEW.profissional_id, COALESCE(NEW.valor,0), NEW.forma_pagamento, 'ABERTO');
    END IF;
  END IF;

  -- Cancelamento/recusa de um agendamento previamente aprovado cancela o financeiro em aberto
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

-- Restrict execution to the roles that can touch agendamentos.
REVOKE ALL ON FUNCTION public.on_agendamento_aprovado() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.on_agendamento_aprovado() TO authenticated, service_role;
