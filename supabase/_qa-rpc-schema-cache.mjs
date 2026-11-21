#!/usr/bin/env node
/**
 * _qa-rpc-schema-cache.mjs — diagnostik read-only: RPC mana yang terekspos di
 * schema cache PostgREST, dan apakah bisa dipanggil via HTTP.
 *
 *   node supabase/_qa-rpc-schema-cache.mjs
 *
 * READ-ONLY: hanya GET OpenAPI + POST ke RPC dengan argumen yang TIDAK mengubah
 * data (pola tetap_kosong → fungsi mengembalikan error/ok tanpa write), atau
 * hanya melaporkan PGRST202 tanpa memanggil.
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
const SVC = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !SVC) { console.error('GAGAL: SUPABASE_URL/SERVICE_ROLE_KEY kosong di .env.local'); process.exit(1); }

// Daftar fungsi yang dipanggil kode produksi (Edge Function + Control + app).
const FOKUS = [
  'account_prepare_identity',
  'account_bind_auth_user',
  'account_attach_existing_licenses',
  'account_ensure_referral_for_gid',
  'license_activate_device',
  'license_claim_identity',
  'partner_approve',
  'partner_issue_token',
  'referral_resolve_pending',
  'masjid_sync_colls',
  'masjid_publish',
  'masjid_draft',
  'partner_register',
  'app_feature_gate',
];

const HS = { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' };

async function openapi() {
  const r = await fetch(`${URL_BASE}/rest/v1/`, { headers: { ...HS, Accept: 'application/openapi+json' } });
  const t = await r.text();
  if (!r.ok) { console.error('OpenAPI HTTP', r.status, t.slice(0, 200)); return new Set(); }
  const j = JSON.parse(t);
  return new Set(Object.keys(j.paths || {})
    .filter((p) => p.startsWith('/rpc/'))
    .map((p) => p.replace('/rpc/', '').replace(/\?.*$/, '')));
}

async function cek(fn) {
  const r = await fetch(`${URL_BASE}/rest/v1/rpc/${fn}`, {
    method: 'POST', headers: HS, body: JSON.stringify({}),
  });
  const t = await r.text();
  let code = '';
  try { code = JSON.parse(t)?.code || JSON.parse(t)?.hint || ''; } catch { code = t.slice(0, 80); }
  return { status: r.status, code };
}

const cache = await openapi();
console.log(`Total RPC di schema cache PostgREST: ${cache.size}\n`);
console.log('fungsi'.padEnd(38), 'di-cache?', '  probe-HTTP');
console.log('-'.repeat(70));
for (const fn of FOKUS) {
  const inCache = cache.has(fn);
  let probe;
  if (!inCache) {
    probe = 'PGRST202 (tidak ada di cache)';
  } else {
    const r = await cek(fn);
    probe = `HTTP ${r.status}${r.code ? ' ' + r.code : ''}`;
  }
  console.log(fn.padEnd(38), (inCache ? 'YA' : 'TIDAK').padEnd(9), probe);
}
