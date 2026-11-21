#!/usr/bin/env node
/**
 * http-rpc-check.mjs — bukti level HTTP (PostgREST) untuk F1 & F3.
 *
 * Membaca SUPABASE_URL + anon key dari masjid/web-masjid/index.html
 * (key TIDAK pernah dicetak), lalu menguji:
 *   1) anon TIDAK boleh memanggil masjid_claim_domain  (F3)
 *   2) anon TIDAK boleh memanggil masjid_verify_domain (F3)
 *   3) anon TIDAK boleh memanggil masjid_reclaim_domain(F3)
 *   4) anon BOLEH memanggil masjid_resolve_domain, dan host platform
 *      MUSTAHIL di-resolve                                        (F1)
 *   5) domain klien yang sah tetap resolve正常 (tidak ada regresi)
 *
 * Usage: node masjid/_qa/http-rpc-check.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const html = fs.readFileSync(path.join(ROOT, 'masjid', 'web-masjid', 'index.html'), 'utf8');

const urlM = html.match(/const\s+SUPABASE_URL\s*=\s*'([^']+)'/);
const keyM = html.match(/const\s+SUPABASE_ANON_KEY\s*=\s*'([^']+)'/);
if (!urlM || !keyM) {
  console.error('❌ SUPABASE_URL / SUPABASE_ANON_KEY tidak ditemukan di web-masjid/index.html');
  process.exit(1);
}
const SB = urlM[1];
const KEY = keyM[1];

async function call(rpcName, payload) {
  try {
    const res = await fetch(`${SB}/rest/v1/rpc/${rpcName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: KEY },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    let body = text;
    try { body = JSON.parse(text); } catch { /* body bukan JSON */ }
    return { status: res.status, body };
  } catch (e) {
    return { status: 0, body: String(e && e.message ? e.message : e) };
  }
}

const results = [];
function push(name, expect, actual) {
  const ok = expect === actual;
  results.push(ok);
  const shown = typeof actual === 'string' ? actual : (actual === true ? 'TRUE (sesuai harapan)' : JSON.stringify(actual));
  console.log(`${ok ? '✅' : '❌'} ${name}\n   ${shown}`);
}

console.log(`# Uji HTTP PostgREST → ${SB}\n`);

// --- F3: fungsi sesi harus DITOLAK untuk anon -----------------------
for (const fn of ['masjid_claim_domain', 'masjid_verify_domain', 'masjid_reclaim_domain']) {
  const r = await call(fn, fn === 'masjid_verify_domain'
    ? { p_domain: 'tes.masjidgumiring.my.id', p_token: 'x' }
    : { p_domain: 'tes.masjidgumiring.my.id' });
  const denied = r.status === 401 || r.status === 403 ||
    (r.body && typeof r.body === 'object' && /permission denied/i.test(JSON.stringify(r.body)));
  push(`F3_anon_ditolak_${fn}`, true, denied);
}

// --- F1: host platform tidak boleh ter-resolve -----------------------
const platform = await call('masjid_resolve_domain', { p_domain: 'web-masjid-beta.vercel.app' });
push('F1_resolve_host_platform', 'not_found',
  platform.body && platform.body.code ? platform.body.code : `HTTP ${platform.status} ${JSON.stringify(platform.body).slice(0, 120)}`);

// --- regresi: domain klien yang sah tetap resolve --------------------
const valid = await call('masjid_resolve_domain', { p_domain: 'tes.masjidgumiring.my.id' });
push('F1_regresi_domain_sah', 'ok',
  valid.body && valid.body.ok ? 'ok' : `HTTP ${valid.status} ${JSON.stringify(valid.body).slice(0, 120)}`);

// --- F1: host admin platform juga tidak boleh resolve ----------------
const adminHost = await call('masjid_resolve_domain', { p_domain: 'adm-masjid-beta.vercel.app' });
push('F1_resolve_host_admin_platform', 'not_found',
  adminHost.body && adminHost.body.code ? adminHost.body.code : `HTTP ${adminHost.status} ${JSON.stringify(adminHost.body).slice(0, 120)}`);

const gagal = results.filter((x) => !x).length;
console.log(`\n${gagal === 0 ? '✅ SEMUA UJI HTTP LOLOS' : `❌ ${gagal} uji gagal`}`);
process.exit(gagal === 0 ? 0 : 1);
