# Migração para um projeto Supabase próprio — Clínica Zoe

Este pacote recria **exatamente** a infraestrutura atual (banco, RLS, funções,
triggers, enums, índices, Storage e Auth) em um projeto Supabase da sua conta.
Nenhuma tela, regra de negócio ou comportamento da aplicação muda: o código já
lê tudo de variáveis de ambiente.

## Conteúdo

| Arquivo | O que faz |
|---|---|
| `01_extensions.sql` | Extensões (pgcrypto, uuid-ossp, pg_cron, pg_net, pg_stat_statements) |
| `02_schema_public.sql` | Schema `public` completo: 9 enums, 20 tabelas, FKs, índices, constraints, 17 funções, 20 triggers, RLS, 52 policies e todos os GRANTs |
| `03_storage.sql` | Buckets `profissionais`, `clientes`, `clinica` (privados) + 9 policies de `storage.objects` |
| `export-data.sh` | Exporta os dados de origem (`auth.*`, `public.*`, `storage.objects`) |
| `import-data.sh` | Importa os dados no projeto de destino |
| `migrate-storage.mjs` | Copia os arquivos dos buckets entre projetos, preservando os caminhos |

## Passo a passo

### 1. Ações manuais (dependem do painel da Supabase)
1. Crie um projeto novo em <https://supabase.com/dashboard>.
2. Anote: **Project URL**, **anon/publishable key**, **service_role key** e a **senha do banco**.
3. Em *Authentication → Providers*, habilite **Email/Password** (e Google, se usar).
4. Em *Authentication → URL Configuration*, defina Site URL e Redirect URLs
   (inclua `https://SEU-DOMINIO/redefinir-senha`).
5. Em *Authentication → Providers → Email*, ative **Password HIBP check** para manter a política atual.

### 2. Estrutura (SQL Editor do novo projeto, nesta ordem)
```
01_extensions.sql
02_schema_public.sql
03_storage.sql
```

### 3. Dados
```bash
export SOURCE_DB_URL="postgresql://postgres:SENHA@db.<origem>.supabase.co:5432/postgres"
./supabase/portable/export-data.sh

export TARGET_DB_URL="postgresql://postgres:SENHA@db.<destino>.supabase.co:5432/postgres"
./supabase/portable/import-data.sh
```
Os usuários vão junto com hash de senha preservado — ninguém precisa redefinir senha.

### 4. Arquivos do Storage
```bash
SOURCE_SUPABASE_URL=... SOURCE_SERVICE_ROLE_KEY=... \
TARGET_SUPABASE_URL=... TARGET_SERVICE_ROLE_KEY=... \
node supabase/portable/migrate-storage.mjs
```

### 5. Variáveis de ambiente da aplicação
```env
VITE_SUPABASE_URL=https://<destino>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon ou sb_publishable_...>
VITE_SUPABASE_PROJECT_ID=<destino>
SUPABASE_URL=https://<destino>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<mesmo valor do VITE>
SUPABASE_PROJECT_ID=<destino>
SUPABASE_SERVICE_ROLE_KEY=<service_role>
VITE_SITE_URL=https://seu-dominio.com.br   # opcional: canonical/OG/sitemap
```
Nenhuma outra alteração de código é necessária — todos os clientes Supabase do
projeto (`src/integrations/supabase/*`) já são construídos a partir dessas
variáveis, sem nada específico do Lovable Cloud.

### 6. Rotinas agendadas (se você usa lembretes automáticos)
No SQL Editor do novo projeto:
```sql
SELECT cron.schedule(
  'gerar-lembretes',
  '*/15 * * * *',
  $$SELECT public.gerar_lembretes();$$
);
```

### 7. Segredos de integração
O token da WhatsApp Cloud API fica na tabela `whatsapp_meta_config` e vem junto
com o dump de dados. Confira em *Painel → WhatsApp → Diagnóstico* após a troca.

## Checklist final de validação

- [ ] Login da equipe (`/auth`) e login do cliente (`/cliente/login`)
- [ ] Cadastro de novo cliente e criação automática de `profiles` + role `CLIENTE`
- [ ] Recuperação de senha (`/redefinir-senha`)
- [ ] Logout e sessões simultâneas equipe/cliente
- [ ] Dashboard e badges da sidebar por role (ADMIN, RECEPCIONISTA, PROFISSIONAL)
- [ ] CRUD de profissionais, pacientes, especialidades e configurações da clínica
- [ ] Agenda: disponibilidade, bloqueios e trigger de conflito de horário
- [ ] Solicitação pública de consulta → aprovação → lançamento financeiro automático
- [ ] Financeiro: valores, filtros e mudança de status
- [ ] Notificações internas + fila de WhatsApp
- [ ] Upload e corte de foto (profissional e cliente) e leitura via signed URL
- [ ] RLS: cliente só enxerga os próprios dados; profissional só os próprios pacientes
- [ ] Console do navegador e logs do servidor sem erros
