#!/usr/bin/env node
/**
 * Seed baris `clients` UJI untuk QA Akun Kasol (uji sync Data Diri ↔ klien).
 * =============================================================================
 * Menanam satu baris registri app (kaki5) dengan WA uji — nanti saat QA daftar,
 * `account_attach_existing_licenses` menautkannya ke akun, dan form Data Diri
 * harus prefill kota/provinsi dari baris ini.
 *
 * Usage:
 *   node supabase/seed-account-client.js --wa=089900099900 \
 *     --nama-usaha="Warung QA" --kabkota="Surakarta" --provinsi="Jawa Tengah"
 *   node supabase/seed-account-client.js --wa=089900099900 --clean   # hapus lagi
 *
 * Tidak mencetak token/service key.
 */
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadEnvLocal() {
  const out = {};
  const file = path.join(ROOT, '.env.local');
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = raw.match(/^\s*([A-Za-z_][\w]*)\s*=\s*(.*)\s*$/);
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
  }
  return out;
}

const env = loadEnvLocal();
const REF = (env.SUPABASE_PROJECT_REF
  || ((env.SUPABASE_URL || '').match(/([a-z0-9]+)\.supabase\.co/i) || [])[1]) || '';
const ACCESS = env.SUPABASE_ACCESS_TOKEN;

const arg = (name) => (process.argv.find((a) => a.startsWith(`--${name}=`)) || '').slice(name.length + 3);
const CLEAN = process.argv.includes('--clean');
const WA_RAW = arg('wa');

if (!REF || !ACCESS) {
  console.error('Butuh SUPABASE_PROJECT_REF/SUPABASE_URL + SUPABASE_ACCESS_TOKEN di .env.local');
  process.exit(1);
}
if (!WA_RAW) {
  console.error('Usage: node supabase/seed-account-client.js --wa=0899xxxx [--clean]');
  process.exit(1);
}

const normWa = (v) => {
  let s = String(v || '').replace(/[^0-9]/g, '');
  if (s.startsWith('0')) s = '62' + s.slice(1);
  else if (s.startsWith('8')) s = '62' + s;
  return s;
};
const WA = normWa(WA_RAW);
const UNIT_ID = `QA-K5-${WA.slice(-4)}-TEST`;

function mgmt(sql) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: sql });
    const req = https.request({
      hostname: 'api.supabase.com',
      port: 443,
      path: `/v1/projects/${REF}/database/query`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${ACCESS}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
      },
    }, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try { resolve(JSON.parse(body || '[]')); } catch { resolve([]); }
        } else {
          reject(new Error(`SQL HTTP ${res.statusCode}: ${String(body).slice(0, 300)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

const q = (s) => `'${String(s).replaceAll("'", "''")}'`;

if (CLEAN) {
  await mgmt(`delete from public.clients where unit_id = ${q(UNIT_ID)}`);
  console.log(`✅ baris klien uji ${UNIT_ID} dihapus.`);
  process.exit(0);
}

const namaUsaha = arg('nama-usaha') || 'Warung QA';
const kabkota = arg('kabkota') || 'Surakarta';
const provinsi = arg('provinsi') || 'Jawa Tengah';

// Idempoten: baris lama dengan unit_id sama dibuang dulu.
await mgmt(`delete from public.clients where unit_id = ${q(UNIT_ID)}`);
await mgmt(`
  insert into public.clients
    (unit_id, app_type, device_code, nama_usaha, nama_pemilik, no_whatsapp, kabkota, provinsi)
  values
    (${q(UNIT_ID)}, 'kaki5', ${q('QA-TEST')}, ${q(namaUsaha)}, ${q('QA Pemilik')},
     ${q(WA)}, ${q(kabkota)}, ${q(provinsi)})`);

const rows = await mgmt(`select id, unit_id, kabkota from public.clients where unit_id = ${q(UNIT_ID)}`);
if (!rows.length) {
  console.error('⛔ seed gagal — baris tidak ditemukan setelah insert.');
  process.exit(1);
}
console.log(`✅ klien uji ditanam: ${rows[0].unit_id} · kota=${rows[0].kabkota}`);
