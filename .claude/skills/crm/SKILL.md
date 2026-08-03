# Skill: crm

## Objetivo

Orientar mudanças no que hoje funciona como "CRM" do sistema: a central de
solicitações (funil de novos contatos → agendamento aprovado), a página de
contato do site, e o contato direto via WhatsApp com pacientes.

## Estado atual do projeto (importante)

Não existe um módulo de CRM dedicado (sem pipeline de leads, tags, notas de
relacionamento fora do agendamento). O que hoje cumpre esse papel:

- **Central de Solicitações** (`src/routes/app.solicitacoes.tsx`): fila de
  `agendamentos` com `status = 'PENDENTE'` funcionando como funil de
  conversão — é o ponto onde a equipe decide aprovar/recusar um novo
  contato de paciente.
- **Formulário de contato do site** (`src/routes/contato.tsx`): captação
  institucional (não persiste em tabela própria — verifique a implementação
  atual antes de assumir que grava em banco).
- **Contato via WhatsApp** (`src/lib/whatsapp-link.ts`): links `wa.me`
  pré-preenchidos, usados tanto pela clínica para confirmar consultas quanto
  pelo paciente para notificar a clínica de uma nova solicitação.

Trate essas três peças como o "CRM" real do sistema — não desenhe uma nova
funcionalidade assumindo a existência de `leads`, `oportunidades` ou tabelas
de pipeline que não existem no schema.

## Quando utilizar

- Ao alterar a Central de Solicitações (filtros de status, ações de
  aprovar/recusar/cancelar, detalhes do item).
- Ao alterar mensagens/links de WhatsApp enviados a pacientes.
- Ao considerar adicionar um funil de relacionamento mais rico (leads antes
  de virarem agendamento, histórico de contato).

## Boas práticas

- Trate `agendamentos.status = 'PENDENTE'` como o "estágio de entrada" do
  funil — filtros adicionais (`filtroStatus`) na Central de Solicitações
  devem reusar o enum `agendamento_status`, não inventar um status novo só
  para a UI.
- Ao confirmar uma solicitação, ofereça o atalho de WhatsApp
  (`getWhatsAppUrl` + `formatPatientConfirmationMsg`) como o projeto já faz
  no Dashboard e em Solicitações — é o canal de confirmação humana que
  complementa a notificação automática interna.
- Restrinja a visão da Central por papel exatamente como a tela já faz:
  `PROFISSIONAL` (sem outros papéis) só vê solicitações vinculadas ao
  próprio `profissional_id`; `RECEPCIONISTA` e `ADMIN` veem tudo.
- Ao adicionar um motivo de cancelamento/recusa, mantenha o texto em
  `agendamentos.observacoes` ou envie como parte da mensagem de WhatsApp —
  não crie uma tabela nova sem necessidade real comprovada.

## Más práticas

- Implementar um pipeline de "leads" pré-agendamento sem antes confirmar que
  é isso que foi pedido — o sistema atual assume que todo contato relevante
  já nasce como uma tentativa de agendamento (`agendamentos` com
  `PENDENTE`), não como uma entidade separada.
- Automatizar envio de WhatsApp via API server-side assumindo que
  `whatsapp_meta_config` já está integrado — hoje é só link `wa.me`
  client-side (ver [[whatsapp]]).
- Misturar dados de auditoria de usuário (`user_audit_log`) com histórico de
  relacionamento com paciente — são tabelas com propósitos diferentes.

## Fluxo recomendado

1. Paciente solicita consulta (site público) → linha em `agendamentos`
   (`PENDENTE`) → trigger notifica equipe.
2. Equipe abre `app.solicitacoes.tsx`, filtra por status, abre detalhes
   (`detalhesItem`) para decidir.
3. Ação de aprovar/recusar/cancelar → `UPDATE agendamentos SET status = ...`
   → ver [[agenda]] para o que dispara a partir daí (financeiro,
   notificações).
4. Contato humano complementar (opcional) via botão de WhatsApp
   (`openWhatsAppLink(getWhatsAppUrl(...))`).

## Checklist

- [ ] Nova ação de funil usa o enum `agendamento_status` existente?
- [ ] Filtro por papel replicado corretamente (PROFISSIONAL vê só o próprio)?
- [ ] Mensagem de WhatsApp usa os formatadores de `whatsapp-link.ts`, não
      texto solto concatenado na tela?
- [ ] Antes de propor uma tabela nova de "CRM", confirmou que os dados não
      cabem no fluxo de `agendamentos` existente?

## Regras obrigatórias

- Qualquer novo "estágio" de relacionamento com paciente antes de virar
  agendamento precisa de uma decisão de produto explícita — não modele
  isso silenciosamente sobrecarregando `agendamentos.status`.

## Arquivos normalmente envolvidos

- `src/routes/app.solicitacoes.tsx`
- `src/routes/contato.tsx`
- `src/lib/whatsapp-link.ts`

## Erros comuns

- Tratar "Solicitações" como uma tela separada de "Agenda" no nível de
  dado — são a mesma tabela (`agendamentos`) com filtros diferentes de
  status; uma mudança de schema em um precisa considerar o outro.

## Exemplos

Ver `examples.md`.

## Observações

Ver [[agenda]] para o ciclo de vida completo do agendamento e [[whatsapp]]
para os detalhes de geração de mensagens/links.
