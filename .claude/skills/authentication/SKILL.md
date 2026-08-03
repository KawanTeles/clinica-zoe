# Skill: authentication

## Objetivo

Garantir que qualquer mudança em login, sessão, contexto de usuário ou
recuperação de senha respeite o modelo de **duas sessões independentes**
(equipe vs paciente) e a fonte única de verdade `useAuth()`.

## Quando utilizar

- Ao criar uma rota nova que precisa saber se há usuário logado, qual(is)
  papel(is) ele tem, ou redirecionar por sessão.
- Ao mexer em `src/lib/auth-context.tsx`, `auth-login.ts`, `staff-session.ts`
  ou qualquer arquivo em `src/integrations/supabase/`.
- Ao investigar bugs de "usuário deslogado sem motivo", "sessão errada
  aparecendo", "tela pisca conteúdo antes de redirecionar".
- Ao implementar login social, MFA ou qualquer mudança no fluxo de
  `supabase.auth`.

## Boas práticas

- Sempre consuma sessão/papéis via `useAuth()` (`src/lib/auth-context.tsx`).
  Nunca chame `supabase.auth.getSession()` diretamente em um componente de
  página — o Provider já centraliza isso e mantém os dois escopos
  sincronizados com a URL.
- Use `ready`, não `loading`, para decidir se pode renderizar conteúdo
  protegido. `loading` só indica que a sessão inicial foi lida; `ready`
  garante que sessão **e** papéis (`user_roles`, `profiles.nome`) já
  chegaram — evita flash de UI errada.
- Ao adicionar uma nova área que precisa de sessão isolada, adicione um novo
  valor a `AuthScope` e `STORAGE_KEYS` em `dual-client.ts` em vez de reusar
  `staff`/`client` para um propósito diferente.
- Login sempre passa por `signInGuarded` (`src/lib/auth-login.ts`), que
  checa `profiles.ativo`/`removido_em` e força `signOut()` se a conta estiver
  desativada — não chame `supabase.auth.signInWithPassword` diretamente em
  uma tela nova.
- Middleware de servidor (`requireSupabaseAuth`,
  `src/integrations/supabase/auth-middleware.ts`) é obrigatório em toda
  `createServerFn` que precisa saber quem é o usuário — ele valida o Bearer
  token e resolve `context.userId`/`context.claims`.

## Más práticas

- Ler `localStorage` diretamente para checar sessão — sempre passe por
  `getSupabaseFor(scope).auth`.
- Confiar em `session` sozinho para gate de UI sensível a papel — `session`
  só diz "está logado", não "pode ver isto". Combine com `roles`/`hasRole`.
- Redirecionar com base em `loading === false` sem checar `ready` — isso
  pode redirecionar um ADMIN para `/cliente` só porque os papéis ainda não
  chegaram.
- Duplicar a lógica de `scopeForPath` em vários lugares — é definida uma
  única vez em `dual-client.ts`.

## Fluxo recomendado

1. Componente monta → `AuthProvider` (em `__root.tsx`) já está ativo,
   calcula `scope` pela rota atual.
2. `useEffect` no Provider: registra `onAuthStateChange` **antes** de ler
   `getSession()` (ordem importa — evita perder eventos).
3. Ao detectar `session.user`, carrega `user_roles` + `profiles.nome` em
   paralelo (`Promise.all`) e só então marca `rolesLoaded = true` →
   `ready = true`.
4. Componentes de rota usam `useEffect` + `navigate({ to: "/auth",
   replace: true })` quando `ready && !isStaff` (ver `app.tsx`) — o redirect
   é responsabilidade da rota/layout, não do Provider.
5. Logout: `signOut()` do `useAuth()` encerra **apenas** a sessão do escopo
   atual — a outra área (ex.: sessão de paciente) continua ativa se
   existir.

## Checklist

- [ ] Usei `useAuth()` em vez de acessar `supabase.auth` diretamente?
- [ ] Testei o gate de carregamento com `ready`, não só `loading`?
- [ ] Confirmei que a rota nova está no escopo certo (`scopeForPath`)?
- [ ] Se é uma server function, adicionei `requireSupabaseAuth` no
      `.middleware([...])`?
- [ ] Testei o cenário de conta desativada (login deve falhar com a
      mensagem `DISABLED_ERROR`, não um erro genérico)?

## Regras obrigatórias

- Nunca misture o cliente Supabase `staff` com dados/telas da área
  `client` (ou vice-versa) — cada um tem sua própria sessão e RLS resolve
  os dados a partir de `auth.uid()` daquele token específico.
- Toda `createServerFn` que precisa de identidade do usuário usa
  `requireSupabaseAuth`; nunca confie em um `user_id` vindo do payload do
  cliente sem essa validação de token.
- Mensagens de erro de login não vazam se o e-mail existe (`GENERIC_ERROR`
  = "Credenciais inválidas" como fallback).

## Arquivos normalmente envolvidos

- `src/lib/auth-context.tsx` — `AuthProvider`, `useAuth`.
- `src/lib/auth-login.ts` — `signInGuarded`.
- `src/lib/staff-session.ts` — `useStaffSession` (atalho no site público).
- `src/integrations/supabase/dual-client.ts` — clientes/escopo.
- `src/integrations/supabase/auth-middleware.ts` — `requireSupabaseAuth`.
- `src/routes/auth.tsx`, `src/routes/cliente.login.tsx`,
  `src/routes/redefinir-senha.tsx`.

## Erros comuns

- Esquecer que trocar de `scope` (navegar de `/app` para `/`) **reseta**
  sessão/papéis no `AuthProvider` e recarrega do zero — código que assume
  estado de auth persistente entre áreas vai quebrar.
- Chamar `loadProfile` sem o `setTimeout(..., 0)` usado no listener original
  — o comentário no código ("Listener FIRST, then read session") existe por
  um motivo: evita race condition com o SDK do Supabase durante
  `onAuthStateChange`.
- Assumir que `roles` nunca é `[]` — usuário recém-criado sem trigger
  aplicado, ou erro de rede, deixam `roles = []`; sempre trate esse caso
  (ex.: `primaryRole = roles[0] ?? "CLIENTE"`).

## Exemplos

Ver `examples.md`.

## Observações

O primeiro usuário cadastrado no projeto vira `ADMIN` automaticamente
(`handle_new_user()` no banco, ver [[database]]) — isso só acontece uma vez
por instalação nova (quando `user_roles` está vazia).
