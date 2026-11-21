#!/usr/bin/env node
/**
 * audit-query.js — jalankan SATU query SQL read-only ke project Supabase
 * via Management API (sama jalur dengan apply-migration.js), lalu cetak hasil.
 *
 * Dipakai untuk verifikasi ad-hoc yang tidak (belum) ada presetnya di
 * audit-schema.js. Guard: query yang mengandung kata kerja mutasi ditolak.
 *
 * Usage:
 *   node supabase/audit-query.js --ref=<project-ref> --sql="<select ...>"
 *   node supabase/audit-query.js --ref=<ref> --file=<path.sql>
 *
 * Secrets dibaca dari root .env.local (SUPABASE_ACCESS_TOKEN) & tidak dicetak.
 */

import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

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
if (!REF) { console.error('Missing --ref=<project-ref>'); process.exit(1); }
if (!TOKEN) { console.error('Missing SUPABASE_ACCESS_TOKEN di .env.local'); process.exit(1); }

let SQL = (args.sql && args.sql !== true) ? args.sql : '';
if (args.file && args.file !== true) {
  SQL = fs.readFileSync(path.isAbsolute(args.file) ? args.file : path.join(ROOT, args.file), 'utf-8');
}
SQL = (SQL || '').trim();
if (!SQL) { console.error('Missing --sql="..." atau --file=<path.sql>'); process.exit(1); }

// Guard read-only: buang komentar & literal string dulu, baru cek kata kerja mutasi.
const stripped = SQL.replace(/--[^\n]*/g, ' ').replace(/'(?:[^']|'')*'/g, "''");
if (/\b(insert|update|delete|drop|alter|create|truncate|grant|revoke|truncate|do|call)\b/i.test(stripped)) {
  console.error('DITOLAK: audit-query.js hanya untuk SELECT (read-only).');
  process.exit(1);
}

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

try {
  const out = await mgmtQuery(SQL);
  console.log(JSON.stringify(out, null, 2));
} catch (err) {
  console.error(`GAGAL: ${String(err.message || err)}`);
  process.exit(1);
}
