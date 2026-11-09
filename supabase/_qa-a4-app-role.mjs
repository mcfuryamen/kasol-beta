#!/usr/bin/env node
/**
 * QA Fase A4 — uji RPC multi-role (app_*) end-to-end.
 * Membuat 2 akun uji (owner + kasir) via service_role, login, lalu uji otorisasi.
 * SELF-CLEANUP: menghapus app_memberships, global_identities, auth users uji.
 *
 * Jalankan:  node supabase/_qa-a4-app-role.mjs
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
const ANON = env.SUPABASE_ANON_KEY;
const SVC = env.SUPABASE_SERVICE_ROLE_KEY;
const APP = 'kaki5';
const WA_OWNER = '628990000001';
const WA_STAFF = '628990000002';
const PIN = '123456';
const email = (wa) => `${wa}@accounts.kasirsolo.local`;

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  PASS  ${name}`); }
  else { fail++; console.log(`  FAIL  ${name} ${extra}`); }
};

async function req(method, url, { apikey, bearer, body } = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      apikey: apikey || SVC,
      Authorization: `Bearer ${bearer || apikey || SVC}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}
const rpcSvc = (fn, args) => req('POST', `${URL}/rest/v1/rpc/${fn}`, { body: args });
const rpcUser = (fn, args, jwt) => req('POST', `${URL}/rest/v1/rpc/${fn}`, { apikey: ANON, bearer: jwt, body: args });

async function siapkanAkun(wa, nama) {
  const prep = await rpcSvc('account_prepare_identity', { p_wa: wa, p_nama: nama });
  if (!prep.data?.ok) throw new Error(`prepare ${wa}: ${JSON.stringify(prep.data)}`);
  const gid = prep.data.gid;
  const mk = await req('POST', `${URL}/auth/v1/admin/users`, {
    body: { email: email(wa), password: PIN, email_confirm: true, app_metadata: { gid } },
  });
  let authId = mk.data?.id || null;
  if (!authId) {
    const list = await req('GET', `${URL}/auth/v1/admin/users?per_page=200`);
    authId = (list.data?.users || []).find((u) => u.email === email(wa))?.id || null;
  }
  if (!authId) throw new Error(`auth user ${wa} gagal dibuat`);
  await rpcSvc('account_bind_auth_user', { p_gid: gid, p_auth_user_id: authId });
  const tok = await req('POST', `${URL}/auth/v1/token?grant_type=password`, {
    apikey: ANON, bearer: ANON, body: { email: email(wa), password: PIN },
  });
  if (!tok.data?.access_token) throw new Error(`login ${wa} gagal: ${JSON.stringify(tok.data)}`);
  return { gid, authId, jwt: tok.data.access_token };
}

async function hapusAkun({ gid, authId }) {
  await req('DELETE', `${URL}/rest/v1/app_memberships?global_identity_id=eq.${gid}`);
  await req('DELETE', `${URL}/rest/v1/global_identities?id=eq.${gid}`);
  if (authId) await req('DELETE', `${URL}/auth/v1/admin/users/${authId}`);
}

const cariAuth = async (wa) => {
  const u = await req('GET', `${URL}/auth/v1/admin/users?per_page=200`);
  return (u.data?.users || []).find((x) => x.email === email(wa))?.id || null;
};

let A = null, B = null, memA = null, memB = null;
try {
  console.log('\n== Bersihkan sisa uji lama ==');
  for (const wa of [WA_OWNER, WA_STAFF]) {
    const g = await req('GET', `${URL}/rest/v1/global_identities?phone_e164=eq.${wa}&select=id`);
    for (const row of g.data || []) await hapusAkun({ gid: row.id, authId: await cariAuth(wa) });
  }

  console.log('== Siapkan 2 akun uji ==');
  A = await siapkanAkun(WA_OWNER, 'QA Owner');
  B = await siapkanAkun(WA_STAFF, 'QA Staf');
  ok('akun uji terbuat (gid owner & staf)', !!A.gid && !!B.gid);

  console.log('== Owner: has_access awal false, lalu auto-manage ==');
  let acc = await rpcUser('app_my_access', { p_app_key: APP }, A.jwt);
  ok('owner awal: has_access=false (belum ada membership)', acc.data?.ok === true && acc.data?.has_access === false, JSON.stringify(acc.data));
  memA = null;
  await req('POST', `${URL}/rest/v1/app_memberships`, {
    body: { global_identity_id: A.gid, app_key: APP, role: 'owner', status: 'active' },
  });
  memA = (await req('GET', `${URL}/rest/v1/app_memberships?global_identity_id=eq.${A.gid}&app_key=eq.${APP}&select=id,role`)).data?.[0];
  acc = await rpcUser('app_my_access', { p_app_key: APP }, A.jwt);
  ok('owner setelah membership: role=owner', acc.data?.role === 'owner' && acc.data?.has_access === true, JSON.stringify(acc.data));

  console.log('== Owner tambah pegawai ==');
  const add = await rpcUser('app_add_member', { p_app_key: APP, p_wa: WA_STAFF, p_role: 'kasir', p_nama: 'QA Staf' }, A.jwt);
  ok('app_add_member ok + role kasir', add.data?.ok === true && add.data?.role === 'kasir', JSON.stringify(add.data));
  memB = (await req('GET', `${URL}/rest/v1/app_memberships?global_identity_id=eq.${B.gid}&app_key=eq.${APP}&select=id,role`)).data?.[0];

  const list = await rpcUser('app_list_members', { p_app_key: APP }, A.jwt);
  ok('app_list_members → 2 anggota', list.data?.ok === true && Array.isArray(list.data.members) && list.data.members.length === 2, JSON.stringify(list.data));

  console.log('== Staf (kasir) tidak boleh kelola ==');
  const accB = await rpcUser('app_my_access', { p_app_key: APP }, B.jwt);
  ok('staf: role=kasir', accB.data?.role === 'kasir', JSON.stringify(accB.data));
  const fList = await rpcUser('app_list_members', { p_app_key: APP }, B.jwt);
  ok('kasir app_list_members → forbidden', fList.data?.ok === false && fList.data?.code === 'forbidden', JSON.stringify(fList.data));
  const fAdd = await rpcUser('app_add_member', { p_app_key: APP, p_wa: '628990000003', p_role: 'kasir', p_nama: 'X' }, B.jwt);
  ok('kasir app_add_member → forbidden', fAdd.data?.ok === false && fAdd.data?.code === 'forbidden', JSON.stringify(fAdd.data));

  console.log('== Proteksi owner terakhir & ubah role ==');
  const demoteSelf = await rpcUser('app_set_member_role', { p_member_id: memA.id, p_role: 'kasir' }, A.jwt);
  ok('turunkan owner terakhir → last_owner', demoteSelf.data?.ok === false && demoteSelf.data?.code === 'last_owner', JSON.stringify(demoteSelf.data));
  const upB = await rpcUser('app_set_member_role', { p_member_id: memB.id, p_role: 'manajer' }, A.jwt);
  ok('ubah staf → manajer ok', upB.data?.ok === true && upB.data?.role === 'manajer', JSON.stringify(upB.data));
  const delB = await rpcUser('app_remove_member', { p_member_id: memB.id }, A.jwt);
  ok('hapus staf ok', delB.data?.ok === true, JSON.stringify(delB.data));
  const delSelf = await rpcUser('app_remove_member', { p_member_id: memA.id }, A.jwt);
  ok('hapus owner terakhir → last_owner', delSelf.data?.ok === false && delSelf.data?.code === 'last_owner', JSON.stringify(delSelf.data));

  console.log('== Anon (tanpa sesi) ditolak ==');
  const anonAcc = await req('POST', `${URL}/rest/v1/rpc/app_my_access`, { apikey: ANON, bearer: ANON, body: { p_app_key: APP } });
  const anonD = anonAcc.data;
  ok('anon app_my_access ditolak (permission/SQLSTATE 42501)',
     anonAcc.status === 401 || anonAcc.status === 403 || anonD?.code === 'not_signed_in' || anonD?.code === '42501',
     JSON.stringify(anonD));
} catch (e) {
  fail++;
  console.error('❌ ERROR:', e.message);
} finally {
  console.log('\n== Cleanup ==');
  if (A) await hapusAkun(A);
  if (B) await hapusAkun(B);
  console.log(`\n=== HASIL: ${pass} PASS / ${fail} FAIL ===`);
  process.exitCode = fail ? 1 : 0;
}
