#!/usr/bin/env node
/**
 * Bersihkan akun UJI hasil QA `account-register`.
 * =============================================================================
 * Menghapus (lobi):
 *   1. baris global_identities untuk nomor yang diberikan,
 *   2. auth user yang tertaut (supabase auth admin),
 *   3. referral_partners bila nomor itu jadi mitra (opsional, --with-partner).
 *
 * Pengaman:
 *   · WAJIB --wa=0812xxxx (boleh diulang) + --yes.
 *   · MENOLAK nomor yang punya baris `clients` AKTIF (itu pelanggan nyata) —
 *     kecuali --force.
 *   · Tidak mencetak token/service key.
 *
 * Usage:
 *   node supabase/cleanup-account-test.js --wa=089900011122 --wa=089900022233 --yes
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
const URL_ = (env.SUPABASE_URL || '').replace(/\/$/, '');
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const ACCESS = env.SUPABASE_ACCESS_TOKEN;
const REF = (URL_.match(/^https?:\/\/([a-z0-9]+)\.supabase\.co/i) || [])[1]
  || env.SUPABASE_PROJECT_REF || '';

const argAll = (name) => process.argv
  .filter((a) => a.startsWith(`--${name}=`))
  .map((a) => a.slice(name.length + 3));

const WAS = argAll('wa');
const YES = process.argv.includes('--yes');
const FORCE = process.argv.includes('--force');
const WITH_PARTNER = process.argv.includes('--with-partner');

if (!URL_ || !SERVICE || !ACCESS || !REF) {
  console.error('Butuh SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ACCESS_TOKEN di .env.local');
  process.exit(1);
}
if (!WAS.length) {
  console.error('Usage: node supabase/cleanup-account-test.js --wa=0899xxxx --yes');
  process.exit(1);
}
if (!YES) {
  console.error('Tambahkan --yes kalau yakin mau menghapus.');
  process.exit(1);
}

const normWa = (v) => {
  let s = String(v || '').replace(/[^0-9]/g, '');
  if (!s) return '';
  if (s.startsWith('0')) s = '62' + s.slice(1);
  else if (s.startsWith('8')) s = '62' + s;
  return s;
};

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
          reject(new Error(`SQL HTTP ${res.statusCode}: ${String(body).slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

const q = (s) => `'${String(s).replaceAll("'", "''")}'`;

async function delAuthUser(id) {
  const res = await fetch(`${URL_}/auth/v1/admin/users/${id}`, {
    method: 'DELETE',
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}` },
  });
  if (!res.ok && res.status !== 404) {
    throw new Error(`hapus auth user ${id} gagal: HTTP ${res.status}`);
  }
}

const phones = WAS.map(normWa).filter(Boolean);
console.log(`Nomor uji: ${phones.join(', ')}`);

const rows = await mgmt(`
  select g.id, g.phone_e164, g.auth_user_id, g.display_name,
         (select count(*) from public.clients c
           where public.partner_norm_wa(c.no_whatsapp) = g.phone_e164) as clients_rows,
         (select count(*) from public.licenses l where l.global_identity_id = g.id) as licenses
    from public.global_identities g
   where g.phone_e164 in (${phones.map(q).join(',')})`);

if (!rows.length) {
  console.log('Tidak ada akun yang cocok — sudah bersih.');
  process.exit(0);
}

let blocked = false;
for (const r of rows) {
  const risky = Number(r.clients_rows) > 0 || Number(r.licenses) > 0;
  console.log(`- ${r.phone_e164} · gid=${r.id} · klien=${r.clients_rows} · lisensi=${r.licenses} · auth=${r.auth_user_id ? 'ada' : 'tidak'}`);
  if (risky && !FORCE) blocked = true;
}
if (blocked) {
  console.error('\n⛔ Ada akun yang menempel ke data pelanggan/lisensi nyata. Pakai --force hanya bila yakin.');
  process.exit(1);
}

for (const r of rows) {
  if (r.auth_user_id) {
    await delAuthUser(r.auth_user_id);
    console.log(`  auth user ${r.auth_user_id} dihapus`);
  }
}

const ids = rows.map((r) => q(r.id));
if (WITH_PARTNER) {
  await mgmt(`delete from public.referral_wallets w using public.referral_partners p
               where w.partner_id = p.id and p.global_identity_id in (${ids.join(',')})`);
  await mgmt(`delete from public.license_codes c using public.referral_partners p
               where c.owner_partner_id = p.id and p.global_identity_id in (${ids.join(',')})`);
  await mgmt(`delete from public.referral_partners where global_identity_id in (${ids.join(',')})`);
  console.log('  baris mitra (wallet/kode/partner) dihapus');
}

await mgmt(`delete from public.global_identities where id in (${ids.join(',')})`);
if (FORCE) {
  // --force dipakai untuk nomor uji ber-baris clients (seed QA) → ikut dibuang.
  await mgmt(`delete from public.clients where global_identity_id in (${ids.join(',')})`);
  console.log('  baris clients tertaut dihapus (force)');
}
console.log('✅ Selesai — akun uji dibersihkan.');