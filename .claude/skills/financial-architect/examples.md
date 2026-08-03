# Exemplos — financial-architect

## 1. Ponto de partida real: o que hoje vive em um único arquivo de rota

`src/routes/app.financeiro.tsx` hoje concentra query, filtros, formatação e
tabela em um só componente de página (ver [[financial]]/examples.md para o
trecho de `valorLancamento`). Uma evolução "financial-architect" começa
extraindo peças, não reescrevendo do zero:

```
src/components/financeiro/         <- pasta já existe no projeto, vazia
├── ResumoFinanceiroCards.tsx       <- os StatCard de receita/aberto/pago
├── FiltrosFinanceiro.tsx           <- período, status, forma de pagamento
├── TabelaLancamentos.tsx           <- lista com paginação
└── LancamentoStatusBadge.tsx       <- badge reaproveitando STATUS_COLOR local
```

Cada componente recebe dados via props (padrão já usado em `AgendaView`,
ver [[clinic-architecture]]) — não recria sua própria query interna a menos
que seja genuinamente independente do resto da tela.

## 2. Hook de agregação seguindo o padrão de `useSidebarBadges`

```ts
// src/lib/financeiro-resumo.ts (novo, seguindo o padrão de hooks de src/lib)
export function useFinanceiroResumo(periodo: { inicio: string; fim: string }) {
  const { session, ready, roles } = useAuth();
  return useQuery({
    queryKey: ["financeiro-resumo", periodo.inicio, periodo.fim, session?.user?.id],
    enabled: ready && !!session,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financeiro")
        .select("valor, status_pagamento, pago_em, agendamento:agendamentos(valor)")
        .gte("pago_em", periodo.inicio)
        .lte("pago_em", periodo.fim);
      if (error) throw error;
      // reduce local, mesmo padrão de valorLancamento() já usado no projeto
    },
  });
}
```

Isso segue exatamente a mesma forma de `useSidebarBadges`
(`src/lib/sidebar-badges.ts`) — `enabled: ready && !!session`, `queryKey`
granular — em vez de inventar um padrão novo de data-fetching.

## 3. Esboço de referência para "despesas" (NÃO implementado — rascunho)

Como em [[medical-records]], este é um esboço de como a tabela **poderia**
ser criada seguindo os padrões do projeto, não código existente:

```sql
-- ESBOÇO — não aplicado no projeto ainda
CREATE TABLE public.despesas (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  categoria text NOT NULL,
  descricao text NOT NULL,
  valor numeric(10,2) NOT NULL,
  status_pagamento public.financeiro_status NOT NULL DEFAULT 'ABERTO', -- reaproveita o enum existente
  vencimento date,
  pago_em timestamptz,
  criado_por uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;

CREATE POLICY despesas_admin_all ON public.despesas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'ADMIN'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'ADMIN'::public.app_role));

CREATE TRIGGER trg_despesas_updated
  BEFORE UPDATE ON public.despesas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
```

Note que o enum `financeiro_status` já existente (`ABERTO`/`PAGO`/
`CANCELADO`) é reaproveitado em vez de criar um enum paralelo — segue a
regra de [[database]] de preferir estender/reaproveitar a duplicar.

## 4. Bloqueio de edição de lançamento pago (regra de segurança nova, em SQL)

Esboço de como a regra "nunca editar lançamento pago" (hoje só uma
convenção de UI) viraria uma garantia atômica, seguindo o estilo dos
triggers existentes:

```sql
-- ESBOÇO — não aplicado no projeto ainda
CREATE FUNCTION public.bloquear_edicao_financeiro_pago() RETURNS trigger
    LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF OLD.status_pagamento = 'PAGO' AND NEW.valor IS DISTINCT FROM OLD.valor THEN
    RAISE EXCEPTION 'Lançamento já pago não pode ter o valor alterado diretamente.';
  END IF;
  RETURN NEW;
END;$$;

CREATE TRIGGER trg_bloquear_edicao_financeiro_pago
  BEFORE UPDATE ON public.financeiro
  FOR EACH ROW EXECUTE FUNCTION public.bloquear_edicao_financeiro_pago();
```

Isso move a regra de "convenção esperada da UI" (frágil) para "garantia do
banco" (o mesmo espírito de `check_agendamento_conflito` em [[agenda]]).
