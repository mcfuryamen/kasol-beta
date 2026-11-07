#!/usr/bin/env node
/**
 * Apply ONE migration file to a hosted Supabase project via Management API.
 * Companion to apply-migrations-live.js (whose apply mode filters fixed
 * prefixes 20261020/20261021). This one targets a single explicit file.
 *
 * Usage:
 *   node apply-one-migration.js --file=20261023_tpa_fix_sessions_policy_recursion.sql --ref=ozsjflxfkbcygbuxgwyf
 *
 * Secrets are read from ../.env.local and never printed.
 * After applying, prints current policies on tpa_class_sessions for a quick check.
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
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (key && val) env[key] = val;
  }
  return env;
}

const env = loadEnv();
const ACCESS_TOKEN = env.SUPABASE_ACCESS_TOKEN;
const refArg = process.argv.find((a) => a.startsWith('--ref='));
const PROJECT_REF = refArg ? refArg.slice('--ref='.length) : null;
const fileArg = process.argv.find((a) => a.startsWith('--file='));
const FILE_NAME = fileArg ? fileArg.slice('--file='.length) : null;

if (!ACCESS_TOKEN || !PROJECT_REF || !FILE_NAME) {
  console.error('Usage: node apply-one-migration.js --file=<migration.sql> --ref=<project-ref>');
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

const migrationDir = path.join(__dirname, 'supabase', 'migrations');
const sqlPath = path.join(migrationDir, FILE_NAME);
if (!fs.existsSync(sqlPath)) {
  console.error(`Migration file not found: ${sqlPath}`);
  process.exit(1);
}

const sql = fs.readFileSync(sqlPath, 'utf-8');
console.log(`Applying ${FILE_NAME} to ${PROJECT_REF} ...`);
try {
  await mgmtQuery(sql);
  console.log('OK');
} catch (err) {
  console.error(`FAILED: ${err.message}`);
  process.exit(1);
}

const policies = await mgmtQuery(
  `SELECT policyname, cmd FROM pg_policies WHERE schemaname='public' AND tablename='tpa_class_sessions' ORDER BY policyname`
);
console.log('\nPolicies on tpa_class_sessions now:');
for (const p of policies) console.log(`  - ${p.policyname} (${p.cmd})`);
