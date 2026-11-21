#!/usr/bin/env node
/**
 * _qa-edge-account-register.mjs — uji status deploy Edge Function `account-register`.
 *
 * READ-ONLY & AMAN: memakai WA yang SUDAH terdaftar lengkap (auth_user_id terisi).
 * account_prepare_identity → balas 'already_registered' TANPA menulis apa pun.
 * Jadi tidak ada akun/identitas baru yang dibuat.
 *
 * Uji:
 *   A. OPTIONS preflight (CORS) → cek apakah whitelist Origin sudah ter-deploy.
 *   B. POST dengan Origin yang DIIZINKAN → cek RPC service_role jalan (expect 409).
 *   C. POST dengan Origin ASING    → cek guard Origin server-side (expect 403
 *      bila versi terbaru ter-deploy; 409 bila versi lama tanpa guard).
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

// Kunci publik (anon) dibaca dari web-masjid — sama seperti skrip audit HTTP.
const webHtml = fs.readFileSync(path.join(ROOT, 'masjid', 'web-masjid', 'index.html'), 'utf8');
const keyM = webHtml.match(/const\s+SUPABASE_ANON_KEY\s*=\s*'([^']+)'/);
if (!keyM) { console.error('GAGAL: SUPABASE_ANON_KEY tidak ditemukan'); process.exit(1); }
const KEY = keyM[1];

const FN = `${URL_BASE}/functions/v1/account-register`;
// WA SUDAH terdaftar (punya auth_user_id) → prepare_identity balas already_registered, tanpa write.
const WA = '62823251033366';
const BODY = { wa: WA, pin: '123456', nama: 'Probe Deploy' };

async function call(method, origin) {
  const h = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
  if (origin) h.Origin = origin;
  const r = await fetch(FN, { method, headers: h, body: method === 'POST' ? JSON.stringify(BODY) : undefined });
  const t = await r.text();
  let code = '', msg = '';
  try { const j = JSON.parse(t); code = j.code || j.error || ''; msg = j.reason || j.message || ''; } catch { msg = t.slice(0, 100); }
  return {
    status: r.status, code, msg,
    allowOrigin: r.headers.get('access-control-allow-origin'),
    vary: r.headers.get('vary'),
  };
}

console.log('=== A. OPTIONS preflight (Origin diizinkan: http://localhost:8092) ===');
const a = await call('OPTIONS', 'http://localhost:8092');
console.log(`HTTP ${a.status} | allow-origin=${a.allowOrigin ?? '(kosong)'} | vary=${a.vary ?? '-'}`);

console.log('\n=== A2. OPTIONS preflight (Origin asing: https://evil.example) ===');
const a2 = await call('OPTIONS', 'https://evil.example');
console.log(`HTTP ${a2.status} | allow-origin=${a2.allowOrigin ?? '(kosong)'} | vary=${a2.vary ?? '-'}`);

console.log('\n=== B. POST Origin diizinkan (expect 409 already_registered = RPC service_role JALAN) ===');
const b = await call('POST', 'http://localhost:8092');
console.log(`HTTP ${b.status} | code=${b.code || '-'} | ${b.msg}`);

console.log('\n=== C. POST Origin asing (expect 403 origin_not_allowed bila guard ter-deploy) ===');
const c = await call('POST', 'https://evil.example');
console.log(`HTTP ${c.status} | code=${c.code || '-'} | ${c.msg}`);

console.log('\n=== D. POST tanpa Origin (server-to-server; expect 409 = jalur Control tetap boleh) ===');
const d = await call('POST', null);
console.log(`HTTP ${d.status} | code=${d.code || '-'} | ${d.msg}`);
