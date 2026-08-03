# Skill: supabase

## Objetivo

Padronizar como o projeto acessa o Supabase a partir do client, do server e
das server functions, mantendo a separação estrita entre chave pública
(`publishable`) e chave de serviço (`service_role`).

## Quando utilizar

- Ao escrever qualquer `useQuery`/`useMutation` que fala com o Supabase.
- Ao criar uma nova `createServerFn`.
- Ao decidir se uma operação deve rodar com RLS (client normal) ou precisa de
  `service_role` (bypass de RLS, só no server).
- Ao mexer em Storage (upload/leitura de arquivos privados).

## Boas práticas

- Para leitura/escrita comum do usuário logado, use o client "ambiente-
  consciente" via `@/lib/supabase` (`supabase` — proxy que resolve
  `staff`/`client` pela URL atual) ou, dentro de hooks/components que já
  sabem o escopo, `getSupabaseFor(scope)`. RLS faz o trabalho de segurança.
- Para operações que **precisam** ignorar RLS (admin criando usuário,
  listando todos os perfis, banindo conta), use `supabaseAdmin`
  (`src/integrations/supabase/client.server.ts`) — e **só** dentro de um
  arquivo `*.server.ts`, importado dinamicamente de dentro do `.handler()`
  de uma `createServerFn`.
- Toda `createServerFn` sensível segue o trio: `.middleware([requireSupabaseAuth])`
  → `.inputValidator((data) => schema.parse(data))` → `.handler(async ({
  data, context }) => { ... })`.
- Arquivos de Storage privados (`profissionais`, `clientes`, `clinica`) são
  acessados via Signed URL (`createSignedUrl`), nunca URL pública direta —
  ver `useAvatarUrl` em `src/lib/avatar.tsx` como referência de padrão
  (cache de 50min via `staleTime`, já que a signed URL dura 1h).
- Ao escrever uma query com relação (`select("...", "paciente:pacientes(id,nome)")`),
  nomeie o alias igual ao nome usado no restante do componente para manter
  consistência de leitura.

## Más práticas

- Importar `supabaseAdmin` (ou qualquer `*.server.ts`) no topo de um arquivo
  de rota, componente ou `*.functions.ts` — isso inclui a service role key
  no bundle do cliente. **Sempre** `await import(...)` dinâmico, dentro do
  handler.
- Chamar `.auth.admin.*` (API administrativa do GoTrue) a partir do client
  — essas chamadas só existem no `supabaseAdmin` server-side.
- Usar `fetch` cru para a REST API do Supabase quando o SDK já resolve —
  perde tipagem de `Database` e o tratamento de `apikey`/headers já
  centralizado em `createSupabaseFetch`.
- Buscar `count` trazendo todas as linhas (`select("*")`) — use
  `{ count: "exact", head: true }` quando só o número importa.

## Fluxo recomendado

1. Pergunte: "esta operação roda como o próprio usuário (RLS resolve) ou
   precisa de privilégio elevado?"
2a. **RLS resolve**: use `supabase`/`getSupabaseFor(scope)` direto no
    componente/hook, dentro de `useQuery`/`useMutation`.
2b. **Precisa de privilégio elevado**: crie/estenda um par
    `X.functions.ts` (schema `zod` + `createServerFn` +
    `requireSupabaseAuth`) e `X.server.ts` (lógica com `supabaseAdmin`).
3. No client, chame a server function com `useServerFn` (ver
   `app.usuarios.tsx`) dentro de um `useMutation`, do mesmo jeito que
   qualquer outra mutação.
4. Invalide as `queryKey`s afetadas em `onSuccess`.

## Checklist

- [ ] A chave usada (`publishable` vs `service_role`) é a mínima necessária
      para a operação?
- [ ] `supabaseAdmin`/`*.server.ts` só é importado dinamicamente, dentro de
      um handler de server function?
- [ ] A entrada da server function é validada com `zod` antes de tocar o
      banco?
- [ ] Signed URLs de Storage usam `staleTime` compatível com a expiração
      (não gerar uma nova a cada render)?
- [ ] O tipo `Database` (`integrations/supabase/types.ts`) foi
      atualizado/considerado se o schema mudou?

## Regras obrigatórias

- `SUPABASE_SERVICE_ROLE_KEY` nunca leva prefixo `VITE_` e nunca aparece em
  um arquivo importado pelo client.
- Toda `createServerFn` que precisa de identidade usa
  `requireSupabaseAuth` no `.middleware([...])`.
- Buckets de Storage (`profissionais`, `clientes`, `clinica`) são privados —
  acesso é sempre via Signed URL, nunca tornando o bucket público para
  "simplificar".

## Arquivos normalmente envolvidos

- `src/integrations/supabase/client.ts` — client básico (browser, sem
  escopo dual — usado por partes ainda não migradas para o dual-client).
- `src/integrations/supabase/client.server.ts` — `supabaseAdmin`.
- `src/integrations/supabase/dual-client.ts` — `supabase`, `getSupabaseFor`.
- `src/integrations/supabase/auth-middleware.ts` — `requireSupabaseAuth`.
- `src/integrations/supabase/types.ts` — tipos gerados do schema
  (`Database`).
- `src/lib/*.functions.ts` / `src/lib/*.server.ts`.

## Erros comuns

- Esquecer que `types.ts` e `auth-middleware.ts` têm o comentário
  "automatically generated. Do not edit it directly." — mudanças de schema
  devem ser feitas via migração + regeneração, não editando o arquivo à mão.
- Usar o client errado (`client.ts` genérico) em vez do dual-client em um
  componente novo de uma área com sessão — resulta em sessão não encontrada
  mesmo com o usuário logado.
- Esquecer `.maybeSingle()` vs `.single()` — `.single()` lança erro se não
  houver linha; use `.maybeSingle()` sempre que "não existir" for um
  resultado válido (ex.: perfil ainda não criado).

## Exemplos

Ver `examples.md`.

## Observações

O projeto é "portátil": qualquer instância nova do Supabase pode ser
provisionada rodando os três arquivos de `supabase/portable/` em sequência.
Ao mudar schema, mantenha `supabase/migrations/` (histórico) e
`supabase/portable/02_schema_public.sql` (snapshot atual) sincronizados.
