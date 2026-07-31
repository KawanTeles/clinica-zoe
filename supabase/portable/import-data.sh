#!/usr/bin/env bash
# =====================================================================
# Clínica Zoe — Importação no NOVO projeto Supabase (sua conta)
#
# Pré-requisitos: já ter rodado, no novo projeto, na ordem:
#   01_extensions.sql  ->  02_schema_public.sql  ->  03_storage.sql
#
# Uso:
#   export TARGET_DB_URL="postgresql://postgres:SENHA@HOST:5432/postgres"
#   ./supabase/portable/import-data.sh
# =====================================================================
set -euo pipefail

: "${TARGET_DB_URL:?Defina TARGET_DB_URL com a connection string do banco de DESTINO}"

DIR="$(cd "$(dirname "$0")" && pwd)/dump"
[ -d "$DIR" ] || { echo "Pasta $DIR não existe. Rode export-data.sh antes."; exit 1; }

echo "==> 1/3 Importando usuários (auth)…"
psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -f "$DIR/auth_data.sql"

echo "==> 2/3 Importando dados de negócio (public)…"
# session_replication_role=replica evita que os triggers de notificação,
# conflito de agenda e valor congelado disparem durante a carga histórica.
psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 \
  -c "SET session_replication_role = 'replica';" \
  -f "$DIR/public_data.sql"

echo "==> 3/3 Importando metadados do Storage…"
psql "$TARGET_DB_URL" -v ON_ERROR_STOP=1 -f "$DIR/storage_meta.sql" || \
  echo "   (aviso: metadados serão recriados pelo migrate-storage.mjs, pode ignorar)"

echo "==> Conferência rápida:"
psql "$TARGET_DB_URL" -c "
  SELECT 'profiles' t, count(*) FROM public.profiles
  UNION ALL SELECT 'user_roles', count(*) FROM public.user_roles
  UNION ALL SELECT 'profissionais', count(*) FROM public.profissionais
  UNION ALL SELECT 'pacientes', count(*) FROM public.pacientes
  UNION ALL SELECT 'agendamentos', count(*) FROM public.agendamentos
  UNION ALL SELECT 'financeiro', count(*) FROM public.financeiro
  UNION ALL SELECT 'notificacoes', count(*) FROM public.notificacoes;"

echo "==> Importação concluída."
