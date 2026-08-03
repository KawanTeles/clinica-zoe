# Exemplos — deployment

## 1. `vite.config.ts` mínimo (não adicionar plugins duplicados)

```ts
// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" }, // redireciona para src/server.ts (wrapper SSR de erro)
  },
});
```

## 2. Forçando preset para Vercel

```sh
NITRO_PRESET=vercel npm run build
```

Cadastrar `NITRO_PRESET=vercel` como variável de ambiente permanente do
projeto na Vercel para que builds futuros (inclusive os automáticos por
push) gerem a saída correta — não é algo para rodar só manualmente uma vez.

## 3. Provisionamento de um projeto Supabase novo, na ordem correta

```sh
cd supabase/portable
export TARGET_DB_URL="postgresql://postgres:<senha>@db.<ref>.supabase.co:5432/postgres"

psql "$TARGET_DB_URL" -f 01_extensions.sql     # pgcrypto, pg_cron, pg_net
psql "$TARGET_DB_URL" -f 02_schema_public.sql  # tabelas, RLS, policies, funções, triggers
psql "$TARGET_DB_URL" -f 03_storage.sql        # buckets + policies
```

Seguido da ativação do cron de lembretes:

```sql
select cron.schedule('gerar-lembretes', '*/15 * * * *', $$ select public.gerar_lembretes(); $$);
```

## 4. Variáveis de ambiente — client vs server-only

`.env.example` (padrão real do projeto):

```
VITE_SUPABASE_URL=...            # client — precisa do prefixo VITE_
VITE_SUPABASE_PUBLISHABLE_KEY=... # client
SUPABASE_URL=...                  # server (SSR/server functions) — sem VITE_
SUPABASE_SERVICE_ROLE_KEY=...     # server-only, secret — NUNCA com VITE_
VITE_SITE_URL=...                 # client — usado em canonical/OG/sitemap
```
