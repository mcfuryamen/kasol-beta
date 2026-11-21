#!/usr/bin/env node
/**
 * QA gerbang login kaki5 — siapkan 2 akun uji via service_role.
 *   owner : 628990010001 / PIN 123456  (role owner)
 *   kasir : 628990010002 / PIN 123456  (role kasir)
 * Jalankan  : node supabase/_qa-gate-setup.mjs
 * Bersihkan : node supabase/_qa-gate-cleanup.mjs
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
const APP = 'kaki5';
const PIN = '123456';
const email = (wa) => `${wa}@accounts.kasirsolo.local`;

async function req(method, url, { body } = {}) {
  const res = await fetch(url, {
    method,
    headers: { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}
const rpcSvc = (fn, args) => req('POST', `${URL}/rest/v1/rpc/${fn}`, { body: args });

async function cariAuth(wa) {
  const u = await req('GET', `${URL}/auth/v1/admin/users?per_page=200`);
  return (u.data?.users || []).find((x) => x.email === email(wa))?.id || null;
}

async function siapkan(wa, nama, role) {
  const prep = await rpcSvc('account_prepare_identity', { p_wa: wa, p_nama: nama });
  if (!prep.data?.ok) throw new Error(`prepare ${wa}: ${JSON.stringify(prep.data)}`);
  const gid = prep.data.gid;
  const mk = await req('POST', `${URL}/auth/v1/admin/users`, {
    body: { email: email(wa), password: PIN, email_confirm: true, app_metadata: { gid } },
  });
  let authId = mk.data?.id || (await cariAuth(wa));
  if (!authId) throw new Error(`auth user ${wa} gagal dibuat`);
  await rpcSvc('account_bind_auth_user', { p_gid: gid, p_auth_user_id: authId });
  await req('DELETE', `${URL}/rest/v1/app_memberships?global_identity_id=eq.${gid}`);
  const ins = await req('POST', `${URL}/rest/v1/app_memberships`, {
    body: { global_identity_id: gid, app_key: APP, role, status: 'active' },
  });
  if (ins.status >= 300) throw new Error(`membership ${wa}: ${JSON.stringify(ins.data)}`);
  return { wa, gid, authId, role };
}

try {
  const a = await siapkan('628990010001', 'QA Owner Gerbang', 'owner');
  const b = await siapkan('628990010002', 'QA Kasir Gerbang', 'kasir');
  console.log('SETUP OK');
  console.log(JSON.stringify({ owner: a, kasir: b }, null, 2));
} catch (e) {
  console.error('SETUP GAGAL:', e.message);
  process.exitCode = 1;
}
