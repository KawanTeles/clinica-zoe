#!/usr/bin/env bash
# =====================================================================
# Clínica Zoe — Exportação dos dados (origem: Supabase gerenciado atual)
#
# Uso:
#   export SOURCE_DB_URL="postgresql://postgres:SENHA@HOST:5432/postgres"
#   ./supabase/portable/export-data.sh
#
# Gera em ./supabase/portable/dump/:
#   auth_data.sql    -> usuários, identidades e sessões (auth.*)
#   public_data.sql  -> todos os registros das tabelas de negócio (public.*)
#   storage_meta.sql -> metadados de objetos do Storage
#
# Nada é alterado no banco de origem: são somente leituras.
# =====================================================================
set -euo pipefail

: "${SOURCE_DB_URL:?Defina SOURCE_DB_URL com a connection string do banco de ORIGEM}"

OUT_DIR="$(cd "$(dirname "$0")" && pwd)/dump"
mkdir -p "$OUT_DIR"

echo "==> Exportando dados de autenticação (auth.users / auth.identities)…"
pg_dump "$SOURCE_DB_URL" \
  --data-only --no-owner --no-privileges --column-inserts \
  -t auth.users -t auth.identities \
  -f "$OUT_DIR/auth_data.sql"

echo "==> Exportando dados de negócio (schema public)…"
pg_dump "$SOURCE_DB_URL" \
  --data-only --no-owner --no-privileges --disable-triggers \
  -n public \
  -f "$OUT_DIR/public_data.sql"

echo "==> Exportando metadados do Storage…"
pg_dump "$SOURCE_DB_URL" \
  --data-only --no-owner --no-privileges --column-inserts \
  -t storage.objects \
  -f "$OUT_DIR/storage_meta.sql"

echo "==> Concluído. Arquivos em: $OUT_DIR"
ls -lh "$OUT_DIR"
