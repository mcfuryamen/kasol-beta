#!/usr/bin/env node
/**
 * _qa-edge-origin-matrix.mjs — cek origin mana yang BOLEH memanggil Edge
 * Function `account-register` versi yang ter-deploy.
 *
 * PENTING: WA yang dipakai sudah terdaftar lengkap → prepare_identity balas
 * 'already_registered' TANPA menulis apa pun. Jadi probe ini read-only.
 *
 * Hasil yang diharapkan:
 *   · origin terotorisasi → 409 already_registered (RPC jalan, guard lolos)
 *   · origin tak terotorisasi → 403 origin_not_allowed
 *
 * Kunci tidak pernah dicetak.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = {};
for (const raw of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf-8').split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const eq = line.indexOf('=');
  if (eq <= 0) continue;
  env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
}
const URL_BASE = env.SUPABASE_URL.replace(/\/$/, '');

const webHtml = fs.readFileSync(path.join(ROOT, 'masjid', 'web-masjid', 'index.html'), 'utf8');
const keyM = webHtml.match(/const\s+SUPABASE_ANON_KEY\s*=\s*'([^']+)'/);
if (!keyM) { console.error('GAGAL: SUPABASE_ANON_KEY tidak ditemukan'); process.exit(1); }
const KEY = keyM[1];
const FN = `${URL_BASE}/functions/v1/account-register`;
const WA = '62823251033366'; // sudah terdaftar → 409, tanpa write

const ORIGINS = [
  'https://kasolmasjid.vercel.app',
  'https://adm-masjid-beta.vercel.app',
  'https://mitrabeta.vercel.app',
  'https://kq5beta.vercel.app',
  'https://rosok-beta.vercel.app',
  'https://mitra.kasirsolo.com',
  'https://kaki5.kasirsolo.com',
  'https://rosok.kasirsolo.com',
  'https://masjid.kasirsolo.com',
  'https://localhost',
  'capacitor://localhost',
  'http://localhost:8092',
  'http://127.0.0.1:8092',
  'http://localhost:8086',
  'https://evil.example',
];

async function probe(origin) {
  const r = await fetch(FN, {
    method: 'POST',
    headers: {
      apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json', Origin: origin,
    },
    body: JSON.stringify({ wa: WA, pin: '123456', nama: 'Probe Origin' }),
  });
  let code = '', msg = '';
  try { const j = JSON.parse(await r.text()); code = j.code || j.error || ''; msg = j.reason || ''; } catch { /* abaikan */ }
  return { status: r.status, code };
}

console.log('origin'.padEnd(40), 'HTTP', 'verdict');
console.log('-'.repeat(84));
for (const o of ORIGINS) {
  const r = await probe(o);
  const v = r.status === 409 ? 'DITERIMA (guard lolos, RPC jalan)'
    : r.status === 403 ? 'DITOLAK (origin tak terdaftar)'
    : `LAIN (${r.code || 'tanpa kode'})`;
  console.log(o.padEnd(40), String(r.status).padEnd(5), v);
}
