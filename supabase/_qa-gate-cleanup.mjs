#!/usr/bin/env node
/**
 * QA gerbang login kaki5 — hapus akun uji yang dibuat _qa-gate-setup.mjs.
 * Jalankan: node supabase/_qa-gate-cleanup.mjs
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
const WAs = ['628990010001', '628990010002'];
const email = (wa) => `${wa}@accounts.kasirsolo.local`;

async function req(method, url) {
  const res = await fetch(url, {
    method,
    headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' },
  });
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}

const users = await req('GET', `${URL}/auth/v1/admin/users?per_page=200`);
const all = users.data?.users || [];
let n = 0, g = 0;
for (const wa of WAs) {
  const u = all.find((x) => x.email === email(wa));
  if (u) { await req('DELETE', `${URL}/auth/v1/admin/users/${u.id}`); n++; }
  // Nama kolom nomor di global_identities = `phone_e164` (BUKAN `wa`).
  const gi = await req('GET', `${URL}/rest/v1/global_identities?phone_e164=eq.${wa}&select=id`);
  const gid = gi.data?.[0]?.id;
  if (gid) {
    await req('DELETE', `${URL}/rest/v1/app_memberships?global_identity_id=eq.${gid}`);
    await req('DELETE', `${URL}/rest/v1/global_identities?id=eq.${gid}`);
    g++;
  }
}
// Verifikasi DIBATASI ke WA uji kita. PENTING: `app_memberships` juga berisi
// data akun NYATA (mis. hasil uji manual pemilik) — menghitungnya global bikin
// alarm palsu "tidak bersih" dan menggoda kita menghapus data orang lain.
const sisaU = await req('GET', `${URL}/auth/v1/admin/users?per_page=200`);
const sisaAuth = (sisaU.data?.users || []).filter((x) => WAs.some((w) => x.email === email(w))).length;
let sisaGi = 0, sisaMem = 0;
for (const wa of WAs) {
  const gi = await req('GET', `${URL}/rest/v1/global_identities?phone_e164=eq.${wa}&select=id`);
  const ids = (gi.data || []).map((r) => r.id);
  sisaGi += ids.length;
  for (const id of ids) {
    const mm = await req('GET', `${URL}/rest/v1/app_memberships?global_identity_id=eq.${id}&select=id`);
    sisaMem += (mm.data || []).length;
  }
}
console.log(`CLEANUP — ${n} auth user dihapus, ${g} identitas dihapus`);
console.log(`VERIFIKASI (hanya WA uji) — auth:${sisaAuth} identitas:${sisaGi} membership:${sisaMem}`);
if (sisaAuth || sisaGi || sisaMem) process.exitCode = 1;
