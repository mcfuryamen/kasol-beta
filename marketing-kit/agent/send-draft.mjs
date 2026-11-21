#!/usr/bin/env node
/**
 * send-draft.mjs — approve / edit / tolak draft balasan komen
 *
 * Usage:
 *   node send-draft.mjs --list                 → daftar draft pending
 *   node send-draft.mjs D-3                    → kirim draft apa adanya
 *   node send-draft.mjs D-3 "teks custom…"     → kirim teks yang lo tulis sendiri
 *   node send-draft.mjs D-3 --reject           → tolak (tidak dikirim)
 *
 * Cara praktis: ketik "approve draft D-3" ke Mavis → Mavis jalanin script ini.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KASOL = path.resolve(HERE, '..', '..');
const SECURE_ENV = path.join(KASOL, '.secure.env');
const API = 'https://graph.facebook.com/v23.0';
const DRAFTS = path.join(HERE, 'drafts.json');

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
const drafts = (() => { try { return JSON.parse(fs.readFileSync(DRAFTS, 'utf8')); } catch { return []; } })();
const save = () => fs.writeFileSync(DRAFTS, JSON.stringify(drafts, null, 2) + '\n');

const arg1 = process.argv[2];
const rest = process.argv.slice(3);

if (!arg1 || arg1 === '--list') {
  const pending = drafts.filter((d) => d.status === 'pending');
  if (!pending.length) { console.log('Tidak ada draft pending.'); process.exit(0); }
  console.log(`DRAFT PENDING (${pending.length}):`);
  for (const d of pending) {
    console.log(`\n${d.id} [${d.kind}] · ${d.platform} · ${d.name} · ${d.ts}`);
    console.log(`  KOMEN : ${d.comment}`);
    console.log(`  DRAFT : ${d.draft}`);
    console.log(`  POST  : ${d.post}`);
  }
  console.log('\nApprove: node send-draft.mjs <id>   |   Tolak: node send-draft.mjs <id> --reject');
  process.exit(0);
}

// resolve id: "D-3" | "3" (urutan pending) | "latest"
let draft;
if (arg1.startsWith('D-')) draft = drafts.find((d) => d.id === arg1);
else if (arg1 === 'latest') { const p = drafts.filter((d) => d.status === 'pending'); draft = p[p.length - 1]; }
else if (/^\d+$/.test(arg1)) { const p = drafts.filter((d) => d.status === 'pending'); draft = p[Number(arg1) - 1] || drafts.find((d) => d.id === `D-${arg1}`); }
if (!draft) { console.error(`Draft ${arg1} tidak ditemukan.`); process.exit(1); }
if (draft.status !== 'pending') { console.error(`Draft ${draft.id} sudah ${draft.status}.`); process.exit(1); }

const reject = rest.includes('--reject');
let msg = draft.draft;
if (!reject) {
  const txt = rest.filter((a) => a !== '--reject').join(' ').trim();
  if (txt) msg = txt;
}

if (!reject && !draft.commentId) { console.error('Draft ini tidak punya commentId (mungkin draft IG lama). Kirim manual di IG.'); process.exit(1); }

const env = readEnv();
if (!reject && !env.FB_PAGE_TOKEN) { console.error('ERROR: FB_PAGE_TOKEN belum ada di .secure.env.'); process.exit(1); }

if (reject) {
  draft.status = 'rejected';
  draft.updatedAt = new Date().toISOString();
  save();
  console.log(`Draft ${draft.id} ditolak (tidak dikirim).`);
  process.exit(0);
}

try {
  const url = new URL(API + (draft.platform === 'ig' ? `/${draft.commentId}/replies` : `/${draft.commentId}/comments`));
  url.searchParams.set('message', msg);
  url.searchParams.set('access_token', env.FB_PAGE_TOKEN);
  const r = await fetch(url, { method: 'POST' });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error?.message || `HTTP ${r.status}`);
  draft.status = 'sent';
  draft.sentMsg = msg;
  draft.sentTs = new Date().toISOString();
  save();
  console.log(`Kirim OK (${draft.id}) → ${draft.name}:`);
  console.log(msg);
} catch (e) {
  console.error(`ERROR kirim draft ${draft.id}: ${e.message}`);
  console.error('Biasanya: komen aslinya sudah dihapus orangnya, atau token cabut. Cek komennya masih ada tidak.');
  process.exit(1);
}
