# Exemplos — financial

## 1. Valor congelado tem prioridade sobre o valor do lançamento

Repetido em `app.financeiro.tsx` e `app.index.tsx` — mesma função utilitária
local nas duas rotas (candidata a ser extraída para `src/lib/` se um
terceiro lugar precisar dela):

```ts
function valorLancamento(row: any) {
  const valorCongelado = row?.agendamento?.valor;
  return valorCongelado == null ? Number(row?.valor ?? 0) : Number(valorCongelado) || 0;
}
```

## 2. Soma de receita em aberto (dashboard)

`src/routes/app.index.tsx`:

```ts
const finAberto = await supabase
  .from("financeiro")
  .select("valor, agendamento:agendamentos(valor)")
  .eq("status_pagamento", "ABERTO");

const totalAberto = (finAberto.data ?? []).reduce((s, r: any) => s + valorLancamento(r), 0);
```

## 3. Formatação de moeda padrão do projeto

```ts
function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
// ou, em outra tela:
new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(valor)
```

## 4. Trigger que cria o lançamento automaticamente (não replicar no client)

```sql
CREATE FUNCTION public.on_agendamento_aprovado() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.status = 'APROVADO' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'APROVADO') THEN
    IF NOT EXISTS (SELECT 1 FROM public.financeiro f WHERE f.agendamento_id = NEW.id) THEN
      INSERT INTO public.financeiro (agendamento_id, paciente_id, profissional_id, valor, forma_pagamento, status_pagamento)
      VALUES (NEW.id, NEW.paciente_id, NEW.profissional_id, NEW.valor, NEW.forma_pagamento, 'ABERTO');
    END IF;
  END IF;
  -- cancelamento em cascata quando o agendamento é cancelado/recusado
  IF TG_OP = 'UPDATE' AND NEW.status IN ('CANCELADO','RECUSADO') AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE public.financeiro SET status_pagamento = 'CANCELADO'
     WHERE agendamento_id = NEW.id AND status_pagamento = 'ABERTO';
  END IF;
  RETURN NEW;
END;$$;
```
