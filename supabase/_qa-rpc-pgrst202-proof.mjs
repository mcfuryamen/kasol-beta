#!/usr/bin/env node
/**
 * _qa-rpc-pgrst202-proof.mjs — BUKTI mekanisme PGRST202.
 *
 * Hipotesis lama (SALAH): "fungsi service_role-only tidak masuk schema cache
 * → PGRST202". Test ini membuktikannya salah:
 *   1. service_role-only + nama argumen BENAR → dipanggil normal (200).
 *   2. fungsi yang ADA di grant anon + nama argumen SALAH → PGRST202 juga.
 *
 * Jadi PGRST202 = signature/argumen tidak cocok, BUKAN soal grant.
 *
 * READ-ONLY: semua probe memakai argumen yang tidak menulis data.
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
  try { const j = JSON.parse(t); code = j.code || j.error || ''; msg = j.reason || j.hint || j.message || ''; } catch { msg = t.slice(0, 90); }
  return { status: r.status, code, msg };
}

const rows = [
  ['svc-only + arg BENAR', 'account_prepare_identity', { p_wa: '1', p_nama: 'x' }],
  ['svc-only + arg SALAH', 'account_prepare_identity', { wa: '1', nama: 'x' }],
  ['svc-only + body KOSONG', 'account_prepare_identity', {}],
  ['anon-granted + arg BENAR', 'app_feature_gate', { p_app: 'kaki5' }],
  ['anon-granted + arg SALAH', 'app_feature_gate', { app: 'kaki5' }],
];

console.log('skenario'.padEnd(28), 'fungsi'.padEnd(28), 'HTTP', 'hasil');
console.log('-'.repeat(100));
for (const [label, fn, body] of rows) {
  const r = await post(fn, body);
  console.log(label.padEnd(28), fn.padEnd(28), String(r.status).padEnd(5), `${r.code} ${r.msg}`.slice(0, 44));
}
