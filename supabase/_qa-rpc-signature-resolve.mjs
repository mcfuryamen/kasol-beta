#!/usr/bin/env node
/**
 * _qa-rpc-signature-resolve.mjs — bukti resolusi signature RPC.
 *
 * Untuk tiap pemanggilan di kode produksi, panggil HTTP dengan NAMA ARGUMEN
 * persis seperti kodenya. PostgREST(vm):
 *   · signature TIDAK cocok  → 404 PGRST202 "Could not find the function ..."
 *   · signature cocok, TAPI role tak punya EXECUTE → 401/403 (42501)
 *
 * Jadi "bukan PGRST202" = signature-nya COCOK. Role/permission diuji terpisah.
 * Anon key dipakai → tidak butuh sesi, dan tidak ada data yang ditulis
 * (semua fungsi dipanggil dengan argumen invalid/kosong yang ditolak server).
 *
 * READ-ONLY. Kunci tidak pernah dicetak.
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
const HS = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

async function post(fn, body) {
  const r = await fetch(`${URL_BASE}/rest/v1/rpc/${fn}`, { method: 'POST', headers: HS, body: JSON.stringify(body) });
  const t = await r.text();
  let code = '', msg = '';
  try { const j = JSON.parse(t); code = j.code || j.error || ''; msg = j.reason || j.hint || j.message || ''; } catch { msg = t.slice(0, 80); }
  return { status: r.status, code, msg };
}

// [fungsi, argumen] — MENYALIN persis bentuk di kode produksi.
const probes = [
  ['app_my_license', { p_app_key: 'masjid', p_device_code: 'probe-device', p_device_label: 'probe' }],
  ['app_my_license', { p_app_key: 'kaki5', p_device_code: 'probe-device', p_device_label: 'probe', p_outlet_id: null }],
  ['app_feature_gate', { p_app: 'masjid' }],
  ['account_my_avatar', {}],
  ['masjid_domain_for_slug', { p_slug: 'masjid' }],
  ['masjid_resolve_domain', { p_domain: 'contoh.smk' }],
  ['device_known', { p_unit_id: 'probe-unit', p_device_code: 'probe-device', p_app_type: 'kaki5' }],
  ['device_assign', { p_serial: 'PROBE', p_profile: { nama_usaha: 'x', nama_pemilik: 'y', no_whatsapp: 'z' }, p_new_unit_id: 'probe-unit', p_new_device_code: 'probe-device', p_new_install_id: 'probe-install', p_app_type: 'kaki5' }],
  ['hub_redeem_activation_code', { p_code: 'PROBE-NOT-EXIST', p_device_code: 'probe-device', p_device_label: 'probe', p_install_id: null }],
  ['app_my_access', { p_app_key: 'kaki5' }],
  ['app_list_members', { p_app_key: 'kaki5' }],
  ['app_add_member', { p_app_key: 'kaki5', p_wa: '628000000000', p_role: 'kasir', p_nama: 'probe', p_outlet_id: null }],
  ['app_set_member_role', { p_member_id: '00000000-0000-0000-0000-000000000000', p_role: 'kasir' }],
  ['app_remove_member', { p_member_id: '00000000-0000-0000-0000-000000000000' }],
  ['account_my_profile', {}],
  ['account_my_summary', {}],
  ['account_my_payouts', {}],
  ['account_my_referrals', { p_limit: 5 }],
  ['account_ensure_referral', {}],
  ['account_become_partner', { p_kota: null, p_provinsi: null, p_catatan: null }],
  ['account_update_profile', { p_nama: null, p_kota: null, p_provinsi: null, p_alamat_detail: null, p_kecamatan: null, p_desa: null }],
  ['account_request_payout', { p_points: 1, p_amount: 1, p_bank_info: 'probe' }],
  ['account_create_activation_code', { p_license_id: '00000000-0000-0000-0000-000000000000' }],
  ['account_prepare_identity', { p_wa: '1', p_nama: 'probe' }],
  ['account_bind_auth_user', { p_gid: null, p_auth_user_id: null }],
  ['account_attach_existing_licenses', { p_gid: '00000000-0000-0000-0000-000000000000' }],
  ['account_ensure_referral_for_gid', { p_gid: '00000000-0000-0000-0000-000000000000' }],
];

console.log('fungsi'.padEnd(34), 'HTTP', 'verdict');
console.log('-'.repeat(84));
let pgrst202 = 0, ok = 0;
for (const [fn, body] of probes) {
  const r = await post(fn, body);
  const p202 = r.code === 'PGRST202';
  if (p202) pgrst202++;
  else ok++;
  const verdict = p202
    ? 'PGRST202 — SIGNATURE TIDAK COCOK'
    : (r.status === 404 ? 'signature cocok (404 lain)' : `signature cocok (${r.status})`);
  console.log(fn.padEnd(34), String(r.status).padEnd(5), verdict);
}
console.log(`\nSignature cocok : ${ok}/${probes.length}`);
console.log(`PGRST202         : ${pgrst202}/${probes.length}`);
