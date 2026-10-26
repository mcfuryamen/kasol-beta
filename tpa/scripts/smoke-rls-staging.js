#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

export const STAGING_REF = 'ozsjflxfkbcygbuxgwyf';
export const ROLES = ['admin', 'ustadz', 'wali'];

function parseEnv(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const index = line.indexOf('=');
    if (index <= 0 || line.trim().startsWith('#')) continue;
    env[line.slice(0, index).trim()] = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return env;
}

export function accountEnvKey(role) { return `TPA_STAGING_${role.toUpperCase()}_EMAIL`; }
export function passwordEnvKey(role) { return `TPA_STAGING_${role.toUpperCase()}_PASSWORD`; }

export function missingRoles(env) {
  return ROLES.filter(role => !env[accountEnvKey(role)] || !env[passwordEnvKey(role)]);
}

async function checkRole(client, role, email, password) {
  const { data: auth, error: authError } = await client.auth.signInWithPassword({ email, password });
  if (authError || !auth?.user) return { role, status: 'FAIL', reason: authError?.code || 'AUTH_FAILED' };
  const { data: profile, error: profileError } = await client.from('profiles').select('id,is_active').eq('id', auth.user.id).maybeSingle();
  const { data: memberships, error: membershipError } = await client.from('tpa_memberships').select('role,location_id,is_active,teacher_id,guardian_id').eq('user_id', auth.user.id).eq('is_active', true);
  const actual = memberships?.[0]?.role;
  const checks = {};
  for (const table of ['tpa_students', 'tpa_classes', 'tpa_schedules', 'tpa_class_sessions', 'tpa_attendances', 'tpa_hafalan_progress', 'tpa_iqro_progress']) {
    const { error } = await client.from(table).select('*', { count: 'exact', head: true });
    checks[table] = error ? error.code || 'ERROR' : 'OK';
  }
  await client.auth.signOut();
  return { role, status: profileError || membershipError || !profile || profile.is_active === false ? 'FAIL' : 'PASS', actualRole: actual || null, membershipCount: memberships?.length || 0, checks };
}

async function main() {
  const env = parseEnv(path.resolve(process.cwd(), '..', '.env.staging'));
  const missing = missingRoles(env);
  if (missing.length) {
    console.log(`BLOCKED missing existing staging account references: ${missing.join(', ')}`);
    console.log(`Provide ${ROLES.map(role => `${accountEnvKey(role)} and ${passwordEnvKey(role)}`).join(', ')} in ignored .env.staging; no account or business data was created.`);
    return;
  }
  const url = env.SUPABASE_URL;
  if (url !== `https://${STAGING_REF}.supabase.co`) throw new Error('STAGING_TARGET_MISMATCH');
  if (!env.VITE_SUPABASE_ANON_KEY) throw new Error('STAGING_ANON_KEY_MISSING');
  const results = [];
  for (const role of ROLES) {
    const client = createClient(url, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    results.push(await checkRole(client, role, env[accountEnvKey(role)], env[passwordEnvKey(role)]));
  }
  for (const result of results) console.log(JSON.stringify(result));
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname.replace(/^\//, '').replaceAll('/', path.sep)) main().catch(error => { console.error(`FAIL ${error.message}`); process.exitCode = 1; });
