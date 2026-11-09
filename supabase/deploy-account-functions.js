#!/usr/bin/env node
/**
 * Deploy Edge Functions "Akun Kasol" via Supabase Management API.
 * =============================================================================
 * Pakai:
 *   node supabase/deploy-account-functions.js            # deploy saja
 *   node supabase/deploy-account-functions.js --secrets  # + set ACCOUNT_CORS_ORIGIN
 *
 * Wajib di .env.local:
 *   SUPABASE_ACCESS_TOKEN   (Personal Access Token, scope projects:write)
 *   SUPABASE_URL            (untuk menurunkan project ref)
 *   SUPABASE_SERVICE_ROLE_KEY (dipakai sebagai secret fungsi)
 * Opsional:
 *   SUPABASE_PROJECT_REF    (override; default diturunkan dari SUPABASE_URL)
 *   ACCOUNT_CORS_ORIGIN     (daftar origin dipisah koma; WAJIB di produksi)
 *
 * PENTING: token/service key tidak pernah dicetak (diredaksi).
 */
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function loadEnv(file) {
  const out = {};
  if (!fs.existsSync(file)) return out;
  for (const line of fs.readFileSync(file, 'utf-8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i > 0) out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

const env = { ...loadEnv(path.join(root, '.env')), ...loadEnv(path.join(root, '.env.local')) };

const token = env.SUPABASE_ACCESS_TOKEN;
const projectRef = env.SUPABASE_PROJECT_REF
  || (env.SUPABASE_URL || '').match(/^https?:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1]
  || '';

const redact = (s) => String(s?.message || s)
  .replaceAll(token || '\u0000', '[REDACTED]')
  .replaceAll(env.SUPABASE_SERVICE_ROLE_KEY || '\u0000', '[REDACTED]');

if (!token) {
  console.error('SUPABASE_ACCESS_TOKEN wajib ada di .env.local');
  process.exit(1);
}
if (!projectRef) {
  console.error('Project ref tidak diketahui — set SUPABASE_PROJECT_REF atau isi SUPABASE_URL');
  process.exit(1);
}

function api(method, apiPath, payload, headers = {}) {
  return new Promise((resolve, reject) => {
    const data = payload == null ? null : JSON.stringify(payload);
    const req = https.request({
      hostname: 'api.supabase.com',
      port: 443,
      path: apiPath,
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
        ...headers,
      },
    }, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body ? JSON.parse(body) : null);
        } else {
          reject(new Error(`${method} ${apiPath} → HTTP ${res.statusCode}: ${body.slice(0, 300)}`));
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const FUNCTIONS = [
  { slug: 'account-register', file: path.join(__dirname, 'functions', 'account-register', 'index.ts'), verifyJwt: false },
];

/**
 * Create-or-update satu fungsi.
 * Management API: POST /functions untuk membuat, PATCH /functions/{slug} untuk
 * memperbarui. `PUT /functions/{slug}` TIDAK didukung (HTTP 404) — itu sebabnya
 * skrip lama di tpa/ tidak pernah berhasil deploy.
 */
async function upsertFunction(f, body) {
  const payload = { name: f.slug, body, verify_jwt: f.verifyJwt };
  let exists = false;
  try {
    await api('GET', `/v1/projects/${projectRef}/functions/${f.slug}`);
    exists = true;
  } catch { /* belum ada → create */ }

  if (exists) {
    console.log(`↻ Fungsi sudah ada — PATCH ${f.slug}`);
    return api('PATCH', `/v1/projects/${projectRef}/functions/${f.slug}`, payload);
  }
  console.log(`+ Membuat fungsi baru — POST ${f.slug}`);
  return api('POST', `/v1/projects/${projectRef}/functions`, { ...payload, slug: f.slug });
}

const withSecrets = process.argv.includes('--secrets');

try {
  for (const f of FUNCTIONS) {
    if (!fs.existsSync(f.file)) throw new Error(`file fungsi tidak ada: ${f.file}`);
    const body = fs.readFileSync(f.file, 'utf-8');
    console.log(`📦 Deploy ${f.slug} (${body.split('\n').length} baris, verify_jwt=${f.verifyJwt})...`);
    await upsertFunction(f, body);
    console.log(`✅ ${f.slug} ter-deploy`);
  }

  if (withSecrets) {
    const secrets = [];
    // SUPABASE_* disediakan otomatis oleh runtime Edge Function dan DITOLAK
    // Management API bila dikirim manual ("must not start with SUPABASE_").
    if (env.SUPABASE_SERVICE_ROLE_KEY) {
      console.log('ℹ️  SUPABASE_SERVICE_ROLE_KEY tidak dikirim — sudah otomatis di runtime Supabase.');
    }
    if (env.ACCOUNT_CORS_ORIGIN) secrets.push({ name: 'ACCOUNT_CORS_ORIGIN', value: env.ACCOUNT_CORS_ORIGIN });
    if (!secrets.length) {
      console.log('⚠️  --secrets diminta tapi SUPABASE_SERVICE_ROLE_KEY / ACCOUNT_CORS_ORIGIN kosong — dilewati.');
    } else {
      console.log(`🔐 Set ${secrets.length} secret: ${secrets.map((s) => s.name).join(', ')}`);
      await api('POST', `/v1/projects/${projectRef}/secrets`, secrets);
      console.log('✅ Secret tersimpan');
    }
  }

  console.log('\nSelesai. Uji cepat:');
  console.log(`  curl -s -X POST "$SUPABASE_URL/functions/v1/account-register" \\`);
  console.log('    -H "Content-Type: application/json" -H "apikey: $ANON_KEY" \\');
  console.log('    -d \'{"wa":"08123456789","pin":"123456","nama":"Uji Akun"}\'');
} catch (e) {
  console.error('❌', redact(e));
  process.exit(1);
}