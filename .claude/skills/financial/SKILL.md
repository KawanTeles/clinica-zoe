# Skill: financial

## Objetivo

Garantir que qualquer mudança no módulo financeiro respeite a origem
automática dos lançamentos (criados por trigger na aprovação de um
agendamento) e não introduza uma segunda fonte de verdade para valores.

## Quando utilizar

- Ao alterar `src/routes/app.financeiro.tsx` ou o card de "Receita em
  Aberto" do dashboard (`app.index.tsx`).
- Ao mudar `status_pagamento`, `forma_pagamento` ou `valor` de um lançamento.
- Ao investigar divergência entre o valor mostrado no financeiro e o valor
  do agendamento correspondente.

## Boas práticas

- Trate `public.financeiro` como **derivado** de `public.agendamentos` — a
  UI só cria um lançamento manualmente fora desse fluxo em casos
  excepcionais explícitos (a policy `fin_insert` existe e é restrita a
  ADMIN, mas o caminho padrão é sempre via aprovação de agendamento).
- Ao calcular valor exibido, prefira o valor **congelado no agendamento**
  (`agendamento.valor`) sobre `financeiro.valor` quando ambos existem — é o
  padrão usado em `valorLancamento()` (`app.financeiro.tsx`,
  `app.index.tsx`): `row?.agendamento?.valor ?? row?.valor`. Isso evita
  mostrar um valor diferente do que foi de fato acordado com o paciente.
- Ao marcar um lançamento como `PAGO`, deixe o trigger
  `on_financeiro_notify` cuidar da notificação de confirmação de pagamento —
  não duplique esse aviso manualmente no client.
- Some totais no client com `reduce` sobre os dados já filtrados por RLS —
  não tente somar no banco via `count`/agregação sem necessidade; os
  volumes deste sistema (uma clínica) não justificam otimização prematura,
  e o padrão atual (buscar linhas + `reduce` em JS) é intencionalmente
  simples.
- Formate valores sempre com `Intl.NumberFormat("pt-BR", { style:
  "currency", currency: "BRL" })` (ou o helper `brl()` já definido na
  própria rota) — não formate moeda manualmente com `toFixed(2)` e prefixo
  `"R$ "` solto (inconsistente com separador de milhar).

## Más práticas

- Fazer `insert` direto em `financeiro` a partir de um fluxo de aprovação
  de agendamento no client — isso já é feito pelo trigger
  `on_agendamento_aprovado`; um insert manual duplicado vai colidir com a
  checagem `NOT EXISTS` do trigger ou criar inconsistência.
- Permitir edição de `valor` em um lançamento `PAGO` — trate lançamentos
  pagos como fechados; se precisar corrigir, o padrão seguro é cancelar
  (`status_pagamento = 'CANCELADO'`) e gerar um ajuste, nunca sobrescrever
  silenciosamente um valor já recebido.
- Confiar apenas em `financeiro.valor` para relatórios sem considerar que
  `agendamento.valor` é a fonte "congelada" mais confiável (ver
  `valorLancamento`).

## Fluxo recomendado

1. Agendamento é aprovado → trigger `on_agendamento_aprovado` cria/atualiza
   `financeiro` (status `ABERTO`).
2. Recepção/ADMIN registra o pagamento em `app.financeiro.tsx` → `UPDATE
   financeiro SET status_pagamento = 'PAGO', pago_em = now(), forma_pagamento
   = ...`.
3. Trigger `on_financeiro_notify` dispara notificação de confirmação ao
   paciente (`INTERNO` + `WHATSAPP` se houver telefone).
4. Se o agendamento for cancelado/recusado depois de aprovado, o trigger
   `on_agendamento_aprovado` também cancela o `financeiro` correspondente
   (`status_pagamento = 'CANCELADO'`) automaticamente — a UI não precisa
   sincronizar isso manualmente.

## Checklist

- [ ] O lançamento sendo exibido/editado veio do fluxo padrão (aprovação de
      agendamento), ou é um caso excepcional que precisa de revisão de
      política RLS?
- [ ] Valor exibido usa a prioridade `agendamento.valor ?? financeiro.valor`?
- [ ] Formatação de moeda usa `Intl.NumberFormat("pt-BR", ...)`?
- [ ] Mudança de status para `PAGO` deixa o trigger de notificação agir
      sozinho (não duplica toast/mensagem manual para o paciente)?
- [ ] Totais somados respeitam o filtro de papel (ex.: PROFISSIONAL só soma
      o que a policy `fin_read` já retorna para ele)?

## Regras obrigatórias

- `status_pagamento` segue estritamente o enum `financeiro_status`:
  `ABERTO`, `PAGO`, `CANCELADO`.
- `forma_pagamento` segue o enum `forma_pagamento`: `DINHEIRO`, `PIX`,
  `CARTAO_DEBITO`, `CARTAO_CREDITO`, `OUTRO`.
- `PROFISSIONAL` só enxerga financeiro dos próprios atendimentos (policy
  `fin_read`, via `profissionais.user_id = auth.uid()`) — nenhuma tela nova
  deve tentar mostrar financeiro consolidado da clínica para esse papel.

## Arquivos normalmente envolvidos

- `src/routes/app.financeiro.tsx`
- `src/routes/app.index.tsx` (card "Receita em Aberto")
- Tabela `public.financeiro`, triggers `on_agendamento_aprovado`,
  `on_financeiro_notify`, função `resolve_valor_consulta`.

## Erros comuns

- Formatar valores negativos ou `null` sem tratamento — `financeiro.valor`
  tem `DEFAULT 0 NOT NULL`, mas leituras via `agendamento.valor` podem
  vir `null` de agendamentos antigos; sempre `Number(x) || 0` como fallback
  final (ver `valorLancamento`).
- Esquecer que `pago_em` só é preenchido quando `status_pagamento = 'PAGO'`
  — não assuma que existe para lançamentos `ABERTO`.

## Exemplos

Ver `examples.md`.

## Observações

Para uma evolução ampla do módulo (dashboard tipo ERP, contas a pagar,
comissões, relatórios), ver [[financial-architect]] — que define o modo de
trabalho para esse tipo de tarefa, sempre subordinado às regras desta
skill.

Não há hoje exportação de relatório financeiro (CSV/PDF) nem integração com
gateway de pagamento — todo o controle é manual pela equipe, registrando o
que foi efetivamente recebido.
