#!/usr/bin/env node
/**
 * _qa-masjid-sync-e2e.mjs — fixture QA untuk uji SINKRON CLOUD + OFFLINE app Masjid.
 *
 *   node supabase/_qa-masjid-sync-e2e.mjs setup     → buat akun + situs QA
 *   node supabase/_qa-masjid-sync-e2e.mjs cleanup   → hapus SEMUA jejak QA
 *   node supabase/_qa-masjid-sync-e2e.mjs status    → cek sisa data QA
 *
 * Data uji (terisolasi, tidak menyentuh data live):
 *   WA 628990020202 · PIN 123456 · slug `qa-sync-e2e` · nama "QA Sinkron E2E"
 *
 * Cara kerja: memakai jalur RESMI app — `masjid_ensure_site` yang otomatis membuat
 * outlet + membership owner + lisensi masjid + situs + token publish. Tidak ada
 * insert manual ke tabel produksi.
 *
 * Semua operasi memakai service_role / sesi akun uji. Kunci TIDAK pernah dicetak.
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

// Kunci publik (anon) dibaca dari web-masjid — sama seperti skrip audit HTTP.
const webHtml = fs.readFileSync(path.join(ROOT, 'masjid', 'web-masjid', 'index.html'), 'utf8');
const keyM = webHtml.match(/const\s+SUPABASE_ANON_KEY\s*=\s*'([^']+)'/);
if (!keyM) { console.error('GAGAL: SUPABASE_ANON_KEY tidak ditemukan di web-masjid/index.html'); process.exit(1); }
const KEY = keyM[1];

const HS = { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' };
const WA = '628990020202';
const PIN = '123456';
const SLUG = 'qa-sync-e2e';
const NAMA = 'QA Sinkron E2E';
const email = `${WA}@accounts.kasirsolo.local`;

async function req(method, pathname, { headers = HS, body } = {}) {
  const r = await fetch(URL_BASE + pathname, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const t = await r.text();
  let data; try { data = t ? JSON.parse(t) : null; } catch { data = t; }
  return { status: r.status, data };
}
const get = (p) => req('GET', `/rest/v1/${p}`);
const del = (p) => req('DELETE', `/rest/v1/${p}`);
const post = (p, b) => req('POST', `/rest/v1/${p}`, b);

async function cariAuthId() {
  const u = await req('GET', '/auth/v1/admin/users?per_page=200');
  return (u.data?.users || []).find((x) => x.email === email)?.id || null;
}
async function gidQa() {
  const g = await get(`global_identities?phone_e164=eq.${WA}&select=id`);
  return g.data?.[0]?.id || null;
}

async function cleanup() {
  const jejak = [];
  const gid = await gidQa();
  // 1. record sinkron + website + situs milik slug QA
  jejak.push(['masjid_records', (await del(`masjid_records?site_slug=eq.${SLUG}`)).status]);
  jejak.push(['masjid_website', (await del(`masjid_website?slug=eq.${SLUG}`)).status]);
  const sites = await get(`masjid_sites?slug=eq.${SLUG}&select=id`);
  for (const s of (Array.isArray(sites.data) ? sites.data : [])) {
    await del(`masjid_website_domains?site_id=eq.${s.id}`);
    await del(`masjid_publish_tokens?site_id=eq.${s.id}`);
  }
  jejak.push(['masjid_sites', (await del(`masjid_sites?slug=eq.${SLUG}`)).status]);
  jejak.push(['masjid_publish_tokens(slug)', (await del(`masjid_publish_tokens?slug=eq.${SLUG}`)).status]);
  // 2. lisensi + perangkat + membership + outlet milik akun QA
  if (gid) {
    const lics = await get(`licenses?global_identity_id=eq.${gid}&select=id`);
    for (const l of (Array.isArray(lics.data) ? lics.data : [])) {
      await del(`license_devices?license_id=eq.${l.id}`);
    }
    jejak.push(['licenses', (await del(`licenses?global_identity_id=eq.${gid}`)).status]);
    jejak.push(['app_memberships', (await del(`app_memberships?global_identity_id=eq.${gid}`)).status]);
    jejak.push(['app_outlets', (await del(`app_outlets?owner_gid=eq.${gid}`)).status]);
    jejak.push(['global_identities', (await del(`global_identities?phone_e164=eq.${WA}`)).status]);
  }
  // 3. auth user
  const aid = await cariAuthId();
  if (aid) await req('DELETE', `/auth/v1/admin/users/${aid}`);
  return jejak;
}

async function status() {
  const gid = await gidQa();
  const out = { gid, slug: SLUG };
  out.situs = (await get(`masjid_sites?slug=eq.${SLUG}&select=id,slug,nama`)).data?.length ?? -1;
  out.membership = gid ? (await get(`app_memberships?global_identity_id=eq.${gid}&app_key=eq.masjid&select=id`)).data?.length ?? -1 : -1;
  out.lisensi = gid ? (await get(`licenses?global_identity_id=eq.${gid}&app_type=eq.masjid&select=id`)).data?.length ?? -1 : -1;
  out.record = (await get(`masjid_records?site_slug=eq.${SLUG}&select=id`)).data?.length ?? -1;
  out.auth = (await cariAuthId()) ? 1 : 0;
  return out;
}

const mode = process.argv[2] || 'setup';
try {
  if (mode === 'cleanup') {
    const jejak = await cleanup();
    console.log('CLEANUP: ' + jejak.map(([n, s]) => `${n}=${s}`).join(' '));
  } else if (mode === 'status') {
    console.log('STATUS: ' + JSON.stringify(await status()));
  } else {
    await cleanup();
    /* CATATAN (dikoreksi 2026-11-20): RPC `account_prepare_identity` /
       `account_bind_auth_user` BISSA dipanggil lewat PostgREST dengan
       service_role — hipotesis lama "hanya di-grant ke service_role → tidak
       masuk schema cache → PGRST202" proved SALAH (bukti:
       supabase/_qa-rpc-pgrst202-proof.mjs + _qa-rpc-signature-resolve.mjs).
       PGRST202 muncul bila NAMA ARGUMEN meleset dari signature, bukan karena
       grant. Karena itu fixture ini tetap memakai insert REST langsung
       (deterministik, idempoten, mudah dibersihkan) — bukan karena RPC
       tidak bisa dipanggil. Semua kolom ini resmi server-only; service_role
       memang boleh. */
    const gid = crypto.randomUUID();
    const HSR = { ...HS, Prefer: 'return=representation' };
    const ident = await req('POST', '/rest/v1/global_identities', {
      headers: HSR,
      body: {
        id: gid, phone_e164: WA, display_name: NAMA, status: 'active',
        phone_verified_at: new Date().toISOString(), auth_user_id: null,
      },
    });
    if (ident.status >= 300) throw new Error('identity: ' + JSON.stringify(ident.data));

    const mk = await req('POST', '/auth/v1/admin/users', {
      headers: HS,
      body: { email, password: PIN, email_confirm: true, app_metadata: { gid } },
    });
    const authId = mk.data?.id || (await cariAuthId());
    if (!authId) throw new Error('auth user: ' + JSON.stringify(mk.data));

    const bind = await req('PATCH', `/rest/v1/global_identities?id=eq.${gid}`, {
      headers: HS,
      body: { auth_user_id: authId },
    });
    if (bind.status >= 300) throw new Error('bind auth_user_id: ' + JSON.stringify(bind.data));

    // Login seperti app (WA + PIN) → token sesi untuk jalur ensure_site.
    const login = await req('POST', '/auth/v1/token?grant_type=password', {
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: { email, password: PIN },
    });
    const token = login.data?.access_token;
    if (!token) throw new Error('login: ' + JSON.stringify(login.data));

    const site = await req('POST', '/rest/v1/rpc/masjid_ensure_site', {
      headers: { apikey: KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: { p_slug: SLUG, p_nama: NAMA },
    });
    if (!site.data?.ok) throw new Error('ensure_site: ' + JSON.stringify(site.data));

    console.log('SETUP OK  wa=' + WA + '  pin=' + PIN + '  gid=' + gid +
      '  slug=' + site.data.slug + '  outlet=' + site.data.outlet_id + '  site_id=' + site.data.site_id);
    console.log('STATUS: ' + JSON.stringify(await status()));
  }
} catch (e) {
  console.error('GAGAL:', e.message);
  process.exitCode = 1;
}
