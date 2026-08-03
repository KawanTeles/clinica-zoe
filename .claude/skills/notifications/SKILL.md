# Skill: notifications

## Objetivo

Garantir que qualquer novo evento do sistema que precise notificar alguém
use a fila e as funções já existentes (`enqueue_notificacao`,
`notificacoes`) em vez de criar um canal de aviso paralelo.

## Quando utilizar

- Ao adicionar um evento de negócio novo que deveria gerar aviso a paciente
  ou equipe.
- Ao alterar templates de mensagem de notificação (aprovação, recusa,
  cancelamento, remarcação, lembrete, pagamento confirmado).
- Ao investigar por que uma notificação não chegou ou chegou duplicada.
- Ao mexer na tela de notificações do usuário (sino/central, se existir na
  UI) ou em `notificacoes_config`.

## Boas práticas

- Toda notificação nasce de `public.enqueue_notificacao(...)`, chamada
  **dentro de triggers SQL**, nunca diretamente do client. Se um evento novo
  precisa notificar alguém, adicione a chamada dentro do trigger relevante
  (ou crie um novo trigger `AFTER INSERT/UPDATE`), não um `insert` em
  `notificacoes` feito pelo React.
- Canal `INTERNO` é marcado como `ENVIADA` imediatamente (é só uma linha na
  tabela, consumida pela própria UI autenticada) — canal `WHATSAPP`/`EMAIL`
  fica `PENDENTE` até um processo externo de envio atualizar o status (hoje
  não há worker de envio automático de WhatsApp real — ver [[whatsapp]]).
- Ao escrever uma nova mensagem de notificação, siga o tom e estrutura já
  usados (saudação com nome, linha em branco, dados do agendamento em
  linhas separadas, chamada para ação final) — ver `on_agendamento_notify`
  como referência de estilo.
- Respeite `notificacoes_config.destinatario_solicitacao`
  (`PROFISSIONAL`/`RECEPCIONISTA`/`AMBOS`/`ADMINISTRADOR`/`TODOS`) ao decidir
  quem recebe aviso de nova solicitação — é configurável pelo ADMIN, não
  hardcoded.
- Lembretes (`gerar_lembretes()`) rodam via `pg_cron` a cada 15 minutos
  (ver `DEPLOYMENT.md` §3.4) e usam uma janela de tempo (`now() >= v_when -
  interval '24 hours' AND now() < v_when`) combinada com um `NOT EXISTS`
  para não duplicar — replique esse padrão de idempotência para qualquer
  novo lembrete agendado.

## Más práticas

- Disparar `toast.success/error` como se fosse a notificação persistente do
  usuário — toast é feedback imediato da própria ação do operador; a fila
  `notificacoes` é o que outro usuário (ex.: o paciente) vê depois.
- Fazer `insert` direto em `notificacoes` pelo client sem passar por
  `enqueue_notificacao` — perde a lógica de "sem usuário + sem canal
  externo com contato = não enfileira" e a marcação automática de `INTERNO`
  como enviado.
- Assumir que marcar `status_envio = 'ENVIADA'` significa que o WhatsApp foi
  de fato entregue — hoje esse campo reflete o estado da fila, não
  confirmação de entrega real da Meta (isso só existiria com a integração
  Cloud API ativa, ver [[whatsapp]]).

## Fluxo recomendado

1. Evento de negócio ocorre (ex.: `UPDATE agendamentos SET status =
   'APROVADO'`).
2. Trigger correspondente (`on_agendamento_notify`, `on_financeiro_notify`,
   ou um novo trigger seguindo o mesmo padrão) monta o texto e chama
   `enqueue_notificacao(usuario_id, titulo, mensagem, evento, canal,
   agendamento_id, telefone, email)` uma vez por canal relevante
   (`INTERNO` sempre que há `usuario_id`; `WHATSAPP` se há telefone).
3. Canal `INTERNO`: a UI lê `notificacoes` filtradas por `usuario_id =
   auth.uid()` (policy `notif_read`).
4. Canal `WHATSAPP`/`EMAIL`: hoje ficam como registro em `PENDENTE` — não
   há envio automático real ainda (ver [[whatsapp]]); um humano usa os links
   `wa.me` como canal efetivo de contato.

## Checklist

- [ ] A notificação nova é enfileirada via `enqueue_notificacao` dentro de
      um trigger, não via `insert` direto do client?
- [ ] O evento novo tem um valor correspondente no enum `notif_evento`
      (ou você adicionou um, via migração)?
- [ ] Testou o caso de paciente sem telefone (não deveria gerar entrada
      `WHATSAPP` órfã)?
- [ ] O texto da mensagem segue o tom/estrutura das mensagens existentes?
- [ ] Se é um lembrete agendado, tem proteção `NOT EXISTS` contra
      duplicação?

## Regras obrigatórias

- Canais válidos: enum `notif_canal` (`WHATSAPP`, `EMAIL`, `INTERNO`).
- Eventos válidos: enum `notif_evento` (`SOLICITACAO_NOVA`,
  `CONSULTA_APROVADA`, `CONSULTA_RECUSADA`, `CONSULTA_CANCELADA`,
  `CONSULTA_REMARCADA`, `LEMBRETE_24H`, `PAGAMENTO_CONFIRMADO`,
  `LEMBRETE_2H`). Adicionar um evento novo exige migração de enum
  (`ALTER TYPE ... ADD VALUE`).
- `enqueue_notificacao` sem `_usuario_id` e sem canal externo com contato
  retorna `NULL` sem inserir nada — respeite esse comportamento ao decidir
  se vale a pena chamar a função em um caminho sem destinatário certo.

## Arquivos normalmente envolvidos

- Funções/triggers SQL: `enqueue_notificacao`, `on_agendamento_notify`,
  `on_financeiro_notify`, `gerar_lembretes`, `notif_config`.
- Tabelas `public.notificacoes`, `public.notificacoes_config`.
- `src/routes/app.configuracoes.tsx` (edição de `notificacoes_config` pelo
  ADMIN, se exposta na UI).

## Erros comuns

- Esquecer que `notif_config()` retorna a **primeira** linha de
  `notificacoes_config` (`ORDER BY created_at LIMIT 1`) — o sistema assume
  configuração única (singleton), não multi-tenant; não crie uma segunda
  linha de config esperando um comportamento diferente.
- Duplicar notificação `WHATSAPP` e `INTERNO` como uma única chamada — a
  função precisa ser chamada uma vez por canal (ver `on_agendamento_notify`,
  que chama `enqueue_notificacao` duas vezes quando há telefone).

## Exemplos

Ver `examples.md`.

## Observações

Ver [[whatsapp]] para o estado real da entrega no canal `WHATSAPP` (hoje
não há worker de envio automático via Cloud API rodando em produção neste
código-fonte).
