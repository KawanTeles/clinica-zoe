# Clínica Zoe — Sistema Administrativo + Site Público

Aplicação full-stack (TanStack Start + React 19 + Tailwind v4) com backend
Supabase: autenticação, RLS, Storage, funções SQL, triggers e rotinas agendadas.

O projeto é **totalmente portátil**: roda em qualquer ambiente apontando apenas
para o seu projeto Supabase, configurado via `.env`.

---

## 1. Requisitos

- Node.js 20+ (recomendado 22)
- `npm`, `pnpm` ou `bun`
- Um projeto Supabase (o deste sistema é `fivsvdgicvqnsngzyjiu`)

---

## 2. Executar localmente

```sh
git clone <url-do-repositorio>
cd <pasta-do-projeto>

cp .env.example .env      # preencha com as chaves do seu Supabase
npm install
npm run dev               # http://localhost:8080
```

Build de produção e pré-visualização:

```sh
npm run build
npm run preview
```

### Variáveis de ambiente

| Variável | Onde é usada | Obrigatória |
|---|---|---|
| `VITE_SUPABASE_URL` | browser | sim |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | browser | sim |
| `VITE_SUPABASE_PROJECT_ID` | browser | sim |
| `SUPABASE_URL` | SSR / server functions | sim |
| `SUPABASE_PUBLISHABLE_KEY` | SSR / server functions | sim |
| `SUPABASE_PROJECT_ID` | server | sim |
| `SUPABASE_SERVICE_ROLE_KEY` | apenas server (admin) | sim |
| `VITE_SITE_URL` | canonical, OG, sitemap | recomendada |
| `VITE_OG_IMAGE` | imagem de preview social | opcional |

> `SUPABASE_SERVICE_ROLE_KEY` **nunca** deve receber o prefixo `VITE_` — isso a
> exporia no bundle do navegador.

---

## 3. Configurar o Supabase

Todo o backend está versionado em `supabase/portable/`.

### 3.1 Projeto novo (do zero)

```sh
cd supabase/portable
export TARGET_DB_URL="postgresql://postgres:<senha>@db.<ref>.supabase.co:5432/postgres"

psql "$TARGET_DB_URL" -f 01_extensions.sql     # pgcrypto, pg_cron, pg_net, etc.
psql "$TARGET_DB_URL" -f 02_schema_public.sql  # tabelas, RLS, policies, funções, triggers
psql "$TARGET_DB_URL" -f 03_storage.sql        # buckets + policies de storage
```

### 3.2 Migrar dados de outro projeto

```sh
./export-data.sh          # gera dumps de auth + public do projeto de origem
./import-data.sh          # importa no projeto de destino
node migrate-storage.mjs  # copia os arquivos de todos os buckets
```

### 3.3 Configurações no painel do Supabase

1. **Authentication → URL Configuration**
   - Site URL: sua URL pública (mesma de `VITE_SITE_URL`)
   - Redirect URLs: `https://seu-dominio/**` e `http://localhost:8080/**`
2. **Authentication → Providers**: habilite Email; habilite Google se for usar.
3. **Authentication → Emails**: ajuste os templates de recuperação de senha.
4. **Database → Extensions**: confirme `pg_cron` e `pg_net` ativos.
5. **Storage**: buckets `profissionais`, `clientes`, `clinica` — todos privados,
   acessados por Signed URL.

### 3.4 Rotinas agendadas (pg_cron)

```sql
select cron.schedule(
  'gerar-lembretes',
  '*/15 * * * *',
  $$ select public.gerar_lembretes(); $$
);
select * from cron.job;
```

---

## 4. Publicar no Vercel

1. Importe o repositório em **Vercel → Add New → Project**.
2. Framework preset: **Other**; Build Command: `npm run build`;
   Output Directory: `.output/public` (detectado automaticamente pelo Nitro).
3. Em **Settings → Environment Variables**, adicione todas as variáveis do
   `.env.example` (Production + Preview).
4. Force o preset do Nitro para Vercel no build:

```sh
NITRO_PRESET=vercel npm run build
```

Adicione `NITRO_PRESET=vercel` como variável de ambiente do projeto para que o
build da Vercel gere a saída correta.

5. Deploy. Depois aponte `VITE_SITE_URL` para o domínio final e refaça o deploy.

---

## 5. Publicar no Netlify

1. **Add new site → Import an existing project**.
2. Build command: `npm run build` · Publish directory: `dist` (o preset do Nitro
   cuida da estrutura).
3. Variável de ambiente extra: `NITRO_PRESET=netlify`.
4. Adicione as demais variáveis do `.env.example` em
   **Site settings → Environment variables**.
5. Deploy e atualize `VITE_SITE_URL`.

---

## 6. Publicar no Cloudflare (Workers/Pages)

O preset padrão do build já é Cloudflare.

```sh
npm run build
npx wrangler deploy
```

1. Crie o projeto em **Cloudflare → Workers & Pages**.
2. Build command: `npm run build`.
3. Em **Settings → Variables and Secrets**, adicione as variáveis do
   `.env.example`. Marque `SUPABASE_SERVICE_ROLE_KEY` como **Secret**.
4. Aponte o domínio customizado e atualize `VITE_SITE_URL`.

> Restrição do runtime: as server functions rodam em Worker (workerd). Não use
> `child_process`, `sharp`, `canvas` ou pacotes que exijam binários nativos.

---

## 7. Conectar em um novo projeto Lovable (sem Cloud)

1. Crie um **projeto novo** no Lovable e **não habilite o Lovable Cloud**.
2. Conecte o repositório GitHub deste projeto.
3. No chat, use **+ → Supabase** (ou **Connectors → Supabase**) e conecte o seu
   projeto `fivsvdgicvqnsngzyjiu`.
4. As variáveis `SUPABASE_*` / `VITE_SUPABASE_*` passam a ser preenchidas pela
   conexão. Adicione manualmente `VITE_SITE_URL` (e `VITE_OG_IMAGE`, se usar).
5. Nada precisa ser reimportado: schema, dados e Storage já estão no seu projeto.

> Um projeto que **já** tem Lovable Cloud habilitado não pode ser convertido —
> por isso o caminho é sempre um projeto novo sem Cloud.

---

## 8. Estrutura relevante

```
src/integrations/supabase/   clientes Supabase (browser, server, admin, dual-session)
src/lib/                     auth, notificações, WhatsApp, helpers
src/routes/                  rotas do site público, painel /app e área /cliente
src/routes/api/public/       endpoints HTTP públicos (webhooks, diagnóstico)
supabase/portable/           pacote completo de migração do backend
supabase/migrations/         histórico de migrações SQL
DEPLOYMENT.md                checklist de implantação
```

---

## 9. Stack

TanStack Start · React 19 · TypeScript · Vite · Tailwind CSS v4 · shadcn/ui ·
Supabase (Postgres, Auth, Storage, RLS, pg_cron) · WhatsApp Cloud API
