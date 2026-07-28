/**
 * Zkopíruje objekty Storage bucketu ze starého Supabase projektu do nového.
 *
 * Použití (service_role klíče — NIKDY do gitu / chatu):
 *   OLD_SUPABASE_URL=https://sdzyhihtqrgsntbxlugp.supabase.co
 *   OLD_SUPABASE_SERVICE_ROLE_KEY=...
 *   NEW_SUPABASE_URL=https://NOVY-REF.supabase.co
 *   NEW_SUPABASE_SERVICE_ROLE_KEY=...
 *   STORAGE_BUCKET=league-covers   (volitelné)
 *
 *   node supabase/scripts/copy-storage-bucket.mjs
 */

import { createClient } from '@supabase/supabase-js';

const OLD_URL = process.env.OLD_SUPABASE_URL ?? 'https://sdzyhihtqrgsntbxlugp.supabase.co';
const OLD_KEY = process.env.OLD_SUPABASE_SERVICE_ROLE_KEY;
const NEW_URL = process.env.NEW_SUPABASE_URL;
const NEW_KEY = process.env.NEW_SUPABASE_SERVICE_ROLE_KEY;
const BUCKET = process.env.STORAGE_BUCKET ?? 'league-covers';

if (!OLD_KEY || !NEW_URL || !NEW_KEY) {
  console.error(`
Chybí env:
  OLD_SUPABASE_SERVICE_ROLE_KEY
  NEW_SUPABASE_URL
  NEW_SUPABASE_SERVICE_ROLE_KEY
`);
  process.exit(1);
}

const oldDb = createClient(OLD_URL, OLD_KEY);
const newDb = createClient(NEW_URL, NEW_KEY);

async function listAll(prefix = '') {
  const out = [];
  let offset = 0;
  const limit = 100;
  for (;;) {
    const { data, error } = await oldDb.storage.from(BUCKET).list(prefix, {
      limit,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw new Error(`list ${prefix}: ${error.message}`);
    if (!data?.length) break;

    for (const item of data) {
      const path = prefix ? `${prefix}/${item.name}` : item.name;
      // folder: no id / metadata often
      if (item.id === null && !item.metadata) {
        out.push(...(await listAll(path)));
      } else {
        out.push(path);
      }
    }
    if (data.length < limit) break;
    offset += limit;
  }
  return out;
}

async function ensureBucket() {
  const { data: buckets, error } = await newDb.storage.listBuckets();
  if (error) throw new Error(`listBuckets: ${error.message}`);
  if (buckets?.some((b) => b.name === BUCKET || b.id === BUCKET)) return;

  const { error: createErr } = await newDb.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: 5 * 1024 * 1024,
    allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  });
  if (createErr && !String(createErr.message).includes('already')) {
    throw new Error(`createBucket: ${createErr.message}`);
  }
}

async function main() {
  console.log(`→ bucket ${BUCKET}: ${OLD_URL} → ${NEW_URL}`);
  await ensureBucket();

  const paths = await listAll();
  console.log(`  nalezeno ${paths.length} souborů`);

  let ok = 0;
  let fail = 0;
  for (const path of paths) {
    try {
      const { data, error } = await oldDb.storage.from(BUCKET).download(path);
      if (error) throw error;
      const buf = Buffer.from(await data.arrayBuffer());
      const { error: upErr } = await newDb.storage.from(BUCKET).upload(path, buf, {
        upsert: true,
        contentType: data.type || undefined,
      });
      if (upErr) throw upErr;
      ok++;
      if (ok % 10 === 0) console.log(`  … ${ok}/${paths.length}`);
    } catch (e) {
      fail++;
      console.warn(`  ✗ ${path}: ${e.message || e}`);
    }
  }
  console.log(`Hotovo: ${ok} OK, ${fail} chyb`);
  if (fail) process.exit(1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
