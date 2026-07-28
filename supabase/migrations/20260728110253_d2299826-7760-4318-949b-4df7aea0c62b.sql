
CREATE OR REPLACE FUNCTION public.on_financeiro_notify()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_pac_user uuid; v_pac_nome text; v_pac_tel text; v_pac_email text; v_valor text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.status_pagamento = 'PAGO' AND OLD.status_pagamento IS DISTINCT FROM 'PAGO' THEN
    SELECT pa.user_id, pa.nome, COALESCE(NULLIF(pa.whatsapp,''), pa.telefone), pa.email
      INTO v_pac_user, v_pac_nome, v_pac_tel, v_pac_email
      FROM public.pacientes pa WHERE pa.id = NEW.paciente_id;

    v_valor := translate(to_char(NEW.valor, 'FM999G999D00'), '.,', ',.');

    PERFORM public.enqueue_notificacao(
      v_pac_user,'Pagamento confirmado',
      'Recebemos o pagamento de R$ ' || v_valor || '. Obrigado!',
      'PAGAMENTO_CONFIRMADO','INTERNO', NEW.agendamento_id, v_pac_tel, v_pac_email
    );

    IF v_pac_tel IS NOT NULL THEN
      PERFORM public.enqueue_notificacao(
        v_pac_user,'Pagamento confirmado (WhatsApp)',
        'Recebemos o pagamento de R$ ' || v_valor || '. Obrigado!',
        'PAGAMENTO_CONFIRMADO','WHATSAPP', NEW.agendamento_id, v_pac_tel, v_pac_email
      );
    END IF;
  END IF;
  RETURN NEW;
END;$function$;

DELETE FROM public.notificacoes WHERE agendamento_id IN (SELECT id FROM public.agendamentos WHERE observacoes = '__homolog2');
DELETE FROM public.financeiro WHERE agendamento_id IN (SELECT id FROM public.agendamentos WHERE observacoes = '__homolog2');
DELETE FROM public.agendamentos WHERE observacoes = '__homolog2';
