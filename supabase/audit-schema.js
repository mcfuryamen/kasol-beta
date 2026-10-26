#!/usr/bin/env node
/**
 * Audit skema read-only untuk satu project Supabase via Management API.
 *
 * Dipakai sebelum menulis/aplikasi migrasi supaya tidak menebak bentuk
 * tabel yang sebenarnya ada di live (repo migration file bisa BASI).
 *
 * Usage:
 *   node supabase/audit-schema.js --ref=<project-ref> [--only=<queryName>,<queryName>]
 *
 * Secrets dibaca dari root .env.local dan TIDAK pernah dicetak.
 * Query bersifat SELECT-only; tidak ada DDL/DML di file ini.
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
const refArg = process.argv.find((a) => a.startsWith('--ref='));
const onlyArg = process.argv.find((a) => a.startsWith('--only='));
const PROJECT_REF = refArg ? refArg.slice('--ref='.length) : null;

if (!ACCESS_TOKEN) {
  console.error('Missing SUPABASE_ACCESS_TOKEN in ../.env.local');
  process.exit(1);
}
if (!PROJECT_REF) {
  console.error('Missing --ref=<project-ref>. Contoh: --ref=hhywrvedlwljawgxzpkq');
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
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

const QUERIES = {
  tables: `
    select table_name
    from information_schema.tables
    where table_schema = 'public'
    order by table_name`,

  tables_ext: `
    select c.relname as table_name,
           c.relrowsecurity as rls_enabled,
           (select count(*) from pg_class x where x.oid = c.oid) as oid
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p')
    order by c.relname`,

  clients_columns: `
    select column_name, data_type, is_nullable, column_default
    from information_schema.columns
    where table_schema = 'public' and table_name = 'clients'
    order by ordinal_position`,

  clients_indexes: `
    select indexname, indexdef
    from pg_indexes
    where schemaname = 'public' and tablename = 'clients'
    order by indexname`,

  clients_policies: `
    select policyname, cmd, permissive, qual, with_check
    from pg_policies
    where schemaname = 'public' and tablename = 'clients'
    order by policyname`,

  functions: `
    select p.proname as name,
           pg_get_function_identity_arguments(p.oid) as args,
           p.prosecdef as security_definer
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
    order by p.proname`,

  identity_tables: `
    select table_name, column_name, data_type
    from information_schema.columns
    where table_schema = 'public'
      and (table_name like 'identity%' or table_name like 'global%'
           or table_name like '%membership%' or table_name like '%license%')
    order by table_name, ordinal_position`,

  products: `
    select id, app_type, kode_produk,
           (salt is not null) as has_salt,
           length(salt) as salt_len,
           tx_quota, price_label, status
    from public.products
    order by app_type`,

  clients_stats: `
    select app_type,
           count(*)::int as total,
           count(*) filter (where license_status = 'aktif')::int as lisensi_aktif,
           count(*) filter (where license_status is null or license_status = 'belum')::int as tanpa_lisensi,
           count(*) filter (where global_identity_id is not null)::int as punya_akun
    from public.clients
    group by app_type
    order by app_type`,

  clients_sample: `
    select unit_id, app_type, device_code,
           license_status, (license_serial is not null) as punya_serial,
           no_whatsapp, nama_usaha
    from public.clients
    order by created_at desc
    limit 12`,

  clients_nulls: `
    select count(*)::int as total,
           count(*) filter (where unit_id is null)::int as unit_id_null,
           count(*) filter (where device_code is null)::int as device_code_null,
           count(*) filter (where license_serial is null)::int as serial_null,
           count(*) filter (where no_whatsapp is null or btrim(no_whatsapp) = '')::int as wa_kosong
    from public.clients`,

  serial_dupes: `
    select license_serial, count(*)::int as n
    from public.clients
    where license_serial is not null and btrim(license_serial) <> ''
    group by license_serial
    having count(*) > 1
    order by n desc
    limit 10`,

  wa_dupes: `
    select lower(btrim(no_whatsapp)) as wa, count(*)::int as n,
           count(distinct app_type)::int as n_app
    from public.clients
    where no_whatsapp is not null and btrim(no_whatsapp) <> ''
    group by lower(btrim(no_whatsapp))
    having count(*) > 1
    order by n desc
    limit 10`,

  tx_quota_cols: `
    select table_name, column_name, data_type
    from information_schema.columns
    where table_schema = 'public'
      and column_name in ('tx_month','tx_used','tx_adjust','tx_updated_at','tx_quota')
    order by table_name, column_name`,

  settings_keys: `
    select key from public.settings order by key`,

  // ── Deep dive untuk desain Hub ──────────────────────────────────────────
  guard_trigger: `
    select c.relname as table_name, tg.tgname, tgenabled, pg_get_triggerdef(tg.oid) as def
    from pg_trigger tg
    join pg_class c on c.oid = tg.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and not tg.tgisinternal
      and c.relname in ('clients','products','settings')
    order by c.relname, tg.tgname`,

  guard_fn_body: `
    select p.proname, pg_get_functiondef(p.oid) as body
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('clients_guard_admin_columns','can_access_business',
                        'can_access_outlet','can_manage_outlet','can_view_outlet',
                        'has_role','assert_same_outlet','prevent_outlet_change')
    order by p.proname`,

  businesses_cols: `
    select table_name, column_name, data_type, is_nullable
    from information_schema.columns
    where table_schema = 'public' and table_name in ('businesses','outlets','outlet_memberships','profiles','customers')
    order by table_name, ordinal_position`,

  outlet_memberships_sample: `
    select om.user_id, om.outlet_id, om.role, om.created_at, o.name
    from public.outlet_memberships om
    left join public.outlets o on o.id = om.outlet_id
    order by om.created_at desc limit 10`,

  identity_id_samples: `
    select 'recovery' as src, global_identity_id::text as gid, count(*)::int as n
    from public.identity_recovery_challenges group by 2
    union all
    select 'events', global_identity_id::text, count(*)::int
    from public.identity_security_events group by 2
    limit 20`,

  identity_counts: `
    select 'otp_attempts' as t, count(*)::int as n from public.identity_otp_attempts
    union all select 'recovery_challenges', count(*)::int from public.identity_recovery_challenges
    union all select 'security_events', count(*)::int from public.identity_security_events
    union all select 'businesses', count(*)::int from public.businesses
    union all select 'outlets', count(*)::int from public.outlets
    union all select 'outlet_memberships', count(*)::int from public.outlet_memberships
    union all select 'profiles', count(*)::int from public.profiles
    union all select 'products', count(*)::int from public.products`,

  products_rest: `
    select app_type, kode_produk, (salt is not null) as has_salt, tx_quota, price_label, status
    from public.products order by app_type`,

  clients_full: `
    select id, unit_id, app_type, device_code, install_id, license_status,
           license_serial, license_expires_at, status, nama_usaha, nama_pemilik,
           no_whatsapp, tx_month, tx_used, first_seen, created_at
    from public.clients order by created_at`,

  unit_device_drift: `
    select unit_id, app_type, device_code,
           (unit_id like app_type || '-%') as prefix_ok,
           (split_part(unit_id,'-',2) || '-' || split_part(unit_id,'-',3)) = device_code as code_match
    from public.clients
    where device_code is not null
    order by app_type, created_at`,

  auth_users_sample: `
    select count(*)::int as total,
           count(*) filter (where phone is not null)::int as with_phone,
           count(*) filter (where email like '%@accounts.kasirsolo.local')::int as synthetic_email
    from auth.users`,

  extensions: `
    select extname, extversion from pg_extension order by extname`,

  // ── Slipportal mitra (Fase 1) ───────────────────────────────────────────
  settings_columns: `
    select column_name, data_type, is_nullable, column_default
    from information_schema.columns
    where table_schema = 'public' and table_name = 'settings'
    order by ordinal_position`,

  settings_values: `
    select key, left(value::text, 120) as value_preview, length(value::text) as len
    from public.settings order by key`,

  policies_all: `
    select tablename, policyname, cmd, roles::text, permissive,
           left(coalesce(qual,''), 80) as qual
    from pg_policies
    where schemaname = 'public'
    order by tablename, policyname`,

  rls_tables: `
    select c.relname as table_name, c.relrowsecurity as rls_enabled,
           c.relforcerowsecurity as rls_forced
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p')
      and c.relrowsecurity
    order by c.relname`,

  rls_auto_enable_body: `
    select p.proname, pg_get_functiondef(p.oid) as body
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'`,

  rls_auto_enable_triggers: `
    select c.relname as table_name, tg.tgname, tgenabled, pg_get_triggerdef(tg.oid) as def
    from pg_trigger tg
    join pg_class c on c.oid = tg.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and not tg.tgisinternal
      and tg.tgname ilike '%rls%'
    order by c.relname`,

  referral_tables_exist: `
    select c.relname as table_name, c.relrowsecurity as rls_enabled
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and c.relname in ('referral_partners','referral_wallets','payout_requests',
                        'license_codes','code_redemptions','partner_access_tokens')
    order by c.relname`,

  partner_functions_exist: `
    select p.proname as name, pg_get_function_identity_arguments(p.oid) as args
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.proname like 'partner%' or p.proname like '%payout%'
           or p.proname like 'wallet%' or p.proname like 'code_%')
    order by p.proname`,

  settings_policy: `
    select tablename, policyname, cmd, roles::text, qual, with_check
    from pg_policies
    where schemaname = 'public' and tablename in ('settings','licenses','license_devices')
    order by tablename, policyname`,

  func_schemas: `
    select p.proname, n.nspname as schema
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where p.proname in ('digest','gen_random_uuid','sha256','hmac','crypt','gen_random_bytes')
      and n.nspname not in ('pg_catalog','information_schema')
    order by p.proname, n.nspname`,

  settings_indexes: `
    select indexname, indexdef from pg_indexes
    where schemaname = 'public' and tablename = 'settings'
    order by indexname`,

  // ── Mitra portal Fase 1 (verifikasi migrasi) ───────────────────────────
  mitra_tables: `
    select c.relname as table_name, c.relrowsecurity as rls_enabled,
           (select count(*) from pg_indexes i
             where i.schemaname='public' and i.tablename = c.relname)::int as idx_count
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and c.relname in ('referral_partners','referral_wallets','payout_requests',
                        'license_codes','code_redemptions')
    order by c.relname`,

  mitra_functions: `
    select p.proname as name,
           pg_get_function_identity_arguments(p.oid) as args,
           p.prosecdef as security_definer,
           has_function_privilege('anon', p.oid, 'execute') as anon_exec,
           has_function_privilege('authenticated', p.oid, 'execute') as auth_exec,
           has_function_privilege('service_role', p.oid, 'execute') as svc_exec
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.proname like 'partner_%' or p.proname = 'payout_request'
           or p.proname = 'referral_resolve_pending')
    order by p.proname`,

  mitra_policies: `
    select tablename, policyname, cmd, roles::text
    from pg_policies
    where schemaname = 'public'
      and tablename in ('referral_partners','referral_wallets','payout_requests',
                        'license_codes','code_redemptions')
    order by tablename, policyname`,

  referral_config: `
    select key, value, updated_at from public.settings where key = 'referral_config'`,

  clients_referral_columns: `
    select column_name, data_type, is_nullable, column_default
    from information_schema.columns
    where table_schema = 'public' and table_name = 'clients'
      and column_name in ('purchase_code','purchase_discount','price_paid',
                          'voucher_id','referred_by_code')
    order by column_name`,

  mitra_counts: `
    select 'referral_partners' as t, count(*)::int as n from public.referral_partners
    union all select 'referral_wallets', count(*)::int from public.referral_wallets
    union all select 'payout_requests', count(*)::int from public.payout_requests
    union all select 'license_codes', count(*)::int from public.license_codes
    union all select 'code_redemptions', count(*)::int from public.code_redemptions`,

  mitra_acl: `
    select p.proname as name,
           pg_get_function_identity_arguments(p.oid) as args,
           p.proacl::text as acl
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and (p.proname like 'partner_%' or p.proname = 'payout_request'
           or p.proname = 'referral_resolve_pending')
    order by p.proname`,

  // Baris nyata mitra + kode referalnya (verifikasi kode universal app_type='*').
  mitra_rows: `
    select p.id, p.code as partner_code, p.nama, p.no_whatsapp, p.kota,
           p.status, p.tier, p.produk_interest, p.registered_via,
           lc.code as ref_code, lc.kind as ref_kind, lc.app_type as ref_app_type,
           lc.status as ref_status, lc.discount_type, lc.discount_value,
           lc.min_purchase, lc.expires_at
    from public.referral_partners p
    left join public.license_codes lc
           on lc.owner_partner_id = p.id and lc.kind = 'referral'
    order by p.created_at`,

  // Semua kode (referral + voucher diskon) + produk yang dicakupnya.
  mitra_vouchers: `
    select lc.code, lc.kind, lc.app_type, lc.created_by, lc.status,
           lc.discount_value, lc.min_purchase, lc.expires_at,
           p.code as partner_code
    from public.license_codes lc
    left join public.referral_partners p on p.id = lc.owner_partner_id
    order by lc.created_at`,
};

const names = onlyArg
  ? onlyArg.slice('--only='.length).split(',').map((s) => s.trim()).filter(Boolean)
  : Object.keys(QUERIES);

console.log(`# Audit schema Supabase`);
console.log(`# project ref : ${PROJECT_REF}`);
console.log(`# mode        : READ-ONLY (SELECT only)`);
console.log('');

for (const name of names) {
  const sql = QUERIES[name];
  if (!sql) {
    console.log(`## ${name}\n!! query tidak dikenal — lewati\n`);
    continue;
  }
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
