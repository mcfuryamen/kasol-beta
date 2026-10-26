#!/usr/bin/env node
/**
 * Apply satu file SQL ke project Supabase via Management API.
 *
 * Alur wajib: dry-run (ROLLBACK) dulu → apply (COMMIT) → verify.
 * Semua DDL Postgres bersifat transaksional, jadi dry-run benar-benar
 * menguji syntaks + permission tanpa meninggalkan jejak.
 *
 * Usage:
 *   node supabase/apply-migration.js --ref=<ref> --file=<path.sql> --dry-run
 *   node supabase/apply-migration.js --ref=<ref> --file=<path.sql> --apply
 *   node supabase/apply-migration.js --ref=<ref> --verify
 *
 * Secrets dibaca dari root .env.local dan TIDAK pernah dicetak.
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function loadEnv() {
  const envPath = path.join(ROOT, '.env.local');
  const content = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (key && val) env[key] = val;
  }
  return env;
}

const env = loadEnv();
const ACCESS_TOKEN = env.SUPABASE_ACCESS_TOKEN;
const arg = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : null;
};
const PROJECT_REF = arg('ref');
const FILE = arg('file');
const DRY_RUN = process.argv.includes('--dry-run');
const APPLY = process.argv.includes('--apply');
const VERIFY = process.argv.includes('--verify');

if (!ACCESS_TOKEN) {
  console.error('Missing SUPABASE_ACCESS_TOKEN in ../.env.local');
  process.exit(1);
}
if (!PROJECT_REF) {
  console.error('Missing --ref=<project-ref>');
  process.exit(1);
}

function mgmtQuery(sql) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query: sql });
    const req = https.request(
      {
        hostname: 'api.supabase.com',
        port: 443,
        path: `/v1/projects/${PROJECT_REF}/database/query`,
        method: 'POST',
        headers: {
          Authorization: `Bearer ${ACCESS_TOKEN}`,
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
            try {
              resolve(JSON.parse(body || '[]'));
            } catch {
              resolve(body);
            }
          } else {
            let msg = body;
            try {
              const p = JSON.parse(body);
              msg = p.message || p.error_description || p.error || JSON.stringify(p);
            } catch {}
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

const VERIFY_QUERIES = {
  new_tables: `
    select c.relname as table_name, c.relrowsecurity as rls
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('global_identities','licenses','license_devices','app_memberships')
    order by c.relname`,

  new_functions: `
    select p.proname as name, p.prosecdef as security_definer
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'current_global_identity_id','current_app_key','license_activate_device',
      'license_claim_identity','hub_my_licenses')
    order by p.proname`,

  policies: `
    select tablename, policyname, cmd from pg_policies
    where schemaname = 'public' and tablename in
      ('global_identities','licenses','license_devices','app_memberships')
    order by tablename, policyname`,

  counts: `
    select 'global_identities' as t, count(*)::int as n from public.global_identities
    union all select 'licenses', count(*)::int from public.licenses
    union all select 'license_devices', count(*)::int from public.license_devices
    union all select 'app_memberships', count(*)::int from public.app_memberships`,

  license_breakdown: `
    select app_type, status, plan, max_devices, count(*)::int as n
    from public.licenses group by 1,2,3,4 order by 1`,

  device_status: `
    select status, count(*)::int as n from public.license_devices group by 1 order by 1`,

  clients_backfilled: `
    select count(*)::int as total_clients,
           count(*) filter (where global_identity_id is not null)::int as terklaim
    from public.clients`,

  guard_extended: `
    select p.proname, pg_get_functiondef(p.oid) like '%global_identity_id%' as guards_identity
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'clients_guard_admin_columns'`
};

async function runVerify() {
  console.log(`# Verify ${PROJECT_REF}\n`);
  for (const [name, sql] of Object.entries(VERIFY_QUERIES)) {
    process.stdout.write(`## ${name} ... `);
    try {
      const out = await mgmtQuery(sql);
      console.log('OK');
      console.log(JSON.stringify(out, null, 2));
    } catch (err) {
      console.log('ERROR');
      console.log(String(err.message || err));
    }
    console.log('');
  }
}

async function runApply() {
  if (!FILE) {
    console.error('Missing --file=<path.sql>');
    process.exit(1);
  }
  const abs = path.isAbsolute(FILE) ? FILE : path.join(ROOT, FILE);
  if (!fs.existsSync(abs)) {
    console.error(`File not found: ${abs}`);
    process.exit(1);
  }
  const body = fs.readFileSync(abs, 'utf-8');
  // Buang BEGIN/COMMIT level-top HANYA di baris pertama/terakhir yang bukan
  // komentar. JANGAN pakai regex /^BEGIN/im — itu ikut mencabut baris "BEGIN"
  // di dalam body function plpgsql dan merusak function trigger.
  let sql = body;
  const stripTopLevel = (text, keyword) => {
    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const t = lines[i].trim();
      if (!t || t.startsWith('--')) continue;
      if (new RegExp(`^${keyword}\\s*;?$`, 'i').test(t)) { lines.splice(i, 1); break; }
      break;
    }
    return lines.join('\n');
  };
  sql = stripTopLevel(sql, 'BEGIN');
  const tail = sql.split(/\r?\n/);
  for (let i = tail.length - 1; i >= 0; i--) {
    const t = tail[i].trim();
    if (!t || t.startsWith('--')) continue;
    if (/^COMMIT\s*;?$/i.test(t)) { tail.splice(i, 1); break; }
    break;
  }
  sql = tail.join('\n');
  const wrapped = `begin;\n${sql}\n${DRY_RUN ? 'rollback;' : 'commit;'}`;

  console.log(`# ${DRY_RUN ? 'DRY-RUN (rollback)' : 'APPLY (commit)'} → ${PROJECT_REF}`);
  console.log(`# file: ${abs}`);
  console.log(`# size: ${body.length} bytes\n`);

  try {
    await mgmtQuery(wrapped);
    console.log(DRY_RUN
      ? '✅ DRY-RUN OK — semua DDL lolos, tidak ada perubahan tersisa.'
      : '✅ APPLY OK — transaksi di-commit.');
  } catch (err) {
    console.error('❌ GAGAL:');
    console.error(String(err.message || err));
    process.exit(1);
  }
}

if (VERIFY) {
  await runVerify();
} else if (APPLY || DRY_RUN) {
  await runApply();
} else {
  console.error('Pilih salah satu: --dry-run | --apply | --verify');
  process.exit(1);
}
