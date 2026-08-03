# Skill: react

## Objetivo

Padronizar como componentes, rotas e estado são escritos neste projeto:
TanStack Start (roteamento por arquivo + SSR) + React 19 + TanStack Query,
sem os padrões de Next.js/Remix que não se aplicam aqui.

## Quando utilizar

- Ao criar qualquer rota nova (arquivo em `src/routes/`).
- Ao criar um componente novo, decidir onde colocá-lo (`components/ui`,
  `components/<feature>`, ou junto da rota).
- Ao decidir entre estado local, TanStack Query, ou o `AuthProvider`.

## Boas práticas

- **Rotas**: siga exatamente `src/routes/README.md`. Arquivo = rota;
  `index.tsx` = `/`; `$id.tsx` = param dinâmico; `app.agenda.tsx` = `/app/agenda`
  (ponto no nome do arquivo = segmento de URL, não pasta aninhada, seguindo
  o padrão flat já usado no projeto). `__root.tsx` é o único layout raiz.
  Nunca crie `src/pages/` ou `app/layout.tsx`.
- Toda rota exporta `Route = createFileRoute("/caminho")({ head: () => ({
  meta: [...] }), component: NomeDoComponente })` — inclua sempre `title`,
  `description`, `og:*` no `head()` (SEO/compartilhamento é levado a sério
  neste projeto, ver todas as rotas existentes como referência), e
  `{ name: "robots", content: "noindex" }` em rotas internas do Painel/Área
  do Cliente.
- **Dados assíncronos**: sempre `useQuery`/`useMutation` do TanStack Query
  — nunca `useEffect` + `useState` manual para buscar dado do Supabase.
  `queryKey` deve conter todo input relevante (ex.:
  `["agenda", data, effectiveProfId ?? "ALL"]`) para cache correto por
  variação de filtro.
- **Formulários**: o padrão dominante no projeto é `useState` local para os
  campos + `zod.parse()` dentro do `mutationFn` (ver `AgendaView`,
  `app.pacientes.tsx`) — não introduza `react-hook-form` em uma tela nova a
  menos que ela já use o padrão `components/ui/form.tsx`, para manter
  consistência dentro do mesmo arquivo/feature.
- **Server functions no client**: chame com `useServerFn(minhaServerFn)`
  (`@tanstack/react-start`) dentro de um `useMutation`/`useQuery` — trate
  como qualquer outra função assíncrona de dados.
- **Composição**: prefira estender um componente existente via props (ver
  `AgendaView`) a duplicar arquivo inteiro para uma variação de contexto.
- **Contexto global**: só existem três providers no `__root.tsx`
  (`QueryClientProvider`, `ThemeProvider`, `AuthProvider`) — para estado que
  precisa atravessar muitos componentes, prefira TanStack Query
  (cache compartilhado por `queryKey`) a criar um novo Context.

## Más práticas

- Buscar dados em `useEffect` + `fetch`/`supabase.from(...)` sem TanStack
  Query — perde cache, invalidação e estado de loading/erro padronizados.
- Criar uma rota fora do padrão de arquivo do TanStack Start (subpastas
  estilo Next.js `app/`).
- Editar `src/routeTree.gen.ts` manualmente — é gerado a partir dos
  arquivos de `src/routes/`.
- Ler sessão/papéis fora de `useAuth()` (ver [[authentication]]).
- Introduzir uma biblioteca de estado global (Redux, Zustand, Jotai) — o
  projeto resolve estado de servidor com TanStack Query e estado de UI local
  com `useState`; não há necessidade demonstrada de uma lib adicional.

## Fluxo recomendado

1. Nova tela → arquivo em `src/routes/` seguindo a convenção de nome.
2. `head()` com meta tags completas.
3. Dado vem de `useQuery` com `queryKey` granular; escrita via
   `useMutation` com `onSuccess` invalidando as `queryKey`s certas
   (ver [[supabase]]).
4. UI composta com componentes de `components/ui/` + componentes de feature
   existentes sempre que possível.
5. Gate de acesso (se necessário) via `useAuth()` + `useEffect` +
   `navigate({ to, replace: true })`, com um `return` condicional
   (`AuthSplash` ou spinner) enquanto não `ready`.

## Checklist

- [ ] Rota segue a convenção de arquivo (nada de pastas estilo Next.js)?
- [ ] `head()` tem meta tags completas, incluindo `robots: noindex` se for
      rota interna?
- [ ] Todo dado assíncrono passa por `useQuery`/`useMutation`?
- [ ] `queryKey` reflete todas as variáveis que afetam o resultado?
- [ ] Nenhum novo Context global foi criado sem necessidade real?

## Regras obrigatórias

- `src/routeTree.gen.ts` nunca é editado manualmente.
- Toda rota client-facing tem meta tags de SEO (site público) ou `noindex`
  (áreas autenticadas).

## Arquivos normalmente envolvidos

- `src/routes/*.tsx`, `src/routes/README.md`
- `src/router.tsx`
- `src/components/ui/*`, `src/components/<feature>/*`

## Erros comuns

- Esquecer `enabled: <condição>` em uma `useQuery` que depende de algo
  assíncrono (sessão, um `id` selecionado) — dispara request prematura ou
  com parâmetro inválido.
- Esquecer de invalidar `queryKey`s relacionadas após uma mutação,
  deixando outra tela (ex.: dashboard) desatualizada até reload manual.
- Usar `React.FC` — o padrão do projeto é função nomeada com props
  tipadas inline ou via `interface`/`type` local (ver qualquer componente
  em `components/ui/`).

## Exemplos

Ver `examples.md`.

## Observações

React 19 está em uso — hooks como `use()` e Actions existem na versão, mas
o projeto **não os adota** hoje; siga o padrão já estabelecido
(`useQuery`/`useMutation` explícitos) em vez de introduzir Server Actions ou
`use()` sem alinhar antes.
