#!/usr/bin/env node
/**
 * kaki5 marketing agent — runner utama
 * Dijalankan cron 3x/hari (09:00 / 12:30 / 19:00 WIB).
 *
 * Tugas:
 *  1. Post item dari content.json yang sudah waktunya ke FB Page (+ IG jika ada imageUrl)
 *  2. Polling komen di post-post terakhir → klasifikasi:
 *     - minat/apresiasi → AUTO-REPLY (template config.json)
 *     - negosiasi/lain  → DRAFT (tunggu approve user)
 *     - negatif/spam    → FLAG (dicatat, tidak dibalas)
 *  3. Log lead (sinyal beli) ke leads.jsonl
 *
 * Usage:
 *   node run.mjs            → jalan penuh (posting + komen)
 *   node run.mjs --status   → tampilkan state tanpa aksi
 *
 * Prasyarat (.secure.env root kasol): FB_PAGE_ID, FB_PAGE_TOKEN [, IG_BUSINESS_ACCOUNT_ID]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KASOL = path.resolve(HERE, '..', '..');
const SECURE_ENV = path.join(KASOL, '.secure.env');
const API = 'https://graph.facebook.com/v23.0';

const ARGV = process.argv.slice(2);
const MODE = ARGV[0] === '--status' ? 'status' : 'run';

const logLines = [];
const log = (m) => { logLines.push(m); console.log(m); };

// ---------- helpers ----------
function readSecureEnv() {
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
function loadJson(p, d) { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return d; } }
function saveJson(p, v) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(v, null, 2) + '\n'); }
function dstr(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }

async function graph(pathname, token, params = {}, method = 'GET') {
  const url = new URL(API + pathname);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set('access_token', token);
  const res = await fetch(url, { method });
  const json = await res.json().catch(() => ({}));
  if (!r2(res)) throw new Error(`Graph ${pathname} [${json.error?.code || res.status}]: ${json.error?.message || 'HTTP ' + res.status}`);
  return json;
}
function r2(res) { return res.ok; }

// ---------- klasifikasi komen ----------
const RE_NEGATIF = /(scam|penipu|penipuan|hack|virus|malware|nyesel|ripi?ng? off|bathin|penipu banget)/i;
const RE_NEGOSIASI = /(murah|diskon|promo|potong|negosiasi?|\bnego\b|cicil|pembayaran|bayar|mahal|nanti|thinking|pertimbang|coba dulu|gratisan|garansi|refund|balik uang|paling murah)/i;
const RE_MINAT = /(harga|berapa|info|detail|minat|gimana|bagaimana|cara|link|lokasi|di ?mana|tersedia|masih ?ada|ada ?(nggak|gak)|order|beli|pesan|kirim|kasir|trial|install|coba)/i;
const RE_APRE = /^(sip|oke|ok|okee?|terima kasih|makasih|thanks|thx|wah|keren|top|nice|bangee?t|gas|menantu|👍|🔥|❤️|🙏|😁|😀)/i;

function classify(text) {
  const t = (text || '').trim();
  if (!t) return 'spam';
  if (RE_NEGATIF.test(t)) return 'negatif';
  if (RE_NEGOSIASI.test(t)) return 'negosiasi';
  if (RE_APRE.test(t) && t.length <= 40) return 'apresiasi';
  if (RE_MINAT.test(t)) return 'minat';
  return 'lain';
}

// ---------- load ----------
const env = readSecureEnv();
const cfg = loadJson(path.join(HERE, 'config.json'), null);
if (!cfg) { console.error('ERROR: config.json tidak ditemukan di agent/'); process.exit(1); }
const content = loadJson(path.join(HERE, 'content.json'), { hari: [] });
const state = loadJson(path.join(HERE, 'state.json'), {
  postLog: [], itemStatus: {}, seenComments: {}, templateIdx: {}, flags: [],
});
const DRAFTS = path.join(HERE, 'drafts.json');
const LEADS = path.join(HERE, 'leads.jsonl');
const drafts = loadJson(DRAFTS, []);

const stats = { newComments: 0, auto: 0, draftNew: 0, flagged: 0 };
let draftSeq = drafts.reduce((m, d) => Math.max(m, parseInt(String(d.id).replace('D-', ''), 10) || 0), 0);

function saveState() {
  // cap seenComments 1000 (buang terlama)
  const keys = Object.keys(state.seenComments);
  if (keys.length > 1000) {
    for (const k of keys.slice(0, keys.length - 1000)) delete state.seenComments[k];
  }
  saveJson(path.join(HERE, 'state.json'), state);
}
function addDraft(kind, name, comment, draftMsg, platform, commentId, postRef) {
  draftSeq++;
  drafts.push({ id: `D-${draftSeq}`, kind, platform, commentId, post: postRef, name, comment, draft: draftMsg, ts: new Date().toISOString(), status: 'pending' });
  stats.draftNew++;
}
function addLead(o) { fs.appendFileSync(LEADS, JSON.stringify(o) + '\n'); }

// ---------- mode status ----------
if (MODE === 'status') {
  const missing = ['FB_PAGE_ID', 'FB_PAGE_TOKEN'].filter((k) => !env[k]);
  log('STATE kaki5-agent');
  log(`TOKEN: ${missing.length ? 'BELUM ADA (' + missing.join(', ') + ')' : 'OK'}`);
  log(`slot aktif: [${cfg.slotsAktif.join(', ')}] · tanggalMulai: ${state.tanggalMulaiEffektif || cfg.tanggalMulai}`);
  log(`posted total: ${state.postLog.length}`);
  for (const p of state.postLog.slice(-5)) log(`  ${p.date} ${p.slot} → fb:${p.fbPostId || '-'}${p.igPostId ? ' ig:' + p.igPostId : ''}`);
  log(`itemStatus: ${JSON.stringify(state.itemStatus)}`);
  log(`draft pending: ${drafts.filter((d) => d.status === 'pending').length}${drafts.length ? ` (total ${drafts.length})` : ''}`);
  const flagsNeg = (state.flags || []).filter((f) => f.type === 'negatif').slice(-3);
  if (flagsNeg.length) { log('flag negatif terakhir:'); for (const f of flagsNeg) log(`  [${f.ts}] ${f.name}: ${f.text.slice(0, 80)}`); }
  process.exit(0);
}

// ---------- main ----------
const now = new Date();
const todayStr = dstr(now);
log(`RUN kaki5-agent @ ${now.toISOString()}`);

const missing = ['FB_PAGE_ID', 'FB_PAGE_TOKEN'].filter((k) => !env[k]);
if (missing.length) {
  log(`TOKEN: BELUM ADA (${missing.join(', ')})`);
  log('STATUS: SETUP BELUM SELESAI — lanjutkan marketing-kit/08-setup-meta.md');
  process.exit(0);
}

// hitung hari konten (shift otomatis ke hari ini kalau token baru aktif terlambat)
let tMulai = state.tanggalMulaiEffektif || cfg.tanggalMulai;
const [sy, sm, sd] = tMulai.split('-').map(Number);
const startUTC = Date.UTC(sy, sm - 1, sd);
const nowUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
let dayIdx = Math.round((nowUTC - startUTC) / 86400000);
if (dayIdx > 0 && state.postLog.length === 0) {
  tMulai = todayStr;
  state.tanggalMulaiEffektif = tMulai;
  dayIdx = 0;
  log(`SHIFT: token baru aktif terlambat → hari-1 konten dimulai HARI INI (${tMulai})`);
}

if (dayIdx < 0) { log(`KONTEN BELUM MULAI (mulai ${tMulai})`); log('STATUS: DIEM'); saveState(); process.exit(0); }
if (dayIdx >= content.hari.length) { log('KONTEN HABIS (14 hari selesai) — kit minggu 2 diperlukan'); log('STATUS: KONTEN HABIS'); saveState(); process.exit(0); }

const day = content.hari[dayIdx];
log(`HARI ${dayIdx + 1}/14 (${day.script}) · slot aktif: [${cfg.slotsAktif.join(', ')}]`);

let posted = 0, rampSkip = 0, belumWaktunya = 0, gagal = 0;

// ---------- posting ----------
for (const slot of cfg.slotsSemua) {
  const key = `H${dayIdx + 1}-${slot}`;
  const item = day.posts && day.posts[slot];
  if (!item) continue;
  if (state.itemStatus[key]) continue; // sudah pernah diproses
  if (!cfg.slotsAktif.includes(slot)) { state.itemStatus[key] = 'skipped_ramp'; rampSkip++; continue; }
  const [hh, mm] = slot.split(':').map(Number);
  const due = new Date(now); due.setHours(hh, mm, 0, 0);
  if (now < due) { belumWaktunya++; continue; } // slot-nya belum tiba
  if (posted >= cfg.maxPostPerRun) { log(`NANTI: slot ${slot} (cap ${cfg.maxPostPerRun} post/run) — akan kejar run berikutnya`); continue; }

  const caption = item.t + (item.l ? `\n\n${cfg.urlUtama}` : '');
  try {
    const fb = await graph(`/${env.FB_PAGE_ID}/feed`, env.FB_PAGE_TOKEN, { message: caption, published: 'true' }, 'POST');
    const fbId = fb.post_id || String(fb.id || '').split('_')[0];
    let igId = null;
    if (env.IG_BUSINESS_ACCOUNT_ID && item.imageUrl) {
      igId = await postToIG(env.IG_BUSINESS_ACCOUNT_ID, env.FB_PAGE_TOKEN, item.t, item.imageUrl);
    }
    state.postLog.push({ id: key, date: todayStr, slot, fbPostId: fbId, igPostId: igId, ts: now.toISOString() });
    state.itemStatus[key] = 'posted';
    posted++;
    log(`POSTED: ${slot} → fb:${fbId}${igId ? ' ig:' + igId : ' (IG: auto-share/n/a)'}`);
  } catch (e) {
    gagal++;
    state.lastError = { ts: now.toISOString(), msg: e.message };
    log(`ERROR POST ${slot}: ${e.message}`);
  }
}

async function postToIG(igId, token, caption, imageUrl) {
  const c = await graph(`/${igId}/media`, token, { image_url: imageUrl, caption, media_type: 'IMAGE' }, 'POST');
  for (let i = 0; i < 20; i++) {
    const st = await graph(`/${c.id}?fields=status`, token);
    if (st.status === 'FINISHED') break;
    if (st.status === 'ERROR') throw new Error('IG media container ERROR');
    await new Promise((r) => setTimeout(r, 2000));
  }
  const p = await graph(`/${igId}/media_publish`, token, { creation_id: c.id }, 'POST');
  return p.id;
}

// ---------- polling komen ----------
const recent = state.postLog.slice(-cfg.pollKomenMaxPost);
for (const p of recent) {
  try {
    if (p.fbPostId) {
      const r = await graph(`/${p.fbPostId}/comments`, env.FB_PAGE_TOKEN, { fields: 'id,from.name,message,created_time', limit: 100 });
      for (const c of r.data || []) await handleComment(c, 'fb', p);
    }
    if (p.igPostId) {
      const r = await graph(`/${p.igPostId}/comments`, env.FB_PAGE_TOKEN, { fields: 'id,from.id,message,created_time', limit: 100 });
      for (const c of r.data || []) await handleComment({ ...c, from: { name: `IG-${c.from && c.from.id || '?'}` } }, 'ig', p);
    }
  } catch (e) {
    log(`ERROR KOMEN ${p.id}: ${e.message}`);
  }
}

async function handleComment(c, platform, p) {
  if (!c.id || state.seenComments[c.id]) return;
  const name = (c.from && (c.from.name || c.from.id)) || 'orang';
  const text = (c.message || '').trim();
  const type = classify(text);
  state.seenComments[c.id] = type;
  stats.newComments++;
  const postRef = platform === 'fb' && p.fbPostId ? `https://www.facebook.com/${p.fbPostId}` : `IG ${p.igPostId || ''}`.trim();

  if (type === 'negatif') {
    stats.flagged++;
    state.flags = state.flags || [];
    state.flags.push({ ts: new Date().toISOString(), post: postRef, name, text, type: 'negatif' });
    log(`FLAG NEGATIF: ${name}: ${text.slice(0, 80)}`);
    return;
  }
  if (type === 'spam') return;

  const sendReply = async (msg) => {
    if (platform === 'ig') await graph(`/${c.id}/replies`, env.FB_PAGE_TOKEN, { message: msg }, 'POST');
    else await graph(`/${c.id}/comments`, env.FB_PAGE_TOKEN, { message: msg }, 'POST');
  };

  if (type === 'minat' || type === 'apresiasi') {
    const bank = cfg.templates[type] || cfg.templates.lain && [];
    const idx = state.templateIdx[type] || 0;
    state.templateIdx[type] = idx + 1;
    let msg = (bank && bank.length ? bank[idx % bank.length] : cfg.templates.draftLain);
    if (type === 'minat' && cfg.waCta) msg += ` Chat: ${cfg.waCta}`;
    if (stats.auto < cfg.maxAutoReplyPerRun) {
      try {
        await sendReply(msg);
        stats.auto++;
        log(`AUTO-REPLY [${type}] → ${name}`);
      } catch (e) {
        log(`ERROR AUTO-REPLY: ${e.message}`);
        addDraft(type, name, text, msg, platform, c.id, postRef);
      }
    } else {
      addDraft(type, name, text, msg, platform, c.id, postRef);
    }
    if (type === 'minat') addLead({ ts: new Date().toISOString(), platform, post: postRef, name, text, type });
    return;
  }

  if (type === 'negosiasi') {
    addLead({ ts: new Date().toISOString(), platform, post: postRef, name, text, type });
    addDraft('negosiasi', name, text, cfg.templates.draftNegosiasi, platform, c.id, postRef);
    return;
  }

  // lain
  addDraft('lain', name, text, cfg.templates.draftLain, platform, c.id, postRef);
}

// ---------- simpan + ringkasan ----------
saveState();
if (stats.draftNew) saveJson(DRAFTS, drafts);

if (posted === 0 && stats.newComments === 0) {
  log(`RINGKASAN: posted 0 · ramp-skip ${rampSkip} · belum-waktunya ${belumWaktunya} · gagal ${gagal}`);
  log('STATUS: DIEM (tidak ada aksi)');
} else {
  const pending = drafts.filter((d) => d.status === 'pending');
  log(`RINGKASAN: posted ${posted} · ramp-skip ${rampSkip} · gagal ${gagal} · komen baru ${stats.newComments} (auto ${stats.auto}, draft ${stats.draftNew}, flag ${stats.flagged})`);
  if (pending.length) {
    log(`DRAFT PENDING: ${pending.length} (termasuk baru)`);
    for (const d of pending.slice(-5)) log(`  ${d.id} [${d.kind}] ${d.name}: "${(d.comment || '').slice(0, 60)}" → draft: "${(d.draft || '').slice(0, 60)}"`);
  }
  log('STATUS: SELESAI');
}
