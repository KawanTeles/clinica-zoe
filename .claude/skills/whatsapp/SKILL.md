# Skill: whatsapp

## Objetivo

Deixar claro o que a integração de WhatsApp **realmente faz hoje**
(links `wa.me` client-side) versus o que existe apenas como **schema
preparatório** (WhatsApp Cloud API via Meta), para não implementar ou
documentar uma funcionalidade como "ativa" quando não está.

## Estado atual do projeto (importante)

### O que funciona em produção hoje

- `src/lib/whatsapp-link.ts` gera links `https://wa.me/<telefone>?text=...`
  — abrem o WhatsApp do próprio operador/paciente com uma mensagem
  pré-preenchida. Não há envio automático, é sempre uma ação humana
  (clicar no botão/link).
- Usado em: confirmação de agendamento pela equipe
  (`formatPatientConfirmationMsg`), aviso da clínica pelo próprio paciente
  ao concluir o wizard de agendamento (`getClinicWhatsAppNotificationUrl`),
  botão de contato rápido na Central de Solicitações e no Dashboard.
- Número oficial da clínica está hardcoded em
  `CLINIC_WHATSAPP_NUMBER = "5582998343617"` (`whatsapp-link.ts`) — se a
  clínica trocar de número, esse é o lugar a atualizar (idealmente migrar
  para `configuracoes_clinica.whatsapp`, que já existe na tabela mas não é
  a fonte usada por essa constante hoje).

### O que existe só como schema (não implementado)

As tabelas abaixo existem em `supabase/portable/02_schema_public.sql` mas
**não têm rota server-side ou worker consumindo-as** no código atual:

- `whatsapp_meta_config` — credenciais da WhatsApp Cloud API
  (`access_token`, `phone_number_id`, `business_account_id`, `app_secret`,
  `verify_token`, `graph_version`).
- `whatsapp_templates` / `whatsapp_evento_templates` — templates aprovados
  pela Meta e seu mapeamento por evento.
- `whatsapp_message_logs` — log de mensagens enviadas via API.
- `whatsapp_queue` — fila simples de envio (`wa_status`:
  `PENDENTE`/`ENVIADO`/`FALHOU`).
- `whatsapp_sessions` — controle de janela de 24h de conversa (regra da
  Meta para mensagens fora de template).

`README.md`/`DEPLOYMENT.md` mencionam um endpoint
`/api/public/test-whatsapp` e um webhook da Meta — **essas rotas não
existem em `src/routes/` no código-fonte atual**. Trate a documentação
externa como "visão de produto"/roadmap, não como estado atual do código, e
não referencie esse endpoint como algo que já funciona.

## Quando utilizar

- Ao adicionar/alterar qualquer botão ou mensagem de WhatsApp na UI.
- Ao ser solicitado a "automatizar o envio de WhatsApp" — antes de
  implementar, confirme explicitamente com quem pediu se o objetivo é (a)
  continuar no modelo de link manual (`wa.me`), ou (b) construir a
  integração real com a Cloud API a partir do schema já existente.

## Boas práticas

- Para qualquer novo ponto de contato via WhatsApp na UI, reuse
  `getWhatsAppUrl`/`openWhatsAppLink`/`sanitizePhone` de `whatsapp-link.ts`
  — não construa a URL `wa.me` manualmente em um componente novo.
- Ao formatar uma nova mensagem, siga o estilo já usado: `*negrito*` do
  WhatsApp para destacar campos, blocos separados por linha em branco,
  `formatDateBR` para data em `DD/MM/AAAA`.
- Se for implementar a integração real (opção b acima), comece pelo par
  `*.functions.ts`/`*.server.ts` (ver [[supabase]]) para o envio via Graph
  API, gravando em `whatsapp_message_logs`/`whatsapp_queue` e nunca expondo
  `whatsapp_meta_config.access_token`/`app_secret` ao client.

## Más práticas

- Chamar a Graph API da Meta diretamente do client (React) — o
  `access_token` não pode existir no bundle do navegador; teria que ser uma
  server function.
- Assumir que preencher `whatsapp_meta_config` no banco já ativa envio
  automático — sem o worker/rota consumindo essa tabela, ela é só
  configuração inerte hoje.
- Misturar o fluxo `wa.me` (síncrono, ação do usuário) com o fluxo de fila
  (`whatsapp_queue`, assíncrono) como se fossem a mesma coisa.

## Fluxo recomendado (modelo atual — links manuais)

1. Monte os dados necessários (`SolicitacaoWhatsAppInfo` ou equivalente).
2. Gere a mensagem com o formatter apropriado
   (`formatPatientConfirmationMsg`, `formatClinicNotificationMsg`, ou um
   novo formatter seguindo o mesmo padrão).
3. Gere a URL com `getWhatsAppUrl(telefone, mensagem)`.
4. Dispare com `openWhatsAppLink(url)` a partir de um clique do usuário
   (nunca automaticamente, sem interação, pois `window.open` sem gesto do
   usuário é bloqueado pelo navegador).

## Checklist

- [ ] Usou `sanitizePhone`/`getWhatsAppUrl` em vez de montar a URL na mão?
- [ ] O link é disparado a partir de um evento de clique real (não em
      `useEffect`)?
- [ ] Se a tarefa pede "enviar automaticamente", você confirmou que isso
      significa construir a integração Cloud API do zero (schema existe,
      código servidor não)?
- [ ] Nenhuma credencial de `whatsapp_meta_config` foi exposta ao client?

## Regras obrigatórias

- Nenhum campo de `whatsapp_meta_config` (token, secret) pode aparecer em
  código client-side ou em `*.functions.ts` — só em um futuro `*.server.ts`
  dedicado, se a integração for construída.
- Números de telefone usados em links WhatsApp passam por
  `sanitizePhone`/`normalizar_whatsapp` (client/banco respectivamente) para
  garantir formato E.164.

## Arquivos normalmente envolvidos

- `src/lib/whatsapp-link.ts`
- Tabelas de schema preparatório: `whatsapp_meta_config`,
  `whatsapp_templates`, `whatsapp_evento_templates`, `whatsapp_message_logs`,
  `whatsapp_queue`, `whatsapp_sessions`.

## Erros comuns

- Confundir `normalizar_whatsapp` (função SQL, roda em trigger ao salvar no
  banco) com `sanitizePhone` (função TS, roda ao montar o link) — são
  implementações paralelas do mesmo conceito em camadas diferentes; mantenha
  as duas consistentes se uma delas for alterada.
- Assumir que `pacientes.whatsapp` está sempre preenchido — muitos fluxos
  usam `pacientes.telefone` como fallback (ver uso de
  `item.paciente?.telefone` no Dashboard).

## Exemplos

Ver `examples.md`.

## Observações

Se o objetivo de negócio é reduzir trabalho manual da recepção, a extensão
mais natural do modelo atual é implementar o worker que consome
`whatsapp_queue`/`whatsapp_meta_config` — isso é um projeto de integração
completo (ver [[deployment]] para runtime restrictions no Cloudflare
Workers, que já impedem algumas bibliotecas comuns de WhatsApp).
