#!/usr/bin/env node
/**
 * masjid-website-snapshot.mjs — amankan & pulihkan baris public.masjid_website.
 *
 * Dipakai saat QA publish: sebelum uji, simpan data+draft+published_at asli;
 * setelah uji, pulihkan persis seperti semula.
 *
 * Secrets dibaca dari root .env.local (SUPABASE_ACCESS_TOKEN) & tidak dicetak.
 *
 * Usage:
 *   node masjid/_qa/masjid-website-snapshot.mjs --ref=<ref> --slug=masjid --save
 *   node masjid/_qa/masjid-website-snapshot.mjs --ref=<ref> --slug=masjid --restore
 */

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..');
const BACKUP_DIR = HERE;

function loadEnvLocal() {
  try {
    for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][\w]*)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
    }
  } catch { /* optional */ }
}
loadEnvLocal();

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const m = a.match(/^--([\w-]+)=(.*)$/s);
  return m ? [m[1], m[2]] : [a.replace(/^--/, ''), true];
}));

const REF = args.ref || '';
const TOKEN = process.env.SUPABASE_ACCESS_TOKEN || '';
const SLUG = (args.slug && args.slug !== true) ? args.slug : 'masjid';
const BACKUP = path.join(BACKUP_DIR, `masjid-website-${SLUG}.backup.json`);

if (!REF) { console.error('Missing --ref=<project-ref>'); process.exit(1); }
if (!TOKEN) { console.error('Missing SUPABASE_ACCESS_TOKEN di .env.local'); process.exit(1); }

function mgmtQuery(sql) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: sql });
    const req = https.request(
      {
        hostname: 'api.supabase.com',
        port: 443,
        path: `/v1/projects/${REF}/database/query`,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
        },
        timeout: 120000,
      },
      (res) => {
        let body = '';
        res.on('data', (c) => (body += c));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try { resolve(JSON.parse(body || '[]')); } catch { resolve(body); }
          } else {
            let msg = body;
            try { const p = JSON.parse(body); msg = p.message || p.error_description || p.error || body; } catch {}
            reject(new Error(`HTTP ${res.statusCode}: ${msg}`));
          }
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

const q = (s) => `'${String(s).replace(/'/g, "''")}'`;

async function save() {
  const sql = `select slug, data::text as data_txt, draft::text as draft_txt, published_at::text as published_at_txt, updated_at::text as updated_at_txt from public.masjid_website where slug = ${q(SLUG)}`;
  const out = await mgmtQuery(sql);
  const row = Array.isArray(out) ? out[0] : out;
  if (!row) { console.error(`Tidak ada baris untuk slug=${SLUG}`); process.exit(1); }
  const bak = {
    slug: row.slug,
    dataTxt: row.data_txt,
    draftTxt: row.draft_txt,
    publishedAt: row.published_at_txt,
    updatedAt: row.updated_at_txt,
    savedAt: new Date().toISOString(),
  };
  fs.writeFileSync(BACKUP, JSON.stringify(bak, null, 2), 'utf8');
  console.log(`OK backup: ${BACKUP}`);
  console.log(`   data   : ${(bak.dataTxt || '').length} char`);
  console.log(`   draft  : ${(bak.draftTxt || '').length} char`);
  console.log(`   published_at: ${bak.publishedAt}`);
}

async function restore() {
  if (!fs.existsSync(BACKUP)) { console.error(`Backup tidak ada: ${BACKUP}`); process.exit(1); }
  const bak = JSON.parse(fs.readFileSync(BACKUP, 'utf8'));
  const tag = '$ks_json$';
  if (String(bak.dataTxt).includes(tag) || String(bak.draftTxt || '').includes(tag)) {
    console.error('Tag dollar-quoting bentrok dengan isi data.'); process.exit(1);
  }
  const dataPart = bak.dataTxt == null ? 'null' : `${tag}${bak.dataTxt}${tag}::jsonb`;
  const draftPart = bak.draftTxt == null ? 'null' : `${tag}${bak.draftTxt}${tag}::jsonb`;
  const pubPart = bak.publishedAt ? `${q(bak.publishedAt)}::timestamptz` : 'null';
  const updPart = bak.updatedAt ? `${q(bak.updatedAt)}::timestamptz` : 'now()';
  const sql = `update public.masjid_website set data = ${dataPart}, draft = ${draftPart}, published_at = ${pubPart}, updated_at = ${updPart} where slug = ${q(bak.slug)};`;
  await mgmtQuery(sql);
  // verifikasi: bandingkan isi data & draft dengan backup
  const chk = await mgmtQuery(`select (data::text = ${q(bak.dataTxt)}) as data_sama, (draft::text = ${q(bak.draftTxt)}) as draft_sama from public.masjid_website where slug = ${q(bak.slug)}`);
  const row = Array.isArray(chk) ? chk[0] : chk;
  console.log('OK restore:', JSON.stringify(row));
  if (!row || row.data_sama !== true || row.draft_sama !== true) {
    console.error('PERINGATAN: data/draft tidak identik dengan backup — periksa manual.');
    process.exit(1);
  }
}

try {
  if (args.restore) await restore();
  else await save();
} catch (err) {
  console.error(`GAGAL: ${String(err.message || err)}`);
  process.exit(1);
}
