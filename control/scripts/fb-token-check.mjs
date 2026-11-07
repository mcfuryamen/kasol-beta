#!/usr/bin/env node
/**
 * fb-token-check.mjs — validator token Facebook Page (diagnostik, read-only)
 * =============================================================================
 * Dipakai buat jawab satu pertanyaan: "token FB gue ini(valid,yalive, dan
 * punya izin yang cukup) buat Control Center, atau belum?"
 *
 * Token TIDAK PERNAH dicetak utuh — hanya 6 karakter depan + 4 belakang.
 * Token juga tidak pernah ditulis ke file mana pun.
 *
 * CARA PAKAI
 *   node control/scripts/fb-token-check.mjs --dari-db
 *       → cek token yang TERSIMPAN di Control (settings.social_fb)
 *   node control/scripts/fb-token-check.mjs --dari-env
 *       → cek FB_PAGE_TOKEN di kasol/.secure.env (isi manual marketing-kit)
 *   node control/scripts/fb-token-check.mjs "EAAG...tokenmu..."
 *       → cek token apa pun yang lo ketik (dipakai buat tes token Explorer)
 *   node control/scripts/fb-token-check.mjs --dari-db --json
 *       → output JSON ( buat otomasi / report)
 *
 * YANG DICARI
 *   - token valid? (Graph: is_valid)
 *   - kapan kedaluwarsa? (expires_at → tanggal + sisa hari)
 *   - izin apa saja? (scopes / granular_scopes)
 *   - Page-nya bisa diakses? (tasks: CREATE_CONTENT / MANAGE / MODERATE)
 *   - cukup buat apa? posting · baca komentar · moderasi
 *
 * Exit code: 0 = siap dipakai · 1 = ada yang perlu diperbaiki.
 * =============================================================================
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CONTROL = path.resolve(HERE, '..');
const KASOL = path.resolve(CONTROL, '..');
const GRAPH = 'https://graph.facebook.com/v21.0';

const ARGV = process.argv.slice(2);
const USE_JSON = ARGV.includes('--json');
const DARI_DB = ARGV.includes('--dari-db');
const DARI_ENV = ARGV.includes('--dari-env');
const POSITIONAL = ARGV.filter((a) => !a.startsWith('--'));

// ── pemuat env (gagal diam-diam — script ini boleh jalan tanpa env) ─────────
function readEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const l = raw.trim();
    if (!l || l.startsWith('#')) continue;
    const m = l.match(/^([A-Za-z0-9_]+)\s*=\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '');
  }
  return out;
}
const ENV = {
  ...readEnv(path.join(KASOL, '.secure.env')),
  ...readEnv(path.join(CONTROL, '.env.local')),
};
const SUPABASE_URL = ENV.SUPABASE_URL || ENV.SB_URL || '';
const SERVICE_KEY = ENV.SUPABASE_SERVICE_ROLE_KEY || ENV.SB_SERVICE || '';

// ── output helpers ──────────────────────────────────────────────────────────
// Warna hanya kalau stdout itu terminal sungguhan — kalau output-nya di-pipe
// atau di-capture, ANSI bikin log berantakan.
const TTY = Boolean(process.stdout.isTTY);
const C = TTY
  ? { g: '\x1b[32m', r: '\x1b[31m', y: '\x1b[33m', c: '\x1b[36m', d: '\x1b[2m', b: '\x1b[1m', x: '\x1b[0m' }
  : { g: '', r: '', y: '', c: '', d: '', b: '', x: '' };
const say = (s = '') => { if (!USE_JSON) console.log(s); };
const ok = (s) => say(`  ${C.g}✓${C.x} ${s}`);
const bad = (s) => say(`  ${C.r}✗${C.x} ${s}`);
const warn = (s) => say(`  ${C.y}⚠${C.x} ${s}`);
const info = (s) => say(`  ${C.d}·${C.x} ${s}`);

/** Sensor token: 6 depan + 4 belakang, sisanya disembunyikan. */
function sensor(t) {
  const s = String(t || '');
  if (!s) return '(kosong)';
  if (s.length <= 14) return `${s.slice(0, 3)}…${s.slice(-2)}`;
  return `${s.slice(0, 6)}…${s.slice(-4)} (${s.length} karakter)`;
}

// ── ambil token dari berbagai sumber ────────────────────────────────────────
async function tokenDariDb() {
  if (!SUPABASE_URL || !SERVICE_KEY) throw new Error('SUPABASE_URL / service key tidak ada (cek control/.env.local atau kasol/.secure.env)');
  const res = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/rest/v1/settings?key=eq.social_fb&select=value&limit=1`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  const rows = await res.json().catch(() => null);
  const v = rows?.[0]?.value;
  if (!v) throw new Error('belum ada settings.social_fb — simpan dulu di Control → Sosmed → ⚙️ Koneksi');
  const cfg = typeof v === 'string' ? JSON.parse(v) : v;
  if (!cfg?.page_token) throw new Error('settings.social_fb ada tapi page_token kosong');
  return { token: cfg.page_token, pageId: cfg.page_id || '', asal: 'settings.social_fb (Control)' };
}

function tokenDariEnv() {
  const t = ENV.FB_PAGE_TOKEN;
  if (!t) throw new Error('FB_PAGE_TOKEN tidak ada di kasol/.secure.env');
  return { token: t, pageId: ENV.FB_PAGE_ID || '', asal: 'kasol/.secure.env (FB_PAGE_TOKEN)' };
}

// ── panggil Graph ───────────────────────────────────────────────────────────
async function graph(pathname, params = {}) {
  const url = new URL(`${GRAPH}/${String(pathname).replace(/^\//, '')}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = new Error(data?.error?.message || `HTTP ${res.status}`);
    e.code = data?.error?.code;
    e.type = data?.error?.type;
    throw e;
  }
  return data;
}

// ── pemeriksa utama ─────────────────────────────────────────────────────────
const laporan = { ok: false, sumber: '', token: '', valid: false, expired: false, expires_at: null, sisa_hari: null, scopes: [], page: null, tasks: [], kapabel: {}, catatan: [] };

async function main() {
  say(`${C.b}🔎 Cek token Facebook Page${C.x}`);
  say('');

  // 1) sumber token
  let src;
  if (DARI_DB) src = await tokenDariDb();
  else if (DARI_ENV) src = tokenDariEnv();
  else if (POSITIONAL.length) src = { token: POSITIONAL[0], pageId: '', asal: 'argumen command line' };
  else {
    say(`${C.y}⚠ Tidak ada sumber token yang dipilih.${C.x}`);
    say('   Pakai salah satu:');
    say('     node control/scripts/fb-token-check.mjs --dari-db     (token yang tersimpan di Control)');
    say('     node control/scripts/fb-token-check.mjs --dari-env    (FB_PAGE_TOKEN di .secure.env)');
    say('     node control/scripts/fb-token-check.mjs "EAAG..."     (token dari Explorer)');
    process.exitCode = 1;
    return;
  }
  laporan.sumber = src.asal;
  laporan.token = sensor(src.token);
  say(`${C.d}Sumber:${C.x} ${src.asal}`);
  say(`${C.d}Token :${C.x} ${laporan.token}`);
  say('');

  // 2) debug_token — introspeksi token (pakai token itu sendiri sebagai access_token)
  let debug = null;
  try {
    const r = await graph('debug_token', { input_token: src.token, access_token: src.token });
    debug = r?.data || null;
  } catch (e) {
    laporan.catatan.push(`debug_token gagal: ${e.message}`);
    warn(`debug_token gagal: ${e.message}`);
  }

  const scopes = new Set();
  if (debug) {
    for (const s of debug.scopes || []) scopes.add(s);
    for (const g of debug.granular_scopes || []) for (const s of g.scopes || []) scopes.add(s);
  }
  laporan.scopes = [...scopes].sort();

  if (debug) {
    if (debug.is_valid) {
      laporan.valid = true;
      ok('Token VALID (Graph: is_valid = true)');
    } else {
      bad('Token TIDAK valid (is_valid = false)');
    }
    if (debug.expires_at) {
      laporan.expires_at = new Date(debug.expires_at * 1000).toISOString();
      const sisa = Math.round((debug.expires_at * 1000 - Date.now()) / 86400000);
      laporan.sisa_hari = sisa;
      if (sisa <= 0) {
        laporan.expired = true;
        bad(`Kedaluwarsa: ${laporan.expires_at}`);
      } else if (sisa <= 7) {
        warn(`Kedaluwarsa: ${laporan.expires_at} (sisa ${sisa} hari — SEGarkan sekarang)`);
      } else {
        ok(`Kedaluwarsa: ${laporan.expires_at} (sisa ${sisa} hari)`);
      }
    } else {
      ok('Tanpa kedaluwarsa (page token dari long-lived user token) — ini yang kita mau');
    }
    if (debug.app_id) info(`App ID: ${debug.app_id}`);
  }

  // 3) cek Page-nya bisa diakses?
  let pageId = src.pageId;
  if (!pageId) {
    try {
      const me = await graph('me', { fields: 'id,name', access_token: src.token });
      pageId = me.id;
      info(`Page ID dari token: ${pageId} (${me.name || '?'})`);
    } catch (e) {
      laporan.catatan.push(`gagal baca /me: ${e.message}`);
    }
  }
  if (pageId) {
    try {
      const pg = await graph(pageId, { fields: 'id,name,tasks,fan_count,category', access_token: src.token });
      laporan.page = { id: pg.id, name: pg.name, fan_count: pg.fan_count ?? null, category: pg.category || null };
      laporan.tasks = pg.tasks || [];
      ok(`Page terjangkau: ${pg.name || '?'} (${pg.id})` + (pg.fan_count != null ? ` · ${pg.fan_count} pengikut` : ''));
      const butuh = ['CREATE_CONTENT', 'MANAGE', 'MODERATE'];
      const kurang = butuh.filter((t) => !(pg.tasks || []).includes(t));
      if (!kurang.length) ok(`Tasks lengkap: ${butuh.join(', ')}`);
      else warn(`Tasks kurang: ${kurang.join(', ')} — posting/balas komentar bisa gagal (cek role lo di Page → Settings → Page access)`);
    } catch (e) {
      bad(`Page tidak terjangkau: ${e.message}`);
      laporan.catatan.push(`gagal baca page: ${e.message}`);
    }
  }

  // 4) verdict per kapabilitas
  const punya = (s) => scopes.has(s);
  laporan.kapabel.posting = punya('pages_manage_posts');
  laporan.kapabel.bacaKomentar = punya('pages_read_user_content');
  laporan.kapabel.moderasi = punya('pages_manage_engagement');
  laporan.kapabel.lihatPage = punya('pages_show_list') || punya('pages_read_engagement');

  say('');
  say(`${C.b}Kemampuan:${C.x}`);
  laporan.kapabel.posting ? ok('Posting ke Page (pages_manage_posts)') : bad('Posting ke Page — butuh pages_manage_posts');
  laporan.kapabel.lihatPage ? ok('Baca engagement (pages_read_engagement)') : warn('Baca engagement — butuh pages_read_engagement');
  laporan.kapabel.bacaKomentar ? ok('Baca komentar (pages_read_user_content)') : warn('Baca komentar — butuh pages_read_user_content (Cuma perlu kalau mau auto-reply)');
  laporan.kapabel.moderasi ? ok('Moderasi / balas (pages_manage_engagement)') : warn('Balas komentar — butuh pages_manage_engagement (Cuma perlu kalau mau auto-reply)');

  if (scopes.size) {
    say('');
    say(`${C.b}Izin yang ada (${scopes.size}):${C.x}`);
    for (const s of laporan.scopes) say(`  ${C.d}·${C.x} ${s}`);
  } else {
    say('');
    warn('Izin tidak terbaca (debug_token gagal) — cek manual di Access Token Debugger');
  }

  // 5) kesimpulan
  const intiOk = laporan.valid && !laporan.expired && laporan.kapabel.posting;
  laporan.ok = intiOk;
  say('');
  say(`${C.b}Kesimpulan:${C.x}`);
  if (intiOk) {
    say(`  ${C.g}${C.b}✓ SIAP dipakai di Control Center${C.x} — posting ke Page akan jalan.`);
    if (!laporan.kapabel.bacaKomentar) {
      say(`  ${C.y}⚠ Auto-reply komentar BELUM bisa — token perlu pages_read_user_content.${C.x}`);
      say(`    ${C.d}Cara dapat: buat token baru di Graph API Explorer dengan izin itu, lalu cek lagi.${C.x}`);
    }
  } else {
    say(`  ${C.r}${C.b}✗ BELUM SIAP${C.x}`);
    if (!laporan.valid) say(`    ${C.d}· token tidak valid / kedaluwarsa — generate ulang di Graph API Explorer${C.x}`);
    if (laporan.expired) say(`    ${C.d}· token sudah kedaluwarsa — extend dulu di Access Token Debugger${C.x}`);
    if (!laporan.kapabel.posting) say(`    ${C.d}· kurang izin pages_manage_posts — generate token baru dengan izin itu${C.x}`);
  }

  if (USE_JSON) console.log(JSON.stringify(laporan, null, 2));
  // Jangan process.exit() paksa: di Windows itu memicu assertion libuv
  // (UV_HANDLE_CLOOSING) kalau ada handle I/O yang belum selesai. Set exitCode
  // saja — proses keluar sendiri setelah event loop kosong.
  process.exitCode = intiOk ? 0 : 1;
}

main().catch((e) => {
  if (USE_JSON) console.log(JSON.stringify({ ...laporan, error: String(e.message || e) }, null, 2));
  else {
    console.error(`${C.r}✗ Gagal:${C.x} ${e.message || e}`);
    console.error(`${C.d}  Lihat control/js/sosmed.js → ⚙️ Koneksi → panduan obtain token.${C.x}`);
  }
  process.exitCode = 1;
});
