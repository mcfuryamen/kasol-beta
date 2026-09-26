#!/usr/bin/env node
/**
 * activate.mjs — tukar OAuth code → page token + IG id, simpan ke .secure.env
 *
 * Alur (detail klik-per-klik di marketing-kit/08-setup-meta.md):
 *   1) FB_APP_ID & FB_APP_SECRET sudah ditempel di kasol/.secure.env
 *   2) Buka URL OAuth di browser → login FB → allow semua izin
 *   3) Browser redirect ke http://localhost/callback?code=XXXX  (error "buka" itu NORMAL)
 *   4) Salin VALUE code-nya (cuma hidup ~1 menit, langsung eksekusi):
 *        node marketing-kit/agent/activate.mjs XXXX            (pilih page "Kasir Solo" otomatis)
 *        node marketing-kit/agent/activate.mjs XXXX <page_id>  (paksa page tertentu)
 *
 * Opsi lain:
 *   node marketing-kit/agent/activate.mjs --ig
 *     → cari ulang IG Business id setelah IG di-link ke Page (pakai token yang sudah ada)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KASOL = path.resolve(HERE, '..', '..');
const SECURE_ENV = path.join(KASOL, '.secure.env');
const API = 'https://graph.facebook.com/v23.0';
const SCOPES = 'pages_show_list,pages_manage_posts,pages_read_engagement,pages_read_user_content,instagram_basic';

function readEnv() {
  const env = {};
  if (!fs.existsSync(SECURE_ENV)) return env;
  for (const raw of fs.readFileSync(SECURE_ENV, 'utf8').split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (m) env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return env;
}
function upsertEnv(key, value) {
  let txt = fs.existsSync(SECURE_ENV) ? fs.readFileSync(SECURE_ENV, 'utf8') : '';
  const re = new RegExp(`^${key}=.*$`, 'm');
  const line = `${key}=${value}`;
  if (re.test(txt)) txt = txt.replace(re, line);
  else txt += (txt.length && !txt.endsWith('\n') ? '\n' : '') + line + '\n';
  fs.writeFileSync(SECURE_ENV, txt);
  console.log(`  ✓ ${key} tersimpan di .secure.env`);
}
async function getJSON(url) {
  const r = await fetch(url);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error ? `FB error [${j.error.code}]: ${j.error.message}` : `HTTP ${r.status}`);
  return j;
}

const arg1 = process.argv[2];

// ---------- mode --ig ----------
if (arg1 === '--ig') {
  const env = readEnv();
  if (!env.FB_PAGE_ID || !env.FB_PAGE_TOKEN) { console.error('ERROR: FB_PAGE_ID/FB_PAGE_TOKEN belum ada di .secure.env. Jalankan activate.mjs <code> dulu.'); process.exit(1); }
  try {
    const page = await getJSON(`${API}/${env.FB_PAGE_ID}?fields=ig_business_account&access_token=${encodeURIComponent(env.FB_PAGE_TOKEN)}`);
    const ig = page.ig_business_account;
    if (!ig || !ig.id) throw new Error('field ig_business_account kosong');
    upsertEnv('IG_BUSINESS_ACCOUNT_ID', ig.id);
    console.log(`OK: IG Business ${ig.id} (@${ig.username || '?'})`);
  } catch (e) {
    console.error(`ERROR: ${e.message}`);
    console.error('Pastikan IG sudah di-link: IG → Settings → Accounts and type → Connect to Facebook Page → pilih "Kasir Solo".');
  }
  process.exit(0);
}

// ---------- mode utama ----------
const code = arg1;
const wantPageId = process.argv[3];
if (!code) {
  const env = readEnv();
  console.log('Usage: node activate.mjs <oauth_code> [page_id] | --ig');
  console.log('\nURL OAuth (ganti APP_ID):');
  console.log(`https://www.facebook.com/v23.0/dialog/oauth?client_id=${env.FB_APP_ID || 'APP_ID'}&redirect_uri=${encodeURIComponent('http://localhost/callback')}&scope=${encodeURIComponent(SCOPES)}&response_type=code`);
  console.log('\nCode dari URL hasil redirect cuma hidup ~1 menit. Segera jalankan:');
  console.log('  node marketing-kit/agent/activate.mjs <code>');
  process.exit(1);
}

const env = readEnv();
if (!env.FB_APP_ID || !env.FB_APP_SECRET) {
  console.error('ERROR: FB_APP_ID / FB_APP_SECRET belum diisi di .secure.env (lihat 08-setup-meta.md langkah 4).');
  process.exit(1);
}

try {
  console.log('1/4 Tukar code → user token (pendek)…');
  const s1 = await getJSON(`${API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${env.FB_APP_ID}&client_secret=${env.FB_APP_SECRET}&code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent('http://localhost/callback')}`);
  if (!s1.access_token) throw new Error(s1.error?.message || 'code tidak valid / sudah kedaluwarsa');

  console.log('2/4 Tukar → user token (panjang)…');
  const s2 = await getJSON(`${API}/oauth/access_token?grant_type=fb_exchange_token&client_id=${env.FB_APP_ID}&client_secret=${env.FB_APP_SECRET}&fb_exchange_token=${encodeURIComponent(s1.access_token)}&redirect_uri=${encodeURIComponent('http://localhost/callback')}`);
  const userLong = s2.access_token;
  if (!userLong) throw new Error('gagal dapat user token panjang');

  console.log('3/4 Ambil daftar Page + token…');
  const acc = await getJSON(`${API}/me/accounts?access_token=${encodeURIComponent(userLong)}&limit=50`);
  const pages = acc.data || [];
  let page = wantPageId
    ? pages.find((p) => p.id === wantPageId)
    : pages.find((p) => /kasir[\s_-]?solo|mesin[\s_-]?kasir/i.test(p.name || '')) || (pages.length === 1 ? pages[0] : null);
  if (!page) {
    console.error('Page tidak ketemu. Page yang tersedia:');
    for (const p of pages) console.error(`  ${p.id}  ${p.name}${p.access_token ? '' : '  (TANPA token — cek scope pages_show_list)'}`);
    console.error('Jalankan ulang: node activate.mjs <code> <page_id>  (code baru = OAuth ulang)');
    process.exit(1);
  }
  if (!page.access_token) {
    console.error('Page ketemu tapi token tidak ikut. Scope OAuth harus memuat pages_show_list. Ulangi langkah OAuth.');
    process.exit(1);
  }
  upsertEnv('FB_PAGE_ID', page.id);
  upsertEnv('FB_PAGE_TOKEN', page.access_token);
  console.log(`  ✓ Page "${page.name}" (${page.id})`);

  console.log('4/4 Cek IG Business…');
  try {
    const pg = await getJSON(`${API}/${page.id}?fields=ig_business_account&access_token=${encodeURIComponent(page.access_token)}`);
    if (pg.ig_business_account && pg.ig_business_account.id) {
      upsertEnv('IG_BUSINESS_ACCOUNT_ID', pg.ig_business_account.id);
      console.log(`  ✓ IG Business ${pg.ig_business_account.id} (@${pg.ig_business_account.username || '?'})`);
    } else throw new Error('belum ter-link');
  } catch (e) {
    console.log('  ⚠ IG belum di-link ke Page — posting IG via API akan dilewati.');
    console.log('    Link dulu di IG (Settings → Accounts and type → Connect to Facebook Page), lalu:');
    console.log('    node marketing-kit/agent/activate.mjs --ig');
  }

  console.log('\nSELESAI. Verifikasi sekarang:');
  console.log('  node marketing-kit/agent/run.mjs --status');
  console.log('  node marketing-kit/agent/run.mjs   (kalau jamnya sudah lewat slot aktif, 1 post langsung jalan)');
} catch (e) {
  console.error(`ERROR: ${e.message}`);
  if (/code/i.test(e.message)) console.error('Hint: OAuth code cuma hidup ~1 menit. Ulangi OAuth URL, lalu langsung jalankan activate.');
  if (/200/.test(e.message)) console.error('Hint: token/secret salah — cek FB_APP_ID & FB_APP_SECRET di .secure.env (App Settings → Basic).');
  process.exit(1);
}
