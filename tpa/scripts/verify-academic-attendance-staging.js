#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const STAGING_REF = 'ozsjflxfkbcygbuxgwyf';
export const REQUIRED_VIEWS = ['tpa_teacher_directory', 'tpa_guardian_directory', 'tpa_student_directory'];
export const REQUIRED_TABLES = [
  'tpa_locations', 'tpa_guardians', 'tpa_teachers', 'tpa_memberships', 'tpa_students',
  'tpa_classes', 'tpa_class_students', 'tpa_class_teachers', 'tpa_schedules',
  'tpa_class_sessions', 'tpa_attendances',
  'tpa_hafalan_progress', 'tpa_iqro_progress'
];
export const REQUIRED_POLICIES = [
  'tpa_class_students_member_select', 'tpa_schedules_member_select',
  'tpa_sessions_member_select', 'tpa_sessions_insert', 'tpa_sessions_update',
  'tpa_attendance_member_select', 'tpa_attendance_insert', 'tpa_attendance_update',
  'tpa_hafalan_member_select', 'tpa_hafalan_insert', 'tpa_hafalan_update',
  'tpa_iqro_member_select', 'tpa_iqro_insert', 'tpa_iqro_update'
];
export const REQUIRED_TRIGGERS = [
  'tpa_class_sessions_tenant', 'tpa_attendances_tenant',
  'tpa_sessions_audit', 'tpa_attendances_audit',
  'tpa_sessions_updated_at', 'tpa_attendances_updated_at',
  'tpa_hafalan_tenant', 'tpa_iqro_tenant',
  'tpa_hafalan_audit', 'tpa_iqro_audit',
  'tpa_hafalan_updated_at', 'tpa_iqro_updated_at'
];

export function parseEnv(filePath) {
  const env = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const index = line.indexOf('=');
    if (index <= 0 || line.trim().startsWith('#')) continue;
    env[line.slice(0, index).trim()] = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, '');
  }
  return env;
}

export function assertStagingUrl(url) {
  const parsed = new URL(url);
  if (parsed.hostname !== `${STAGING_REF}.supabase.co`) throw new Error('STAGING_TARGET_MISMATCH');
}

export function buildVerifierQuery() {
  return `
    WITH required_tables(name) AS (VALUES ${REQUIRED_TABLES.map(name => `('${name}')`).join(',')}),
    required_columns(table_name,column_name) AS (VALUES
      ('tpa_class_sessions','id'),('tpa_class_sessions','location_id'),('tpa_class_sessions','class_id'),('tpa_class_sessions','teacher_id'),('tpa_class_sessions','status'),('tpa_class_sessions','created_by'),
      ('tpa_attendances','id'),('tpa_attendances','location_id'),('tpa_attendances','session_id'),('tpa_attendances','student_id'),('tpa_attendances','status'),('tpa_attendances','recorded_by'),
      ('tpa_hafalan_progress','id'),('tpa_hafalan_progress','location_id'),('tpa_hafalan_progress','student_id'),('tpa_hafalan_progress','teacher_id'),('tpa_hafalan_progress','grade'),('tpa_hafalan_progress','recorded_by'),
      ('tpa_iqro_progress','id'),('tpa_iqro_progress','location_id'),('tpa_iqro_progress','student_id'),('tpa_iqro_progress','teacher_id'),('tpa_iqro_progress','grade'),('tpa_iqro_progress','recorded_by')
    ),
    required_policies(name) AS (VALUES ${REQUIRED_POLICIES.map(name => `('${name}')`).join(',')}),
    required_triggers(name) AS (VALUES ${REQUIRED_TRIGGERS.map(name => `('${name}')`).join(',')})
    SELECT json_build_object(
      'views', (SELECT json_agg(json_build_object('name',r.name,'present',EXISTS (SELECT 1 FROM pg_views v WHERE v.schemaname='public' AND v.viewname=r.name))) FROM (VALUES ('tpa_teacher_directory'),('tpa_guardian_directory'),('tpa_student_directory')) r(name)),
      'tables', (SELECT json_agg(json_build_object('name',r.name,'present',to_regclass('public.'||r.name) IS NOT NULL)) FROM required_tables r),
      'columns', (SELECT json_agg(json_build_object('table_name',r.table_name,'column_name',r.column_name,'present',EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema='public' AND c.table_name=r.table_name AND c.column_name=r.column_name))) FROM required_columns r),
      'rls', (SELECT json_agg(json_build_object('table_name',c.relname,'enabled',c.relrowsecurity)) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname = ANY(ARRAY['tpa_classes','tpa_class_students','tpa_class_teachers','tpa_schedules','tpa_class_sessions','tpa_attendances','tpa_hafalan_progress','tpa_iqro_progress'])),
      'policies', (SELECT json_agg(json_build_object('name',r.name,'present',EXISTS (SELECT 1 FROM pg_policies p WHERE p.schemaname='public' AND p.policyname=r.name))) FROM required_policies r),
      'triggers', (SELECT json_agg(json_build_object('name',r.name,'present',EXISTS (SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND NOT t.tgisinternal AND t.tgname=r.name))) FROM required_triggers r),
      'functions', (SELECT json_agg(json_build_object('name',r.name,'present',EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='public' AND p.proname=r.name))) FROM (VALUES ('tpa_validate_academic_tenant'),('tpa_validate_subject_tenant'),('tpa_validate_session_tenant'),('tpa_validate_attendance_tenant'),('tpa_validate_attendance_audit'),('tpa_validate_session_audit'),('tpa_set_updated_at')) r(name))
    ) AS report;`;
}

export function validateReport(report) {
  const groups = ['views', 'tables', 'columns', 'rls', 'policies', 'triggers', 'functions'];
  const failures = [];
  for (const group of groups) for (const item of report[group] || []) if (item.present === false || item.enabled === false) failures.push(`${group}:${item.name || item.table_name}`);
  return failures;
}

async function main() {
  const envPath = path.resolve(process.cwd(), '..', '.env.local');
  const env = parseEnv(envPath);
  if (!env.SUPABASE_ACCESS_TOKEN) throw new Error('STAGING_CREDENTIALS_MISSING');
  if (env.SUPABASE_STAGING_URL) assertStagingUrl(env.SUPABASE_STAGING_URL);
  const response = await fetch(`https://api.supabase.com/v1/projects/${STAGING_REF}/database/query`, { method: 'POST', headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query: buildVerifierQuery() }) });
  const body = await response.json();
  if (!response.ok) throw new Error(`STAGING_QUERY_FAILED:${body.message || response.status}`);
  const report = body?.[0]?.report;
  const failures = validateReport(report || {});
  if (failures.length) { console.error(`FAIL ${failures.join(', ')}`); process.exitCode = 1; return; }
  console.log(`PASS staging schema/RLS catalog: ${REQUIRED_TABLES.length} tables, ${REQUIRED_POLICIES.length} policies, ${REQUIRED_TRIGGERS.length} triggers`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) main().catch(error => { console.error(`FAIL ${error.message}`); process.exitCode = 1; });
