#!/usr/bin/env node
/**
 * Fixture uji BROWSER Fase B1 — 1 akun owner + 1 lisensi aktif (max_devices=2).
 *   node supabase/_qa-b1-browser-fixture.mjs setup
 *   node supabase/_qa-b1-browser-fixture.mjs cleanup
 * WA 628990020201 · PIN 123456. Cleanup terverifikasi mandiri.
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
const H = { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' };
const WA = '628990020201';
const PIN = '123456';
const OUTLET = 'QA-B1-BROWSER-OUTLET';
const PROD_KODE = 'QACTL';   // produk uji → kuota global TERPISAH dari kaki5 live
const email = `${WA}@accounts.kasirsolo.local`;

async function req(method, url, body) {
  const r = await fetch(url, { method, headers: H, body: body === undefined ? undefined : JSON.stringify(body) });
  const t = await r.text();
  let data; try { data = t ? JSON.parse(t) : null; } catch { data = t; }
  return { status: r.status, data };
}
const get = (p) => req('GET', `${URL}/rest/v1/${p}`);
const del = (p) => req('DELETE', `${URL}/rest/v1/${p}`);
const post = (p, b) => req('POST', `${URL}/rest/v1/${p}`, b);

async function cariAuth() {
  const u = await req('GET', `${URL}/auth/v1/admin/users?per_page=200`);
  return (u.data?.users || []).find((x) => x.email === email)?.id || null;
}

async function cleanup() {
  // Hapus lisensi + perangkat yang memakai produk uji DULU (FK RESTRICT),
  // baru produk ujinya. Tidak pernah menyentuh produk kaki5/rosok sungguhan.
  const pr = await get(`products?kode_produk=eq.${PROD_KODE}&select=id`);
  for (const p of (Array.isArray(pr.data) ? pr.data : [])) {
    const ls = await get(`licenses?product_id=eq.${p.id}&select=id`);
    for (const l of (Array.isArray(ls.data) ? ls.data : [])) await del(`license_devices?license_id=eq.${l.id}`);
    await del(`licenses?product_id=eq.${p.id}`);
    await del(`products?id=eq.${p.id}`);
  }
  const g = await get(`global_identities?phone_e164=eq.${WA}&select=id`);
  for (const row of (Array.isArray(g.data) ? g.data : [])) {
    const ls = await get(`licenses?global_identity_id=eq.${row.id}&select=id`);
    for (const l of (Array.isArray(ls.data) ? ls.data : [])) await del(`license_devices?license_id=eq.${l.id}`);
    await del(`licenses?global_identity_id=eq.${row.id}`);
    await del(`app_memberships?global_identity_id=eq.${row.id}`);
  }
  const id = await cariAuth();
  if (id) await req('DELETE', `${URL}/auth/v1/admin/users/${id}`);
  await del(`global_identities?phone_e164=eq.${WA}`);
}

const mode = process.argv[2] || 'setup';
try {
  await cleanup();   // idempoten: selalu mulai dari state bersih
  if (mode === 'setup') {
    const prep = await post('rpc/account_prepare_identity', { p_wa: WA, p_nama: 'QA B1 Browser' });
    if (!prep.data?.ok) throw new Error('prepare: ' + JSON.stringify(prep.data));
    const gid = prep.data.gid;
    const mk = await req('POST', `${URL}/auth/v1/admin/users`, {
      email, password: PIN, email_confirm: true, app_metadata: { gid },
    });
    const authId = mk.data?.id || (await cariAuth());
    if (!authId) throw new Error('auth user: ' + JSON.stringify(mk.data));
    await post('rpc/account_bind_auth_user', { p_gid: gid, p_auth_user_id: authId });
    const m = await post('app_memberships', {
      global_identity_id: gid, app_key: 'kaki5', role: 'owner', status: 'active', outlet_ref: OUTLET,
    });
    if (m.status >= 300) throw new Error('membership: ' + JSON.stringify(m.data));
    // Produk uji dengan app_type kaki5 supaya label Control tetap "Kasir Kaki5",
    // TAPI kuotanya berdiri sendiri (tidak mengubah angka kaki5 live).
    const pi = await post('products', {
      app_type: 'kaki5', kode_produk: PROD_KODE, name: 'QA CTL — Kuota Global',
      tagline: 'QA', description: 'Produk uji kuota global perangkat', price_label: 'Rp 0',
      features: [], icon: '🧪', color: '#000000', order_index: 999,
      visible: false, status: 'development', tx_quota: 0, tutorials: [],
      active: false, max_devices: 2,
    });
    if (pi.status >= 300) throw new Error('produk uji: ' + JSON.stringify(pi.data));
    const prod = await get(`products?kode_produk=eq.${PROD_KODE}&select=id`);
    const productId = prod.data?.[0]?.id;
    if (!productId) throw new Error('produk uji tidak ada setelah insert');
    const lic = await post('licenses', {
      global_identity_id: gid, product_id: productId, app_type: 'kaki5',
      status: 'active', max_devices: 2,
    });
    if (lic.status >= 300) throw new Error('lisensi: ' + JSON.stringify(lic.data));
    const ls = await get(`licenses?global_identity_id=eq.${gid}&app_type=eq.kaki5&select=id`);
    const licenseId = ls.data?.[0]?.id;
    if (!licenseId) throw new Error('id lisensi tidak ketemu');
    // 2 perangkat AKTIF → Control punya objek untuk diuji tombol ✕ / ↺.
    for (const n of [1, 2]) {
      const d = await post('license_devices', {
        license_id: licenseId,
        device_code: `QA-B1-CTL-${n}`,
        device_label: `Perangkat Uji ${n}`,
        status: 'active',
        serial: `KAKI5-HUB-QACTL${n}`,
      });
      if (d.status >= 300) throw new Error('device: ' + JSON.stringify(d.data));
    }
    console.log('SETUP OK  wa=' + WA + '  pin=' + PIN + '  gid=' + gid + '  license=' + licenseId);
  } else {
    console.log('CLEANUP dijalankan');
  }
} catch (e) {
  console.error('GAGAL:', e.message);
  process.exitCode = 1;
} finally {
  if (mode !== 'setup') {
    const g = await get(`global_identities?phone_e164=eq.${WA}&select=id`);
    const users = await req('GET', `${URL}/auth/v1/admin/users?per_page=200`);
    const sisaAuth = (users.data?.users || []).filter((u) => u.email === email).length;
    const pr = await get(`products?kode_produk=eq.${PROD_KODE}&select=id`);
    const sisaProd = Array.isArray(pr.data) ? pr.data.length : -1;
    const bersih = Array.isArray(g.data) && g.data.length === 0 && sisaAuth === 0 && sisaProd === 0;
    console.log('VERIFIKASI BERSIH: ' + (bersih ? 'YA' : 'TIDAK') + ` (identitas=${JSON.stringify(g.data)}, auth=${sisaAuth}, produk=${sisaProd})`);
    if (!bersih) process.exitCode = 1;
  }
}
