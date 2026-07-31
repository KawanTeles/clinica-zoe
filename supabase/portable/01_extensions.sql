-- =====================================================================
-- Clínica Zoe — 01. Extensões
-- Execute PRIMEIRO, no SQL Editor do seu projeto Supabase.
-- Todas já existem por padrão em projetos Supabase; os comandos são
-- idempotentes e apenas garantem o mesmo conjunto do banco de origem.
-- =====================================================================

CREATE SCHEMA IF NOT EXISTS extensions;

CREATE EXTENSION IF NOT EXISTS pgcrypto      WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"   WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements WITH SCHEMA extensions;

-- Usadas por rotinas agendadas / chamadas HTTP a partir do banco.
-- Se o seu plano não permitir, ignore: a aplicação funciona sem elas,
-- apenas os lembretes agendados via banco deixam de existir.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA public;

-- supabase_vault já vem habilitado em projetos Supabase.
