# Skill: deployment

## Objetivo

Garantir que qualquer mudança de build/config/dependência continue
compatível com os três alvos de deploy suportados (Cloudflare
Workers/Pages, Vercel, Netlify) e com o fluxo de provisionamento portátil
do Supabase.

## Quando utilizar

- Ao adicionar uma dependência nova, especialmente qualquer coisa que toque
  filesystem, processo nativo ou APIs específicas de Node.
- Ao alterar `vite.config.ts`, variáveis de ambiente, ou scripts de build.
- Ao preparar uma implantação nova (projeto Supabase novo, domínio novo).
- Ao investigar "funciona local, quebra em produção".

## Boas práticas

- O preset padrão do Nitro é **Cloudflare** — o runtime é `workerd`, não
  Node.js completo. Antes de adicionar uma dependência de servidor, confirme
  que ela não depende de `child_process`, `fs` além do necessário, `sharp`,
  `canvas` ou qualquer binário nativo (ver README.md §6, nota de
  restrição).
- Para Vercel/Netlify, o preset é forçado via variável de ambiente
  `NITRO_PRESET` (`vercel`/`netlify`) — não assuma que o build "simplesmente
  funciona" nesses provedores sem essa env var configurada.
- `@lovable.dev/vite-tanstack-config` já injeta TanStack devtools,
  `tanstackStart`, `viteReact`, `tailwindcss`, `tsConfigPaths`, `nitro`,
  injeção de `VITE_*`, alias `@`, dedupe de React/TanStack, error loggers e
  detecção de sandbox. **Não adicione manualmente** nenhum desses plugins
  em `vite.config.ts` — o comentário no topo do arquivo é explícito sobre
  isso, e duplicar plugins quebra o build.
- Toda variável de ambiente nova client-visível precisa do prefixo `VITE_`
  (injeção do Vite); toda variável server-only (principalmente
  `SUPABASE_SERVICE_ROLE_KEY`) **nunca** recebe esse prefixo.
- Ao provisionar um projeto novo, siga exatamente a ordem do README.md §3:
  `01_extensions.sql` → `02_schema_public.sql` → `03_storage.sql`, depois
  configuração de Auth (Site URL, Redirect URLs, provider Email/Google) e só
  então `pg_cron` para lembretes.

## Más práticas

- Introduzir uma lib de manipulação de imagem no server que exija binário
  nativo (`sharp`) — vai quebrar no preset Cloudflare (padrão do projeto).
  Se realmente necessário, isso precisa ser uma decisão explícita de trocar
  de runtime, não um efeito colateral não percebido.
- Editar `vite.config.ts` adicionando plugins que
  `@lovable.dev/vite-tanstack-config` já injeta.
- Esquecer de atualizar `VITE_SITE_URL` após apontar um domínio customizado
  — quebra canonical/OG/sitemap (ver `src/lib/site-url.ts`,
  `sitemap[.]xml.ts`).

## Fluxo recomendado (nova implantação)

1. `git clone` → `cp .env.example .env` preenchido → `npm install`.
2. Provisionar banco: rodar os três SQLs de `supabase/portable/` em ordem
   (projeto novo) ou `export-data.sh`/`import-data.sh`/
   `migrate-storage.mjs` (migrando de outro projeto).
3. Configurar Auth no painel Supabase (Site URL, Redirect URLs, providers,
   template de recuperação de senha).
4. Promover o primeiro usuário criado a `ADMIN` (acontece automaticamente
   via `handle_new_user()` se `user_roles` estiver vazia — não precisa ação
   manual no caso comum).
5. Escolher provedor de hospedagem e configurar `NITRO_PRESET` conforme
   necessário (Cloudflare não precisa; Vercel/Netlify precisam).
6. Cadastrar todas as variáveis de `.env.example` no provedor (marcando
   `SUPABASE_SERVICE_ROLE_KEY` como secret).
7. Deploy → validar `DEPLOYMENT.md` checklist completo antes de considerar
   pronto.
8. Ativar `pg_cron` para `gerar_lembretes()` a cada 15 minutos.

## Checklist

- [ ] Nenhuma dependência nova quebra o runtime Cloudflare Workers (sem
      binário nativo)?
- [ ] `vite.config.ts` não duplica plugin já injetado pelo
      `@lovable.dev/vite-tanstack-config`?
- [ ] Variáveis de ambiente novas seguem a convenção `VITE_` (client) vs
      sem prefixo (server-only)?
- [ ] `supabase/portable/` está sincronizado com as migrações mais
      recentes antes de provisionar um projeto novo?
- [ ] `DEPLOYMENT.md` foi seguido/atualizado se a mudança introduz um novo
      item de checklist (nova função SQL, novo bucket, nova env var)?

## Regras obrigatórias

- `SUPABASE_SERVICE_ROLE_KEY` é sempre cadastrada como *secret* no
  provedor de hospedagem, nunca como variável pública.
- Nenhum `push --force`/`rebase`/`amend` em commits já sincronizados com o
  Lovable (ver `AGENTS.md`).

## Arquivos normalmente envolvidos

- `vite.config.ts`, `.env.example`, `README.md`, `DEPLOYMENT.md`
- `supabase/portable/*.sql`
- `src/server.ts` (entry SSR)

## Erros comuns

- Esquecer `NITRO_PRESET` no Vercel/Netlify e obter uma saída de build
  incompatível com o provedor.
- Confundir a Output Directory esperada por provedor (`.output/public` na
  Vercel, `dist` na Netlify, conforme README.md).
- Apontar `VITE_SITE_URL` para `localhost` em produção por engano,
  quebrando `og:image`/canonical/sitemap.

## Exemplos

Ver `examples.md`.

## Observações

O projeto declara suportar três alvos de deploy diferentes com o mesmo
código-fonte — qualquer mudança de infraestrutura deve ser validada (ou ao
menos considerada) nos três, não só no ambiente que o desenvolvedor usa no
dia a dia.
