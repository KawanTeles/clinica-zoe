# Exemplos — notifications

## 1. Enfileirando notificação em dois canais a partir de um trigger

`on_agendamento_notify()` (trecho, ao aprovar consulta):

```sql
v_msg := 'Olá, ' || COALESCE(v_pac_nome,'paciente') || '.' || chr(10) || chr(10) ||
         'Sua consulta foi CONFIRMADA.' || chr(10) || chr(10) ||
         'Profissional: ' || COALESCE(v_prof_nome,'—') || chr(10) ||
         'Data: ' || v_data_str || chr(10) ||
         'Horário: ' || v_hora_str;

PERFORM public.enqueue_notificacao(v_pac_user,'Consulta confirmada', v_msg,
  'CONSULTA_APROVADA','INTERNO', NEW.id, v_pac_tel, v_pac_email);

IF v_pac_tel IS NOT NULL THEN
  PERFORM public.enqueue_notificacao(v_pac_user,'Consulta confirmada', v_msg,
    'CONSULTA_APROVADA','WHATSAPP', NEW.id, v_pac_tel, v_pac_email);
END IF;
```

Duas chamadas — uma por canal — usando a mesma mensagem-base.

## 2. Função central que decide se vale a pena enfileirar

```sql
CREATE FUNCTION public.enqueue_notificacao(
  _usuario_id uuid, _titulo text, _mensagem text, _evento notif_evento,
  _canal notif_canal DEFAULT 'INTERNO', _agendamento_id uuid DEFAULT NULL,
  _telefone text DEFAULT NULL, _email text DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_id uuid;
BEGIN
  IF _usuario_id IS NULL AND (_canal = 'INTERNO' OR (_telefone IS NULL AND _email IS NULL)) THEN
    RETURN NULL; -- nada a fazer: sem destinatário utilizável
  END IF;

  INSERT INTO public.notificacoes (usuario_id, titulo, mensagem, tipo, evento, canal,
    agendamento_id, destinatario_telefone, destinatario_email, status_envio)
  VALUES (_usuario_id, _titulo, _mensagem, 'INFO', _evento, _canal,
    _agendamento_id, _telefone, _email,
    CASE WHEN _canal = 'INTERNO' THEN 'ENVIADA'::notif_status_envio ELSE 'PENDENTE'::notif_status_envio END)
  RETURNING id INTO v_id;

  IF _canal = 'INTERNO' THEN
    UPDATE public.notificacoes SET enviado_em = now() WHERE id = v_id;
  END IF;

  RETURN v_id;
END;$$;
```

## 3. Lembrete agendado idempotente (`pg_cron` a cada 15min)

```sql
IF COALESCE(cfg.lembrete_24h_ativo, true)
   AND now() >= v_when - interval '24 hours' AND now() < v_when
   AND NOT EXISTS (
     SELECT 1 FROM public.notificacoes n
      WHERE n.agendamento_id = a.id AND n.evento = 'LEMBRETE_24H'
   ) THEN
  -- ... monta v_msg e chama enqueue_notificacao
END IF;
```

O `NOT EXISTS` é o que garante que, mesmo rodando a cada 15 minutos, o mesmo
lembrete não é enviado duas vezes para o mesmo agendamento.

## 4. Configuração de quem recebe aviso de nova solicitação

```sql
SELECT COALESCE(destinatario_solicitacao,'PROFISSIONAL') INTO v_dest FROM public.notif_config();

v_roles := CASE v_dest
  WHEN 'RECEPCIONISTA'  THEN ARRAY['RECEPCIONISTA']::public.app_role[]
  WHEN 'AMBOS'          THEN ARRAY['RECEPCIONISTA']::public.app_role[]
  WHEN 'ADMINISTRADOR'  THEN ARRAY['ADMIN']::public.app_role[]
  WHEN 'TODOS'          THEN ARRAY['RECEPCIONISTA','ADMIN']::public.app_role[]
  ELSE ARRAY[]::public.app_role[]
END;
```

Isso é lido de `notificacoes_config`, editável pelo ADMIN — nunca hardcode
"quem recebe" em uma nova regra sem checar essa configuração primeiro.
