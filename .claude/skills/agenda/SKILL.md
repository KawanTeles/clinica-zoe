# Skill: agenda

## Objetivo

Orientar mudanças no módulo de agenda: criação/aprovação de agendamentos,
bloqueios de horário, disponibilidade semanal e cálculo de slots livres —
sem contornar as garantias que já existem no banco.

## Quando utilizar

- Ao alterar `src/components/agenda/AgendaView.tsx`, `src/lib/agenda-utils.ts`,
  `src/routes/app.agenda.tsx`, `app.minha-agenda.tsx`, ou o wizard público
  `src/routes/agendamento.tsx`.
- Ao adicionar um novo status de agendamento ou uma nova forma de bloquear
  tempo de um profissional.
- Ao investigar bugs de horário duplicado, slot indisponível que deveria
  estar livre, ou valor incorreto em um agendamento.

## Boas práticas

- Delegue o cálculo de horários livres à função SQL `horarios_disponiveis`
  (via `.rpc()`) em vez de recalcular disponibilidade menos bloqueio menos
  agendamentos existentes no client — o banco já faz isso de forma
  consistente com o trigger de conflito.
- Reaproveite `STATUS_LABEL`/`STATUS_COLOR`/`addMinutes`/`fmtHora`/`todayISO`
  de `src/lib/agenda-utils.ts` em qualquer tela nova que exiba agendamentos
  — não crie um segundo mapa de labels/cores de status.
  atualiza corretamente para saber a duração real esperada, em vez de
  assumir 30 ou 60 minutos fixos.
- Sempre invalide `["agenda"]`, `["dashboard-stats"]` (e `["bloqueios"]`
  quando aplicável) depois de qualquer mutação de agendamento/bloqueio — são
  as `queryKey`s que outras telas (dashboard, badges) dependem para ficar
  atualizadas.
- Ao criar um agendamento a partir do Painel, deixe o banco resolver/validar
  o valor (`resolve_valor_consulta`/`set_agendamento_valor_congelado`) — só
  preencha `valor` manualmente quando o operador precisa de override
  explícito (ex.: desconto).

## Más práticas

- Reimplementar a checagem de sobreposição de horário em JavaScript "para
  dar feedback mais rápido" sem também deixar o trigger validar — o trigger
  já é a validação; um preview client-side é aceitável, mas nunca deve ser a
  única barreira.
- Deixar `hora_fim` ser digitada livremente sem relação com a duração do
  profissional — o padrão do projeto é derivar `hora_fim` de
  `hora_inicio + duracao_consulta_min` (`addMinutes`), e permitir ajuste
  manual depois.
- Ignorar `profissional_bloqueio` ao construir uma nova visão de agenda —
  todo componente de agenda no projeto renderiza bloqueios junto com
  agendamentos (ver `AgendaView`).
- Assumir que todo profissional tem disponibilidade configurada — o próprio
  trigger trata "sem disponibilidade configurada" como "aceita qualquer
  horário" (ver `check_agendamento_conflito`); não adicione uma tela que
  bloqueie a agenda de um profissional sem disponibilidade cadastrada.

## Fluxo recomendado

1. **Criar agendamento** (painel): `AgendaView` → `NovoAgendamentoDialog` →
   `supabase.from("agendamentos").insert(...)` com `status: "PENDENTE"` →
   trigger valida conflito/bloqueio/disponibilidade → trigger congela valor
   → trigger enfileira notificação.
2. **Criar agendamento** (site público): `agendamento.tsx` — usuário
   autenticado (`useAuth`, escopo `client`) percorre wizard (especialidade →
   profissional → data → `rpc("horarios_disponiveis")` → forma de pagamento)
   e insere com os mesmos triggers.
3. **Aprovar/mudar status**: `UPDATE agendamentos SET status = ...` — nunca
   crie um caminho alternativo de "confirmar consulta" que não passe por
   essa coluna, pois todos os triggers de financeiro/notificação escutam
   mudanças em `status`.
4. **Bloquear horário**: `profissional_bloqueio` insert — mesmo trigger de
   conflito consulta essa tabela.
5. **Configurar disponibilidade**: `profissional_disponibilidade` por
   `dia_semana` (0=domingo) — ver `DisponibilidadeCard` em `AgendaView.tsx`.

## Checklist

- [ ] Novo fluxo de criação de agendamento passa por `insert` na tabela
      `agendamentos` (não uma tabela paralela)?
- [ ] `hora_fim` é derivado da duração do profissional, não fixo?
- [ ] `queryKey`s de agenda/dashboard/badges são invalidadas após a
      mutação?
- [ ] Erros do trigger (`error.message`) são exibidos ao usuário via
      `toast.error`, não engolidos?
- [ ] Testado com um profissional **sem** disponibilidade configurada (deve
      aceitar qualquer horário) e um **com** disponibilidade (deve
      restringir)?

## Regras obrigatórias

- Todo agendamento novo entra com `status: "PENDENTE"` a menos que criado
  diretamente pela equipe no Painel (que pode optar por `APROVADO` de
  imediato via `AgendaView`).
- `valor` e `forma_pagamento` de um agendamento aprovado nunca são
  recalculados retroativamente pela UI — são "congelados" no momento da
  aprovação pelo trigger `set_agendamento_valor_congelado`.
- Status válidos são exatamente os do enum `agendamento_status`:
  `PENDENTE`, `APROVADO`, `RECUSADO`, `CANCELADO`, `REMARCADO`,
  `FINALIZADO`. Não introduza um status novo sem migração de enum.

## Arquivos normalmente envolvidos

- `src/components/agenda/AgendaView.tsx`
- `src/lib/agenda-utils.ts`
- `src/routes/app.agenda.tsx`, `app.minha-agenda.tsx`, `agendamento.tsx`,
  `app.solicitacoes.tsx`, `app.index.tsx` (widgets de agenda no dashboard)
- Funções/triggers SQL: `check_agendamento_conflito`,
  `set_agendamento_valor_congelado`, `resolve_valor_consulta`,
  `horarios_disponiveis`, `on_agendamento_aprovado`, `on_agendamento_notify`.

## Erros comuns

- Esquecer que `hora_inicio`/`hora_fim` são `time without time zone` — não
  há timezone armazenado na linha; a comparação com "agora" usa
  `America/Sao_Paulo` explicitamente em `gerar_lembretes()`.
- Comparar `data` como string sem normalizar formato — sempre use `YYYY-MM-DD`
  (`todayISO()` já retorna nesse formato ajustado para o timezone local do
  navegador).
- Esquecer de tratar o erro de conflito lançado pelo trigger como um erro
  "normal" de UI (é comum, não excepcional) — sempre capturado e mostrado
  como toast, nunca deixado estourar como erro não tratado.

## Exemplos

Ver `examples.md`.

## Observações

`app.solicitacoes.tsx` é a fila de triagem (`status = PENDENTE`) e é
funcionalmente parte do mesmo domínio de agenda, mas tratada também como
parte do fluxo de CRM/atendimento — ver [[crm]] para a perspectiva de
funil/atendimento ao paciente sobre os mesmos dados.
