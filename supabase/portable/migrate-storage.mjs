#!/usr/bin/env node
/**
 * Clínica Zoe — Cópia dos arquivos do Storage entre projetos Supabase.
 *
 * Copia todos os objetos dos buckets `profissionais`, `clientes` e `clinica`
 * do projeto de ORIGEM para o de DESTINO, preservando os mesmos caminhos
 * (portanto nenhuma URL/campo `foto_url` do banco precisa ser alterado).
 *
 * Uso:
 *   SOURCE_SUPABASE_URL=... SOURCE_SERVICE_ROLE_KEY=... \
 *   TARGET_SUPABASE_URL=... TARGET_SERVICE_ROLE_KEY=... \
 *   node supabase/portable/migrate-storage.mjs
 */
import { createClient } from '@supabase/supabase-js';

const BUCKETS = ['profissionais', 'clientes', 'clinica'];

const need = (name) => {
  const v = process.env[name];
  if (!v) {
    console.error(`Variável de ambiente ausente: ${name}`);
    process.exit(1);
  }
  return v;
};

const source = createClient(need('SOURCE_SUPABASE_URL'), need('SOURCE_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false },
});
const target = createClient(need('TARGET_SUPABASE_URL'), need('TARGET_SERVICE_ROLE_KEY'), {
  auth: { persistSession: false },
});

async function listAll(client, bucket, prefix = '') {
  const found = [];
  let offset = 0;
  for (;;) {
    const { data, error } = await client.storage
      .from(bucket)
      .list(prefix, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } });
    if (error) throw new Error(`[${bucket}/${prefix}] ${error.message}`);
    if (!data?.length) break;

    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) {
        found.push(...(await listAll(client, bucket, path))); // pasta
      } else {
        found.push(path);
      }
    }
    if (data.length < 100) break;
    offset += data.length;
  }
  return found;
}

let copied = 0;
let failed = 0;

for (const bucket of BUCKETS) {
  console.log(`\n=== Bucket: ${bucket} ===`);

  const { error: bucketError } = await target.storage.createBucket(bucket, { public: false });
  if (bucketError && !/already exists/i.test(bucketError.message)) {
    console.error(`  falha ao garantir bucket: ${bucketError.message}`);
  }

  let paths = [];
  try {
    paths = await listAll(source, bucket);
  } catch (err) {
    console.error(`  falha ao listar: ${err.message}`);
    continue;
  }
  console.log(`  ${paths.length} arquivo(s) encontrado(s)`);

  for (const path of paths) {
    const { data, error } = await source.storage.from(bucket).download(path);
    if (error) {
      console.error(`  ✗ download ${path}: ${error.message}`);
      failed++;
      continue;
    }
    const buffer = Buffer.from(await data.arrayBuffer());
    const { error: upErr } = await target.storage.from(bucket).upload(path, buffer, {
      contentType: data.type || 'application/octet-stream',
      upsert: true,
    });
    if (upErr) {
      console.error(`  ✗ upload ${path}: ${upErr.message}`);
      failed++;
      continue;
    }
    copied++;
    console.log(`  ✓ ${path}`);
  }
}

console.log(`\nConcluído: ${copied} copiado(s), ${failed} com erro.`);
process.exit(failed > 0 ? 1 : 0);
