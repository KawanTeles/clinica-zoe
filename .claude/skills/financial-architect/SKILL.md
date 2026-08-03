# Skill: financial-architect

## Objetivo

Evoluir o módulo Financeiro da Clínica Zoe em direção a um sistema de nível
ERP profissional (dashboard rico, contas a pagar/receber, fluxo de caixa,
comissões, relatórios) **sem** romper a arquitetura, as regras de negócio no
banco ou os invariantes de segurança já estabelecidos no restante do
projeto.

Esta skill **nunca substitui** [[financial]] — ela é uma camada de evolução
por cima dela. Toda regra, checklist e "más práticas" de [[financial]]
continua valendo; `financial-architect` adiciona o padrão de trabalho para
quando a tarefa é "levar o Financeiro a um nível profissional", não para
alterações pontuais do dia a dia (essas continuam guiadas só por
[[financial]]).

## Estado atual do projeto (ler antes de propor qualquer coisa)

O Financeiro hoje é deliberadamente simples — uma única tabela derivada,
sem os módulos de ERP completo. Antes de implementar qualquer item desta
skill, confirme o que já existe de fato:

- **Existe hoje**: tabela `public.financeiro` (`agendamento_id`,
  `paciente_id`, `profissional_id`, `valor`, `status_pagamento`
  `ABERTO`/`PAGO`/`CANCELADO`, `forma_pagamento`, `pago_em`), criada e
  mantida automaticamente pelos triggers `on_agendamento_aprovado`/
  `on_financeiro_notify` (ver [[database]], [[agenda]]), uma tela única
  (`src/routes/app.financeiro.tsx`) e um card de "Receita em Aberto" no
  Dashboard (`app.index.tsx`).
- **Não existe hoje** (não invente caminho de arquivo/tabela para nenhum
  destes até confirmar que foi criado): contas a pagar, despesas,
  categorias financeiras, centro de custo, parcelamento, pagamento parcial,
  desconto/juros/multa como campos estruturados, comissão de profissional,
  anexos de comprovante, exportação/relatórios, caixa diário, RLS de
  auditoria financeira dedicada.
- Qualquer item da seção "Funcionalidades" abaixo que não estiver nesta
  lista de "existe hoje" é trabalho novo — trate como tal (nova migração,
  nova tela, nova skill de exemplos), nunca como algo a "conectar" em código
  que já existe.

## Princípios

Antes de implementar qualquer funcionalidade nova no Financeiro:

1. Ler [[financial]] e o código atual completo (`app.financeiro.tsx`,
   `app.index.tsx`, triggers `on_agendamento_aprovado`/`on_financeiro_notify`
   em `supabase/portable/02_schema_public.sql`).
2. Entender a arquitetura existente (financeiro é **derivado** de
   `agendamentos`, nunca a fonte primária de verdade do valor — ver
   `valorLancamento()` em [[financial]]/examples.md).
3. Identificar problemas reais de UX, código duplicado, queries lentas e
   componentes reutilizáveis **no código atual**, não hipoteticamente.
4. Identificar oportunidades de melhoria compatíveis com o modelo
   RLS-first do projeto (ver [[permissions]]).

Nunca implementar uma funcionalidade nova sem antes descrever, em uma frase,
como ela se encaixa no fluxo trigger-driven já existente
(`agendamento aprovado → financeiro criado → pagamento registrado →
notificação`).

## Arquitetura

Sempre manter, seguindo os padrões já estabelecidos no restante do projeto
(ver [[react]], [[typescript]], [[supabase]]):

- **Single Source of Truth**: o valor "oficial" de um lançamento continua
  sendo o valor congelado no agendamento (`agendamento.valor`), com
  `financeiro.valor` como espelho — não crie uma terceira fonte de verdade
  para o mesmo valor.
- **Componentização**: extraia peças reutilizáveis de `app.financeiro.tsx`
  (cards de KPI, tabela de lançamentos, filtros) para
  `src/components/financeiro/` em vez de fazer crescer um único arquivo de
  rota — a pasta `src/components/financeiro/` já existe no projeto, hoje
  vazia, exatamente para isso.
- **Hooks reutilizáveis**: extraia queries repetidas (ex.: "totais do mês",
  "receita por profissional") para hooks em `src/lib/` com prefixo `use`,
  seguindo o padrão de `useSidebarBadges`/`useClinicSettings` (ver
  `CLAUDE.md` §8).
- **Services separados**: lógica de agregação/relatório que não é uma
  simples query de tela vai para um par `financeiro-relatorios.functions.ts`
  / `.server.ts` se precisar de `service_role` ou processamento pesado —
  siga exatamente o contrato descrito em [[supabase]]; nunca importe
  `supabaseAdmin` fora de um `*.server.ts`.
- **Tipagem forte**: novas tabelas/colunas entram em
  `src/integrations/supabase/types.ts` (regenerado do schema); evite `any`
  fora dos casos já tolerados em [[typescript]].
- **Queries enxutas**: contagens e somatórios seguem o padrão de
  [[performance]] (`head: true` para contagem, `select` só das colunas
  necessárias).

Nunca duplicar lógica de cálculo de valor/status que já existe como trigger
SQL — se uma regra nova precisa ser atômica e não contornável (ex.: cálculo
de comissão), ela vira função/trigger SQL, seguindo [[database]].

## Interface

Buscar uma interface no espírito de ERPs modernos, mas **dentro** do design
system já existente — nunca introduzindo uma paleta ou biblioteca de UI
paralela:

- Dashboard financeiro rico usando `Card`/`CardHeader`/`CardContent` de
  `src/components/ui/` e os tokens de `src/styles.css` (ver [[ui-design]]).
- KPIs com o mesmo padrão visual de `StatCard` já usado no Dashboard geral
  (`app.index.tsx`) — reaproveite ou generalize esse componente em vez de
  criar um novo do zero.
- Gráficos: o projeto já tem `recharts` como dependência
  (`package.json`) e `src/components/ui/chart.tsx` (wrapper shadcn/ui) —
  use-os antes de considerar uma lib de gráficos nova.
- Fluxo intuitivo, poucos cliques, responsivo, funcionando em claro e
  escuro (checklist de [[ui-design]] se aplica integralmente aqui).

## Dashboard financeiro — avaliar a necessidade de cada item

Nenhum destes existe hoje além de "Receita em Aberto" (soma simples). Ao
propor um indicador novo, avalie se o dado de origem já existe antes de
prometer o indicador:

| Indicador | Dado de origem hoje | Precisa de quê |
| --- | --- | --- |
| Receita (período) | `financeiro.valor`/`agendamento.valor`, `PAGO` | Só query nova |
| Fluxo de caixa | `financeiro.pago_em` | Só query nova (agrupar por data) |
| Contas a Receber (`ABERTO`) | `financeiro.status_pagamento` | Só query nova |
| Ticket médio | `financeiro.valor` | Só query nova (média) |
| Receita por Profissional/Especialidade | `financeiro` + `profissionais`/`especialidades` | Só query nova (join) |
| Despesa / Lucro | — | **Tabela nova** (não existe registro de despesa) |
| Inadimplência | — | Definição de negócio ainda não modelada (quando um `ABERTO` vira "inadimplente"?) |
| Comissão por profissional | — | **Tabela/regra nova** (percentual não existe no cadastro de profissional) |
| Comparativos/gráficos | Dados acima | Componente de UI (`recharts`) |

## Funcionalidades — verificar o que existe antes de prometer

Nenhum dos itens abaixo tem tabela/tela hoje, exceto onde indicado. Trate
cada um como uma feature nova completa (migração + RLS + tela), nunca como
"ativar algo que já existe":

- Contas a pagar / despesas — **não existe**.
- Fluxo de caixa / caixa diário — **não existe como tela**; dado-fonte
  parcial existe (`financeiro.pago_em`).
- Categorias / centro de custo — **não existe**.
- Parcelamentos / pagamentos parciais — **não existe** (`financeiro` é
  1 linha = 1 valor total, sem relação de parcelas).
- Desconto / juros / multa — **não existem como campos estruturados**
  (só o `valor` final).
- Comissões — **não existe**.
- Relatórios / exportação — **não existe**.
- Auditoria financeira dedicada — **não existe uma tabela específica**;
  existe `user_audit_log` (genérica, para ações administrativas de
  usuário — ver [[permissions]]), que pode ser o padrão a seguir mas não
  cobre hoje edição de lançamento financeiro.
- Anexos / observações de lançamento — **não existe** (`financeiro` não
  tem campo de texto livre nem de arquivo).

## Banco de dados

Ao criar qualquer peça nova desta lista, siga [[database]] à risca:

- Nova tabela → `ENABLE ROW LEVEL SECURITY` + policies desde o primeiro
  commit, seguindo o mesmo padrão de `fin_read`/`fin_update` (ADMIN sempre;
  `PROFISSIONAL` só o que é seu via `profissionais.user_id = auth.uid()`).
- Índices/constraints/triggers/views/funções SQL para qualquer regra
  atômica nova (ex.: cálculo de comissão, bloqueio de edição de lançamento
  pago) — nunca reimplementada só em TypeScript.
- Migração em `supabase/migrations/` **e** reflexo em
  `supabase/portable/02_schema_public.sql` — não deixe os dois divergirem
  (ver [[database]]).
- Jamais alterar uma tabela existente (`financeiro`, `agendamentos`) sem
  avaliar o impacto nos triggers que já dependem dela
  (`on_agendamento_aprovado`, `on_financeiro_notify`,
  `set_agendamento_valor_congelado`).

## Performance

Aplicar [[performance]] integralmente, com atenção extra a relatórios
financeiros (tendem a agregar muitas linhas):

- Evitar N+1 ao juntar `financeiro` com `profissionais`/`especialidades`
  para relatórios — um `select` com relação aninhada, não um loop de
  queries.
- Agregações pesadas (receita por período longo, comparativos ano a ano)
  são candidatas a uma função SQL (`STABLE`, possivelmente `SECURITY
  DEFINER` se precisar agregar além do escopo RLS do chamador) em vez de
  trazer todas as linhas para agregar em JavaScript.
- Componentes de dashboard financeiro grandes devem ser divididos (um card
  = um componente, uma `queryKey` própria) para evitar re-render em
  cascata do dashboard inteiro a cada mudança de filtro.

## UX

Aplicar o checklist de [[ui-design]]/[[react]]: filtros, busca, paginação,
ordenação, skeleton/loading, feedback visual de mutação (`toast`),
confirmação (`AlertDialog`) antes de qualquer ação irreversível, empty
state no padrão já usado (`app.pacientes.tsx`), estado de erro tratado.

## Segurança

Além de tudo que já está em [[security]] e [[financial]] (más práticas:
nunca editar lançamento pago sem trilha, nunca recalcular valor no client
por fora do congelamento):

- Nunca permitir excluir histórico financeiro — qualquer "remoção" é soft
  (ex.: `status_pagamento = 'CANCELADO'`), nunca `DELETE` físico de linha
  com `pago_em` preenchido.
- Nunca permitir bypass de RLS para acelerar um relatório — se um relatório
  precisa agregar além do que a policy do usuário permitiria, isso é uma
  decisão de produto explícita (quem pode ver o relatório?), resolvida com
  uma policy/role nova, não com `supabaseAdmin` chamado de um caminho
  client-facing.
- Mudança manual de um valor que se originou de um agendamento exige
  registro de auditoria (seguindo o padrão de `registrarAuditoria` em
  [[security]]) — não existe hoje; é pré-requisito para permitir edição
  manual de `financeiro.valor`.
- Nunca duplicar lançamento — qualquer tela nova de "novo lançamento
  manual" precisa checar `NOT EXISTS` por `agendamento_id`, do mesmo jeito
  que o trigger `on_agendamento_aprovado` já faz.

## Qualidade

Antes de considerar qualquer entrega desta skill concluída:

- [ ] `npm run build` e `npm run lint` passam sem novos erros.
- [ ] TypeScript sem `any` novo fora dos casos já tolerados em
      [[typescript]].
- [ ] Testado manualmente como `PROFISSIONAL` (visão restrita ao próprio
      financeiro) e não só como `ADMIN` — ver [[permissions]].
- [ ] Responsivo e testado em claro/escuro.
- [ ] Sem código morto/duplicado introduzido (componentes extraídos, não
      copiados).
- [ ] Nenhuma regra de negócio nova duplicada entre client e banco — a
      atômica vive no banco.

## Regra obrigatória

Sempre consultar [[financial]] antes de modificar qualquer comportamento
financeiro existente. A arquitetura e as regras de negócio já implementadas
(trigger-driven, valor congelado, soft status) têm prioridade absoluta.

**Primeiro preservar. Depois evoluir.**

Qualquer proposta desta skill que exigisse revogar uma regra de
[[financial]] (ex.: "deixar editar valor de lançamento pago diretamente")
precisa ser sinalizada explicitamente como uma mudança de arquitetura, não
aplicada silenciosamente.

## Arquivos normalmente envolvidos

- `src/routes/app.financeiro.tsx`, `src/routes/app.index.tsx`
- `src/components/financeiro/` (pasta existente, hoje vazia — destino
  natural dos componentes extraídos)
- `supabase/migrations/`, `supabase/portable/02_schema_public.sql`
  (qualquer tabela/função nova)
- `src/integrations/supabase/types.ts`

## Erros comuns

- Prometer um indicador (ex.: "inadimplência", "comissão") sem antes
  definir a regra de negócio por trás dele — esses conceitos não têm
  definição no schema atual; implementar sem alinhar a regra gera retrabalho.
- Tratar a tabela `financeiro` como se já suportasse parcelamento (ela é
  1:1 com `agendamento_id` hoje).
- Construir um relatório pesado como query solta no client em vez de
  função SQL agregadora, degradando performance à medida que o histórico
  cresce.

## Exemplos

Ver `examples.md`.

## Observações

Esta skill é um **modo de trabalho** (como abordar uma evolução grande do
Financeiro), não uma lista de funcionalidades já prontas para usar. Trate a
tabela da seção "Dashboard financeiro" e a lista da seção "Funcionalidades"
como backlog priorizável, não como inventário do sistema atual.
