# Skill: database

## Objetivo

Guiar qualquer alteração de schema (tabelas, enums, funções, triggers,
policies) mantendo consistência entre `supabase/migrations/` (histórico) e
`supabase/portable/02_schema_public.sql` (snapshot usado para provisionar
projetos novos), e preservando o padrão de regras de negócio como
triggers/functions SQL.

## Quando utilizar

- Ao adicionar/alterar uma tabela, coluna, enum, função ou trigger.
- Ao investigar por que uma regra de negócio "não bate" entre o que a UI
  espera e o que o banco retorna.
- Ao revisar se uma nova feature precisa de uma função `SECURITY DEFINER`
  para evitar recursão de RLS.
- Antes de escrever qualquer policy nova — ver também [[permissions]].

## Boas práticas

- Regras que precisam ser atômicas e não contornáveis (conflito de agenda,
  valor congelado, criação de financeiro, enfileiramento de notificação)
  vivem em **triggers/functions SQL**. Siga o padrão existente: função
  `plpgsql`, `SECURITY DEFINER` quando precisa ler/escrever além do que o
  chamador teria permissão, `SET search_path TO 'public'` sempre (proteção
  contra sequestro de search_path).
- Funções de leitura auxiliares que precisam contornar RLS de forma segura
  (ex.: `has_role`, `horarios_disponiveis`) são `STABLE SECURITY DEFINER` —
  não têm efeito colateral, só leem.
- Toda tabela nova: `gen_random_uuid()` como default de `id`, `created_at
  timestamptz default now()`, e `updated_at` + trigger `set_updated_at` se a
  linha é editável.
- Enums (`agendamento_status`, `app_role`, `financeiro_status`,
  `forma_pagamento`, `notif_canal`, `notif_evento`, `notif_status_envio`,
  `profissional_status`, `wa_status`) são a forma preferida de representar
  estado fechado — prefira estender um enum existente (nova migração
  `ALTER TYPE ... ADD VALUE`) a trocar por `text` livre.
- Ao adicionar uma coluna de telefone/WhatsApp, aplique o trigger
  `trg_normalizar_whatsapp` (via `normalizar_whatsapp()`) para manter o
  formato E.164 consistente — ver `pacientes.whatsapp`, `profiles.whatsapp`,
  `profissionais.whatsapp` como exemplos já existentes.

## Más práticas

- Adicionar uma tabela sem RLS habilitado "para depois".
- Escrever a mesma validação de negócio em TypeScript e assumir que
  substitui o trigger — trigger e client podem divergir; o trigger é a
  verdade.
- Usar `text` para status que deveria ser um enum fechado.
- Alterar uma migração antiga já aplicada em produção — sempre crie uma
  **nova** migração, mesmo para corrigir um erro em uma migração anterior.
- Esquecer de espelhar a mudança em `supabase/portable/02_schema_public.sql`
  — isso quebra o provisionamento de um projeto novo do zero.

## Fluxo recomendado

1. Escreva a migração em `supabase/migrations/<timestamp>_<slug>.sql`
   seguindo o padrão de nome já usado (timestamp de 14 dígitos + slug ou
   UUID curto).
2. Inclua na mesma migração: `CREATE TABLE`/`ALTER TABLE`, `ENABLE ROW LEVEL
   SECURITY`, todas as `CREATE POLICY` necessárias, e triggers relacionados
   (`set_updated_at`, normalizações, regras de negócio).
3. Aplique a migração no projeto Supabase (via CLI/painel, conforme
   `DEPLOYMENT.md`).
4. Atualize `supabase/portable/02_schema_public.sql` para refletir o novo
   estado completo do schema (é um dump, não um diff incremental).
5. Regenere `src/integrations/supabase/types.ts` (tipos `Database`) a partir
   do schema atualizado.
6. Atualize a checklist de `DEPLOYMENT.md` §3 se a mudança introduzir uma
   função/trigger que precisa ser validada na implantação.

## Checklist

- [ ] RLS habilitado e políticas cobrindo todas as operações que a app faz?
- [ ] Trigger `set_updated_at` presente se a tabela tem `updated_at`?
- [ ] Regra de negócio atômica está em SQL, não só em TypeScript?
- [ ] `supabase/portable/02_schema_public.sql` atualizado junto com a
      migração?
- [ ] Nomes em português, `snake_case`, consistentes com o vocabulário já
      usado?

## Regras obrigatórias

- Toda função `SECURITY DEFINER` tem `SET search_path TO 'public'`
  explícito (todas as funções existentes seguem isso — é mitigação contra
  um vetor de ataque conhecido do Postgres).
- Nunca editar uma migração já commitada/aplicada — nova migração sempre.
- `supabase/migrations/` e `supabase/portable/02_schema_public.sql` nunca
  divergem por muito tempo — trate como um único artefato lógico.

## Arquivos normalmente envolvidos

- `supabase/migrations/*.sql`
- `supabase/portable/01_extensions.sql`, `02_schema_public.sql`,
  `03_storage.sql`
- `src/integrations/supabase/types.ts` (gerado a partir do schema)
- `DEPLOYMENT.md` (checklist de banco)

## Erros comuns

- Esquecer o `WITH CHECK` em uma policy de `UPDATE`, permitindo que o
  usuário escreva valores fora da regra mesmo que não consiga *ler* linhas
  de outros usuários.
- Criar uma função que lê `auth.uid()` sem `SECURITY DEFINER` quando ela
  precisa acessar dados fora do que a policy do chamador permitiria —
  resulta em "funciona para ADMIN, falha silenciosamente para os outros".
- Esquecer o trigger de conflito ao criar uma tabela paralela de "eventos de
  agenda" — qualquer nova forma de reservar tempo de um profissional deve
  respeitar (ou estender) `check_agendamento_conflito()`.

## Exemplos

Ver `examples.md`.

## Observações

O schema atual tem 20 tabelas em `public` (contagem confirmada em
`DEPLOYMENT.md`). As tabelas `whatsapp_meta_config`, `whatsapp_templates`,
`whatsapp_evento_templates`, `whatsapp_message_logs`, `whatsapp_queue`,
`whatsapp_sessions` já existem no schema mas ainda não têm rotas
server-side/consumidoras completas no código React — são scaffolding para a
integração com WhatsApp Cloud API (ver [[whatsapp]]).
