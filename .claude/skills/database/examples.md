# Exemplos — database

## 1. Função `SECURITY DEFINER` com `search_path` protegido

```sql
CREATE FUNCTION public.has_role(_user_id uuid, _role public.app_role) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
```

Toda função nova que precisa ler além do escopo do chamador (ex.: checar
papel de outro usuário) segue exatamente esse molde.

## 2. Trigger de regra de negócio atômica (conflito de agenda)

```sql
CREATE FUNCTION public.check_agendamento_conflito() RETURNS trigger
    LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE dow SMALLINT;
BEGIN
  IF NEW.status IN ('PENDENTE','APROVADO','REMARCADO') THEN
    IF EXISTS (
      SELECT 1 FROM public.agendamentos a
      WHERE a.profissional_id = NEW.profissional_id AND a.data = NEW.data
        AND a.id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
        AND a.status IN ('PENDENTE','APROVADO','REMARCADO')
        AND (NEW.hora_inicio, NEW.hora_fim) OVERLAPS (a.hora_inicio, a.hora_fim)
    ) THEN
      RAISE EXCEPTION 'Conflito de horário: já existe um agendamento neste intervalo.';
    END IF;
    -- ... checagem de bloqueio e disponibilidade
  END IF;
  RETURN NEW;
END;$$;

CREATE TRIGGER trg_check_agendamento_conflito
  BEFORE INSERT OR UPDATE ON public.agendamentos
  FOR EACH ROW EXECUTE FUNCTION public.check_agendamento_conflito();
```

A mensagem de `RAISE EXCEPTION` é o texto que chega em `error.message` no
client — por isso é escrita em português amigável, não um código genérico.

## 3. Encadeamento trigger → trigger (aprovação gera financeiro)

```sql
CREATE FUNCTION public.on_agendamento_aprovado() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_valor numeric(10,2);
BEGIN
  IF NEW.status = 'APROVADO' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'APROVADO') THEN
    v_valor := COALESCE(NEW.valor, 0);
    IF v_valor <= 0 THEN
      RAISE EXCEPTION 'Agendamento sem valor congelado. Defina o valor antes de aprovar.';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.financeiro f WHERE f.agendamento_id = NEW.id) THEN
      INSERT INTO public.financeiro (agendamento_id, paciente_id, profissional_id, valor, forma_pagamento, status_pagamento)
      VALUES (NEW.id, NEW.paciente_id, NEW.profissional_id, v_valor, NEW.forma_pagamento, 'ABERTO');
    END IF;
  END IF;
  RETURN NEW;
END;$$;
```

Um `UPDATE agendamentos SET status = 'APROVADO'` feito pelo client (ver
`AgendaView.tsx`, `statusMut`) dispara isso automaticamente — a UI nunca
faz `insert into financeiro` diretamente para esse caso.

## 4. Normalização de telefone via trigger `BEFORE`

```sql
CREATE TRIGGER trg_pacientes_norm_whatsapp
  BEFORE INSERT OR UPDATE OF whatsapp ON public.pacientes
  FOR EACH ROW EXECUTE FUNCTION public.trg_normalizar_whatsapp();
```

Qualquer coluna nova de telefone que deva virar E.164 automaticamente segue
este padrão: `BEFORE INSERT OR UPDATE OF <coluna>` + `trg_normalizar_whatsapp()`.

## 5. View pública restrita a colunas/linhas seguras

```sql
CREATE VIEW public.profissionais_public WITH (security_invoker='true') AS
 SELECT id, nome, foto_url, descricao, formacao, anos_experiencia,
        registro_profissional, duracao_consulta_min,
        valor_consulta_avista, valor_consulta_cartao, especialidade_id, status, created_at
   FROM public.profissionais
  WHERE status = 'ATIVO'::public.profissional_status;
```

Usada pelo wizard de agendamento (`agendamento.tsx`) para expor só os campos
necessários a visitantes anônimos, sem vazar `email`/`telefone` interno do
profissional.
