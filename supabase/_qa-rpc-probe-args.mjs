#!/usr/bin/env node
/**
 * _qa-rpc-probe-args.mjs — probe read-only: apakah RPC bisa dipanggil via HTTP
 * dengan NAMA ARGUMEN yang benar.
 *
 * Hanya memakai argumen yang TIDAK mengubah data:
 *   account_prepare_identity(p_wa='1')  → invalid_wa (gagal sebelum INSERT)
 *   account_bind_auth_user(p_gid=null) → invalid_input (gagal sebelum UPDATE)
 *   license_claim_identity(p_license_id=nil) → error argumen, tanpa write
 *
 * Tujuannya: membuktikan apakah "PGRST202" tadi murni karena argumen kosong
 * (bukan karena fungsi hilang dari schema cache / grant service_role).
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
const HS = { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' };

async function post(fn, body) {
  const r = await fetch(`${URL_BASE}/rest/v1/rpc/${fn}`, { method: 'POST', headers: HS, body: JSON.stringify(body) });
  const t = await r.text();
  let code = '', msg = '';
  try { const j = JSON.parse(t); code = j.code || j.error || ''; msg = j.message || j.hint || j.reason || ''; } catch { msg = t.slice(0, 120); }
  return { status: r.status, code, msg };
}

// 1. Tampilkan definisi OpenAPI untuk beberapa fungsi → nama argumen yang PostgREST annul.
const oa = await (await fetch(`${URL_BASE}/rest/v1/`, { headers: { ...HS, Accept: 'application/openapi+json' } })).json();
for (const fn of ['account_prepare_identity', 'account_bind_auth_user', 'account_attach_existing_licenses']) {
  const p = oa.paths?.[`/rpc/${fn}`];
  if (!p) { console.log(`OpenAPI /rpc/${fn}: TIDAK ADA`); continue; }
  const body = p.post?.requestBody?.content?.['application/json']?.schema;
  console.log(`OpenAPI /rpc/${fn} → schema: ${JSON.stringify(body)}`);
  console.log(`   params: ${(p.post?.parameters || []).map((x) => x.name + ':' + (x.schema?.type || '')).join(', ')}`);
}
console.log('');

const probes = [
  ['account_prepare_identity', { p_wa: '1', p_nama: 'probe' }, 'invalid_wa (tidak write)'],
  ['account_prepare_identity', { p_wa: '1' }, 'hanya p_wa'],
  ['account_bind_auth_user', { p_gid: null, p_auth_user_id: null }, 'invalid_input (tidak write)'],
  ['account_attach_existing_licenses', { p_gid: '00000000-0000-0000-0000-000000000000' }, 'gid nol (tidak write)'],
  ['account_ensure_referral_for_gid', { p_gid: '00000000-0000-0000-0000-000000000000' }, 'gid nol (tidak write)'],
  ['license_activate_device', { p_license_id: '00000000-0000-0000-0000-000000000000', p_device_code: 'probe', p_device_label: 'probe', p_serial: null, p_exp_code: null }, 'uuid nol (tidak write)'],
];

console.log('fungsi'.padEnd(36), 'HTTP', 'kode/pesan');
console.log('-'.repeat(96));
for (const [fn, body, note] of probes) {
  const r = await post(fn, body);
  console.log(fn.padEnd(36), String(r.status).padEnd(5), `${r.code} ${r.msg}`.slice(0, 60).padEnd(62), `[${note}]`);
}
