#!/usr/bin/env node
/**
 * QA Fase B1 + KUOTA GLOBAL KATALOG
 * (migration-account-kasol-app-license-fase-b1.sql +
 *  migration-hub-device-quota-global.sql)
 *
 * Membuktikan:
 *   · lisensi diambil dari AKUN (licenses.global_identity_id), bukan unit_id
 *   · products.max_devices (SATU angka global per aplikasi di Katalog)
 *     benar-benar ditegakkan & tersinkron ke semua lisensi akun
 *   · perangkat sudah aktif tidak digusur walau kuota diturunkan
 *   · pegawai (kasir) memakai lisensi milik OWNER, role tetap 'kasir'
 *   · lisensi revoked / expired ditolak
 *   · anon DITOLAK (grant authenticated only)
 *
 * SELF-CLEANUP + verifikasi mandiri: gagal kalau ada sisa data uji.
 * Jalankan: node supabase/_qa-app-license-fase-b1.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const env = {};
for (const raw of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf-8').split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const eq = line.indexOf('=');
  if (eq <= 0) continue;
  env[line.slice(0, eq).trim()] = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
}
const URL = env.SUPABASE_URL.replace(/\/$/, '');
const SVC = env.SUPABASE_SERVICE_ROLE_KEY;
const ANON = env.SUPABASE_ANON_KEY;
// App & produk UJI TERSENDIRI: kuota kini GLOBAL di `products.max_devices`,
// jadi menyetel produk kaki5 sungguhan akan mengubah semua akun live. QA wajib
// memakai produknya sendiri agar data nyata tidak tersentuh sama sekali.
const APP = 'qab1';
const PROD_KODE = 'QAB1';
const PIN = '123456';
const WA_OWNER = '628990020101';
const WA_KASIR = '628990020102';
const WAS = [WA_OWNER, WA_KASIR];
const TAG = 'QA-B1-' + Date.now();
const DEV = (n) => `${TAG}-${n}`;
const email = (wa) => `${wa}@accounts.kasirsolo.local`;

const H = { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' };
let pass = 0, fail = 0;
const ok = (n, c, extra = '') => {
  if (c) { pass++; console.log('  PASS  ' + n); }
  else { fail++; console.log('  FAIL  ' + n + '  ' + extra); }
};

async function req(method, url, { body, headers } = {}) {
  const r = await fetch(url, {
    method,
    headers: { ...H, ...(headers || {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const t = await r.text();
  let data; try { data = t ? JSON.parse(t) : null; } catch { data = t; }
  return { status: r.status, data };
}
const get = (p, headers) => req('GET', `${URL}/rest/v1/${p}`, { headers });
const post = (p, body, headers) => req('POST', `${URL}/rest/v1/${p}`, { body, headers });
const patch = (p, body, headers) => req('PATCH', `${URL}/rest/v1/${p}`, { body, headers });
const del = (p, headers) => req('DELETE', `${URL}/rest/v1/${p}`, { headers });
const rpcSvc = (fn, args) => post(`rpc/${fn}`, args);

/** Login sebagai akun uji → header JWT authenticated (bukan service_role!). */
async function login(wa) {
  const r = await req('POST', `${URL}/auth/v1/token?grant_type=password`, {
    body: { email: email(wa), password: PIN },
    headers: { apikey: ANON, Authorization: `Bearer ${ANON}` },
  });
  if (!r.data?.access_token) throw new Error(`login ${wa} gagal: ${r.status} ${JSON.stringify(r.data)}`);
  return { apikey: ANON, Authorization: `Bearer ${r.data.access_token}`, 'Content-Type': 'application/json' };
}
const myLic = (hdr, dev) => post('rpc/app_my_license', {
  p_app_key: APP, p_device_code: dev, p_device_label: 'QA Fase B1',
}, hdr).then((r) => r.data);

let licenseId = null;
let productId = null;
const gids = [];
const authIds = [];

async function cariAuth(wa) {
  const u = await req('GET', `${URL}/auth/v1/admin/users?per_page=200`);
  return (u.data?.users || []).find((x) => x.email === email(wa))?.id || null;
}

async function bersihkan() {
  // Idempoten: panggil di awal DAN akhir. Hanya menyentuh data milik QA ini.
  // Urutan penting: licenses.product_id → products ON DELETE RESTRICT, jadi
  // lisensi & perangkatnya harus hilang dulu sebelum produk uji dihapus.
  const prodLama = await get(`products?kode_produk=eq.${PROD_KODE}&select=id`);
  for (const p of (Array.isArray(prodLama.data) ? prodLama.data : [])) {
    const ls = await get(`licenses?product_id=eq.${p.id}&select=id`);
    for (const l of (Array.isArray(ls.data) ? ls.data : [])) await del(`license_devices?license_id=eq.${l.id}`);
    await del(`licenses?product_id=eq.${p.id}`);
    await del(`products?id=eq.${p.id}`);
  }
  for (const wa of WAS) {
    const g = await get(`global_identities?phone_e164=eq.${wa}&select=id`);
    for (const row of (Array.isArray(g.data) ? g.data : [])) {
      const ls = await get(`licenses?global_identity_id=eq.${row.id}&select=id`);
      for (const l of (Array.isArray(ls.data) ? ls.data : [])) {
        await del(`license_devices?license_id=eq.${l.id}`);
      }
      await del(`licenses?global_identity_id=eq.${row.id}`);
      await del(`app_memberships?global_identity_id=eq.${row.id}`);
    }
    const id = await cariAuth(wa);
    if (id) await req('DELETE', `${URL}/auth/v1/admin/users/${id}`);
    await del(`global_identities?phone_e164=eq.${wa}`);
  }
}

async function siapkan(wa, nama, role, outletRef) {
  const prep = await rpcSvc('account_prepare_identity', { p_wa: wa, p_nama: nama });
  if (!prep.data?.ok) throw new Error(`prepare ${wa}: ${JSON.stringify(prep.data)}`);
  const gid = prep.data.gid;
  gids.push(gid);
  const mk = await req('POST', `${URL}/auth/v1/admin/users`, {
    body: { email: email(wa), password: PIN, email_confirm: true, app_metadata: { gid } },
  });
  const authId = mk.data?.id || (await cariAuth(wa));
  if (!authId) throw new Error(`auth user ${wa} gagal: ${JSON.stringify(mk.data)}`);
  authIds.push(authId);
  await rpcSvc('account_bind_auth_user', { p_gid: gid, p_auth_user_id: authId });
  // outlet_ref unik = isolasi tenant uji. Tanpa ini, owner-owner live yang
  // outlet_ref NULL ikut jadi kandidat ⇒ RPC (benar) menolak 'license_ambiguous'.
  const m = await post('app_memberships', {
    global_identity_id: gid, app_key: APP, role, status: 'active', outlet_ref: outletRef,
  });
  if (m.status >= 300) throw new Error(`membership ${wa}: ${JSON.stringify(m.data)}`);
  return gid;
}

try {
  await bersihkan();
  const ownerGid = await siapkan(WA_OWNER, 'QA B1 Owner', 'owner', TAG + '-OUTLET');
  await siapkan(WA_KASIR, 'QA B1 Kasir', 'kasir', TAG + '-OUTLET');

  // Produk uji = pemegang SATU angka kuota global untuk app 'qab1'.
  const prodIns = await post('products', {
    app_type: APP, kode_produk: PROD_KODE, name: 'QA B1 Global Quota',
    tagline: 'QA', description: 'Produk uji kuota global', price_label: 'Rp 0',
    features: [], icon: '🧪', color: '#000000', order_index: 999,
    visible: false, status: 'development', tx_quota: 0, tutorials: [],
    active: false, max_devices: 1,
  });
  if (prodIns.status >= 300) throw new Error('produk uji: ' + JSON.stringify(prodIns.data));
  const prod = await get(`products?kode_produk=eq.${PROD_KODE}&select=id,max_devices`);
  productId = Array.isArray(prod.data) && prod.data[0]?.id;
  if (!productId) throw new Error('produk uji tidak ditemukan setelah insert');

  const ins = await post('licenses', {
    global_identity_id: ownerGid, product_id: productId, app_type: APP,
    status: 'active', max_devices: 1,
  });
  // Ambil id lewat query (POST tanpa Prefer tidak mengembalikan representasi).
  const cari = await get(`licenses?global_identity_id=eq.${ownerGid}&app_type=eq.${APP}&select=id,max_devices,status`);
  licenseId = Array.isArray(cari.data) && cari.data[0]?.id;
  if (!licenseId) throw new Error(`lisensi uji gagal dibuat: ${JSON.stringify(ins.data)}`);
  // Lisensi KE-2 (akun lain, belum diklaim) → membuktikan satu angka di produk
  // benar-benar berlaku untuk SEMUA akun, bukan cuma akun uji pertama.
  const ins2 = await post('licenses', {
    global_identity_id: null, product_id: productId, app_type: APP,
    status: 'active', max_devices: 1, outlet_ref: null,
  });
  if (ins2.status >= 300) throw new Error('lisensi ke-2: ' + JSON.stringify(ins2.data));

  const hOwner = await login(WA_OWNER);
  const hKasir = await login(WA_KASIR);

  console.log('\n== 1) Owner: lisensi diambil dari AKUN ==');
  const r1 = await myLic(hOwner, DEV(1));
  ok('aktivasi perangkat pertama → ok/activated', r1?.ok === true && r1?.code === 'activated', JSON.stringify(r1));
  ok('license_id = lisensi milik akun', r1?.license_id === licenseId, JSON.stringify(r1?.license_id));
  ok('owner_gid = gid akun owner', r1?.owner_gid === ownerGid, JSON.stringify(r1?.owner_gid));
  ok('role = owner', r1?.role === 'owner', JSON.stringify(r1?.role));
  ok('max_devices dibaca dari kolom (1)', Number(r1?.max_devices) === 1, JSON.stringify(r1?.max_devices));
  ok('bentuk respons kompatibel clients (license_status=aktif)', r1?.license_status === 'aktif', JSON.stringify(r1?.license_status));

  console.log('\n== 2) Idempoten & kuota Control ==');
  const r2 = await myLic(hOwner, DEV(1));
  ok('perangkat sama → already-active', r2?.ok === true && r2?.code === 'already-active', JSON.stringify(r2));
  ok('tidak ada baris perangkat dobel', Number(r2?.active_devices) === 1, JSON.stringify(r2?.active_devices));
  const r3 = await myLic(hOwner, DEV(2));
  ok('max_devices=1 → perangkat ke-2 DITOLAK (device_limit)', r3?.ok === false && r3?.code === 'device_limit', JSON.stringify(r3));
  ok('respons device_limit memuat max_devices=1', Number(r3?.max_devices) === 1, JSON.stringify(r3?.max_devices));

  console.log('\n== 3) Ubah SATU angka di Katalog → semua akun ikut ==');
  await patch(`products?id=eq.${productId}`, { max_devices: 3 });
  const mirror = await get(`licenses?product_id=eq.${productId}&select=id,max_devices,plan`);
  ok('SEMUA lisensi produk itu tersinkron ke 3 (trigger propagasi)',
    Array.isArray(mirror.data) && mirror.data.length >= 2 && mirror.data.every((l) => Number(l.max_devices) === 3),
    JSON.stringify(mirror.data));
  ok('mirror `plan` ikut jadi multi (bukan lagi sumber kebenaran, tapi tidak berbohong)',
    Array.isArray(mirror.data) && mirror.data.every((l) => l.plan === 'multi'),
    JSON.stringify(mirror.data?.map((l) => l.plan)));
  const r4 = await myLic(hOwner, DEV(2));
  ok('max_devices=3 → perangkat ke-2 diizinkan', r4?.ok === true && Number(r4?.active_devices) === 2, JSON.stringify(r4));
  ok('RPC baca products.max_devices (bukan hardcode)', Number(r4?.max_devices) === 3, JSON.stringify(r4?.max_devices));
  // Tulis langsung ke lisensi HARUS ditimpa trigger → tidak ada override per akun.
  await patch(`licenses?id=eq.${licenseId}`, { max_devices: 99 });
  const cegah = await get(`licenses?id=eq.${licenseId}&select=max_devices`);
  ok('tulis manual ke licenses.max_devices DITOLAK trigger (tetap 3)',
    Number(cegah.data?.[0]?.max_devices) === 3, JSON.stringify(cegah.data));

  console.log('\n== 4) Pegawai pakai lisensi milik OWNER ==');
  const r5 = await myLic(hKasir, DEV(3));
  ok('kasir dapat lisensi WALAUPUN tidak punya lisensi sendiri', r5?.ok === true, JSON.stringify(r5));
  ok('owner_gid tetap menunjuk akun owner', r5?.owner_gid === ownerGid, JSON.stringify(r5?.owner_gid));
  ok('role tetap kasir (bukan owner)', r5?.role === 'kasir', JSON.stringify(r5?.role));
  ok('perangkat kasir dihitung di lisensi yang sama', r5?.license_id === licenseId && Number(r5?.active_devices) === 3, JSON.stringify(r5));
  const r6 = await myLic(hKasir, DEV(4));
  ok('perangkat ke-4 DITOLAK saat kuota penuh', r6?.ok === false && r6?.code === 'device_limit', JSON.stringify(r6));

  console.log('\n== 5) Perangkat aktif TIDAK digusur saat kuota diturunkan ==');
  await patch(`products?id=eq.${productId}`, { max_devices: 1 });
  const planTurun = await get(`licenses?product_id=eq.${productId}&select=plan,max_devices`);
  ok('kuota turun ke 1 → mirror `plan` ikut jadi single',
    Array.isArray(planTurun.data) && planTurun.data.length >= 2 && planTurun.data.every((l) => l.plan === 'single' && Number(l.max_devices) === 1),
    JSON.stringify(planTurun.data));
  const r7 = await myLic(hOwner, DEV(1));
  ok('perangkat lama tetap already-active walau max_devices=1 < 3', r7?.ok === true && r7?.code === 'already-active', JSON.stringify(r7));

  console.log('\n== 6) Status lisensi & keamanan ==');
  await patch(`licenses?id=eq.${licenseId}`, { status: 'revoked' });
  const r8 = await myLic(hOwner, DEV(1));
  ok('lisensi revoked → license_revoked', r8?.ok === false && r8?.code === 'license_revoked', JSON.stringify(r8));
  await patch(`licenses?id=eq.${licenseId}`, { status: 'active', expires_at: '2020-01-01T00:00:00Z' });
  const r9 = await myLic(hOwner, DEV(1));
  ok('lisensi expired → license_expired', r9?.ok === false && r9?.code === 'license_expired', JSON.stringify(r9));
  const anon = await post('rpc/app_my_license', {
    p_app_key: APP, p_device_code: DEV(9), p_device_label: 'QA',
  }, { apikey: ANON, Authorization: `Bearer ${ANON}` });
  ok('anon TIDAK boleh memanggil RPC (grant authenticated only)',
    anon.status === 401 || anon.status === 403 || /permission denied|JWT|not_signed_in/i.test(JSON.stringify(anon.data)),
    `${anon.status} ${JSON.stringify(anon.data)}`);

  // Kembalikan supaya cleanup tidak menyisakan status aneh bila ada kegagalan.
  await patch(`licenses?id=eq.${licenseId}`, { status: 'active', expires_at: null });
} catch (e) {
  fail++;
  console.error('❌ ERROR:', e.message);
} finally {
  console.log('\n== Cleanup + verifikasi mandiri ==');
  await bersihkan();
  const sisa = {
    devices: await get(`license_devices?device_code=like.${TAG}*&select=id`),
    licenses: await get(`licenses?id=eq.${licenseId || '00000000-0000-0000-0000-000000000000'}&select=id`),
    identities: await get(`global_identities?phone_e164=in.(${WAS.join(',')})&select=id`),
    products: await get(`products?kode_produk=eq.${PROD_KODE}&select=id`),
  };
  const kosong = (x) => Array.isArray(x?.data) && x.data.length === 0;
  ok('tidak ada sisa perangkat uji', kosong(sisa.devices), JSON.stringify(sisa.devices?.data));
  ok('tidak ada sisa lisensi uji', kosong(sisa.licenses), JSON.stringify(sisa.licenses?.data));
  ok('tidak ada sisa identitas uji', kosong(sisa.identities), JSON.stringify(sisa.identities?.data));
  ok('tidak ada sisa produk uji', kosong(sisa.products), JSON.stringify(sisa.products?.data));
  const users = await req('GET', `${URL}/auth/v1/admin/users?per_page=200`);
  const sisaAuth = (users.data?.users || []).filter((u) => WAS.some((w) => u.email === email(w)));
  ok('tidak ada sisa auth user uji', sisaAuth.length === 0, JSON.stringify(sisaAuth.map((u) => u.email)));
  console.log(`\n=== HASIL: ${pass} PASS / ${fail} FAIL ===`);
  process.exitCode = fail ? 1 : 0;
}
