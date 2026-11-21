#!/usr/bin/env node
/**
 * run-sql.mjs — jalankan file SQL apa pun (mis. skenario QA begin...rollback)
 * via Supabase Management API, lalu cetak result set terakhir sebagai JSON.
 * Dipakai bersama audit-query.js (yang menolak mutasi): file QA transaksional
 * diperlukan di sini karena semua dibungkus rollback.
 *
 * Usage:
 *   node masjid/_qa/run-sql.mjs --ref=<project-ref> --file=masjid/_qa/<file.sql>
 */
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

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

let SQL = '';
if (args.file && args.file !== true) {
  SQL = fs.readFileSync(path.isAbsolute(args.file) ? args.file : path.join(ROOT, args.file), 'utf-8');
} else if (args.sql && args.sql !== true) {
  SQL = args.sql;
}
SQL = (SQL || '').trim();
if (!SQL) { console.error('Missing --sql atau --file'); process.exit(1); }

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
