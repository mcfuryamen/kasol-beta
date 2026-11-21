#!/usr/bin/env node
/**
 * Apply / verify migrations on the hosted Supabase project via the
 * Management API (api.supabase.com), authenticated with SUPABASE_ACCESS_TOKEN.
 *
 * Why not apply-migrations-staging.js? That script POSTs to
 * /rest/v1/rpc/exec_sql which only exists if someone manually created that
 * helper in the target DB. On a hosted project it is normally absent. The
 * Management API endpoint /v1/projects/{ref}/database/query is always
 * available to a personal access token.
 *
 * Usage:
 *   node apply-migrations-live.js check   # read-only state inspection (default)
 *   node apply-migrations-live.js apply   # apply migrations in order
 *   node apply-migrations-live.js verify  # post-apply assertions
 *
 * Secrets are read from ../.env.local and never printed.
 */

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const content = fs.readFileSync(envPath, 'utf-8');
  const env = {};
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue; // non KEY=VALUE lines are ignored
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (key && val) env[key] = val;
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.SUPABASE_URL;
const ACCESS_TOKEN = env.SUPABASE_ACCESS_TOKEN;
// Project target: --ref=xxx overrides whatever SUPABASE_URL points at.
// Guard: TPA staging is ozsjflxfkbcygbuxgwyf — the default SUPABASE_URL in
// .env.local points at a DIFFERENT project (minimarket), so always be explicit.
const refArg = process.argv.find((a) => a.startsWith('--ref='));
const PROJECT_REF = refArg ? refArg.slice('--ref='.length) : (SUPABASE_URL ? (SUPABASE_URL.match(/\/\/([a-z0-9]+)\.supabase/i)?.[1] ?? null) : null);

if (!SUPABASE_URL || !ACCESS_TOKEN || !PROJECT_REF) {
  console.error('Missing SUPABASE_URL or SUPABASE_ACCESS_TOKEN in ../.env.local (or ref unparseable). Use --ref=<project-ref> to target a project explicitly.');
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
        timeout: 60000,
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
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('request timeout')));
    req.write(data);
    req.end();
  });
}

function mgmtGet(pathname) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: 'api.supabase.com',
        port: 443,
        path: `/v1/projects/${PROJECT_REF}${pathname}`,
        method: 'GET',
        headers: { Authorization: `Bearer ${ACCESS_TOKEN}` },
        timeout: 60000,
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
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('request timeout')));
    req.end();
  });
}

const SPP_TABLES = ['tpa_spp_types', 'tpa_spp_bills', 'tpa_spp_payments', 'tpa_cash_flows'];
const HELPER_FNS = [
  'tpa_set_updated_at',
  'tpa_is_admin_for_location',
  'tpa_can_access_location',
  'identity_request_recovery',
  'identity_record_security_event',
  'identity_approve_recovery',
  'identity_complete_recovery',
];

async function modeCheck() {
  console.log(`Project ref: ${PROJECT_REF} (read-only check)\n`);

  const tables = await mgmtQuery(
    `select table_name from information_schema.tables where table_schema='public' order by table_name`
  );
  console.log(`Tables in public (${tables.length}):`);
  console.log('  ' + tables.map((t) => t.table_name).join(', '));

  const fnRows = await mgmtQuery(
    `select p.proname, p.oid::regprocedure::text as signature, array_to_string(p.proacl, ',') as acl
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname='public'
       and p.proname in ('${HELPER_FNS.join("','")}')
     order by p.proname, signature`
  );
  console.log(`\nRelevant functions (${fnRows.length}):`);
  for (const r of fnRows) console.log(`  - ${r.signature}  acl=[${r.acl ?? ''}]`);

  const rls = await mgmtQuery(
    `select c.relname, c.relrowsecurity
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname='public' and c.relname in ('${SPP_TABLES.join("','")}')
     order by c.relname`
  );
  console.log(`\nSPP/cash-flow tables present: ${rls.length}/4`);
  for (const r of rls) console.log(`  - ${r.relname} rls=${r.relrowsecurity}`);

  const policies = await mgmtQuery(
    `select tablename, policyname from pg_policies
     where schemaname='public' and (tablename like 'tpa\\_spp%' or tablename in ('tpa_cash_flows','identity_recovery_challenges'))
     order by tablename, policyname`
  );
  console.log(`\nExisting policies on SPP/cash/recovery tables (${policies.length}):`);
  for (const p of policies) console.log(`  - ${p.tablename} :: ${p.policyname}`);

  // Columns referenced by the new policies — missing column would fail CREATE POLICY.
  const cols = await mgmtQuery(
    `select table_name, column_name from information_schema.columns
     where table_schema='public'
       and table_name in ('identity_recovery_challenges','tpa_memberships','tpa_students')
     order by table_name, ordinal_position`
  );
  const byTable = {};
  for (const c of cols) (byTable[c.table_name] ??= []).push(c.column_name);
  const required = {
    identity_recovery_challenges: ['global_identity_id'],
    tpa_memberships: ['user_id', 'is_active', 'location_id', 'role', 'guardian_id'],
    tpa_students: ['id', 'guardian_id'],
  };
  console.log('\nPolicy-referenced columns:');
  for (const [tbl, names] of Object.entries(required)) {
    const have = byTable[tbl] ?? [];
    const missing = names.filter((n) => !have.includes(n));
    console.log(`  - ${tbl}: ${missing.length ? 'MISSING ' + missing.join(', ') : 'all present'}`);
  }
}

async function modeApply() {
  const migrationDir = path.join(__dirname, 'supabase', 'migrations');
  const files = fs
    .readdirSync(migrationDir)
    .filter((f) => f.endsWith('.sql') && (f.startsWith('20261020') || f.startsWith('20261021')))
    .sort();

  if (files.length === 0) {
    console.error('No target migration files found.');
    process.exit(1);
  }

  console.log(`Applying ${files.length} migration(s) to ${PROJECT_REF}:\n`);
  let failed = 0;
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationDir, file), 'utf-8');
    process.stdout.write(`- ${file} ... `);
    try {
      await mgmtQuery(sql); // BEGIN/COMMIT inside the file keeps it atomic
      console.log('OK');
    } catch (err) {
      failed++;
      console.log('FAILED');
      console.log(`  ${err.message}`);
    }
  }
  console.log(`\nDone: ${files.length - failed} applied, ${failed} failed.`);
  if (failed > 0) process.exit(1);
}

async function modeVerify() {
  console.log(`Verifying applied state on ${PROJECT_REF}...\n`);
  let bad = 0;
  const ok = (label, cond, detail = '') => {
    console.log(`${cond ? '  PASS' : '  FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
    if (!cond) bad++;
  };

  // 1. Tables exist with RLS enabled
  const rls = await mgmtQuery(
    `select c.relname, c.relrowsecurity
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname='public' and c.relname in ('${SPP_TABLES.join("','")}')
     order by c.relname`
  );
  for (const t of SPP_TABLES) {
    const row = rls.find((r) => r.relname === t);
    ok(`table ${t} exists + RLS`, !!row && row.relrowsecurity === true);
  }

  // 2. 12 admin/wali policies present
  const policies = await mgmtQuery(
    `select tablename, policyname from pg_policies
     where schemaname='public' and (tablename like 'tpa\\_spp%' or tablename='tpa_cash_flows')
     order by tablename, policyname`
  );
  const expected = [
    ['tpa_spp_types', 'tpa_spp_types_admin_select'],
    ['tpa_spp_types', 'tpa_spp_types_admin_insert'],
    ['tpa_spp_types', 'tpa_spp_types_admin_update'],
    ['tpa_spp_bills', 'tpa_spp_bills_admin_select'],
    ['tpa_spp_bills', 'tpa_spp_bills_admin_insert'],
    ['tpa_spp_bills', 'tpa_spp_bills_admin_update'],
    ['tpa_spp_bills', 'tpa_spp_bills_wali_select'],
    ['tpa_spp_payments', 'tpa_spp_payments_admin_select'],
    ['tpa_spp_payments', 'tpa_spp_payments_admin_insert'],
    ['tpa_spp_payments', 'tpa_spp_payments_admin_update'],
    ['tpa_spp_payments', 'tpa_spp_payments_wali_select'],
    ['tpa_cash_flows', 'tpa_cash_flows_admin_select'],
    ['tpa_cash_flows', 'tpa_cash_flows_admin_insert'],
    ['tpa_cash_flows', 'tpa_cash_flows_admin_update'],
  ];
  for (const [tbl, pol] of expected) {
    ok(`policy ${tbl}::${pol}`, policies.some((p) => p.tablename === tbl && p.policyname === pol));
  }

  // 3. Grants: anon must have nothing on the 4 tables
  const grants = await mgmtQuery(
    `select table_name, grantee, privilege_type from information_schema.role_table_grants
     where table_schema='public'
       and table_name in ('${SPP_TABLES.join("','")}')
       and grantee in ('anon','PUBLIC')
     order by table_name, grantee`
  );
  ok('no anon/PUBLIC grants on SPP tables', grants.length === 0, grants.map((g) => `${g.table_name}/${g.grantee}/${g.privilege_type}`).join(', '));

  // 4. Legacy accept-any-OTP RPC gone
  const legacy = await mgmtQuery(
    `select p.oid::regprocedure::text as signature
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname='public'
       and ((p.proname='identity_approve_recovery' and pg_get_function_identity_arguments(p.oid)='uuid, uuid')
         or (p.proname='identity_complete_recovery' and pg_get_function_identity_arguments(p.oid)='uuid, text, text'))`
  );
  ok('legacy RPC identity_approve_recovery(uuid,uuid) dropped', !legacy.some((r) => r.signature.startsWith('identity_approve_recovery')));
  ok('legacy RPC identity_complete_recovery(uuid,text,text) dropped', !legacy.some((r) => r.signature.startsWith('identity_complete_recovery')));

  // 5. PUBLIC execute revoked on request/record functions
  const acls = await mgmtQuery(
    `select p.proname, p.oid::regprocedure::text as signature, array_to_string(p.proacl, ',') as acl
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname='public' and p.proname in ('identity_request_recovery','identity_record_security_event')
     order by 2`
  );
  for (const r of acls) {
    const acl = r.acl ?? '';
    if (r.proname === 'identity_request_recovery') {
      ok(`PUBLIC execute revoked on ${r.signature}`, !/PUBLIC/i.test(acl), `acl=[${acl}]`);
    } else {
      ok(`service_role-only execute on ${r.signature}`, /service_role/.test(acl) && !/PUBLIC|anon|authenticated/.test(acl), `acl=[${acl}]`);
    }
  }
  if (acls.length === 0) {
    console.log('  (identity_* functions absent on this project — hygiene steps were no-ops by design)');
  }

  // 6. Recovery challenge policies tidy (only if table exists)
  const recTbl = await mgmtQuery(
    `select to_regclass('public.identity_recovery_challenges') as t`
  );
  if (recTbl[0] && recTbl[0].t) {
    const pols = await mgmtQuery(
      `select policyname, cmd from pg_policies
       where schemaname='public' and tablename='identity_recovery_challenges' order by policyname`
    );
    ok(
      'identity_recovery_challenges has exactly select+update policies',
      pols.length === 2 && pols.every((p) => ['SELECT', 'UPDATE'].includes(p.cmd)),
      pols.map((p) => `${p.policyname}(${p.cmd})`).join(', ')
    );
  }

  console.log(`\n${bad === 0 ? 'All checks passed.' : `${bad} check(s) FAILED.`}`);
  if (bad > 0) process.exit(1);
}

const argvRest = process.argv.slice(2);
const mode = (argvRest.find((a) => !a.startsWith('--')) || 'check').toLowerCase();
const runners = { check: modeCheck, apply: modeApply, verify: modeVerify };
if (mode === 'functions') {
  const fns = await mgmtGet('/functions');
  if (!Array.isArray(fns) || fns.length === 0) {
    console.log('No Edge Functions deployed (or endpoint unavailable).');
  } else {
    for (const f of fns) {
      console.log(`- ${f.slug ?? f.name}  status=${f.status ?? '?'}  version=${f.version ?? '?'}  updated=${f.updated_at ?? '?'}`);
    }
  }
  process.exit(0);
}
if (mode === 'columns') {
  const table = process.argv.find((a) => a.startsWith('--table='))?.slice('--table='.length);
  if (!table) {
    console.error('columns mode needs --table=<name>');
    process.exit(1);
  }
  const rows = await mgmtQuery(
    `select ordinal_position, column_name, data_type from information_schema.columns
     where table_schema='public' and table_name='${table}'
     order by ordinal_position`
  );
  for (const r of rows) console.log(`${String(r.ordinal_position).padStart(3)}  ${r.column_name}  ${r.data_type}`);
  process.exit(0);
}
if (!runners[mode]) {
  console.error(`Unknown mode "${mode}". Use: check | apply | verify`);
  process.exit(1);
}
runners[mode]().catch((err) => {
  console.error(`Fatal: ${err.message}`);
  process.exit(1);
});
