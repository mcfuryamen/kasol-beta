import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac, randomUUID } from 'node:crypto';

const root = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local (fallback untuk dev lokal)
function loadEnv(file) {
  try {
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Za-z_][\w]*)\s*=\s*(.*)\s*$/);
      if (!match || process.env[match[1]]) continue;
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  } catch { /* local env optional */ }
}
loadEnv(path.join(root, '.env.local'));

const adminKey = process.env.ADMIN_API_KEY || '';

// Session token helpers (sama spec dengan api/_token.js agar kompatibel)
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function signPayload(adminKey, payload) {
  return createHmac('sha256', adminKey)
    .update(JSON.stringify(payload))
    .digest('base64url');
}

function mintSessionToken(adminKey, ttlMs = SESSION_TTL_MS) {
  const now = Date.now();
  const tokenId = randomUUID();
  const payload = { id: tokenId, iat: now, exp: now + ttlMs };
  const signature = signPayload(adminKey, payload);
  const token = Buffer.from(JSON.stringify({ ...payload, token: signature })).toString('base64url');
  return { token, expiresAt: now + ttlMs };
}

function validateSessionToken(adminKey, tokenB64url) {
  if (!adminKey || !tokenB64url || typeof tokenB64url !== 'string' || tokenB64url.length < 20) {
    return { ok: false };
  }
  try {
    const b64 = tokenB64url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4);
    const decoded = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
    const { id, iat, exp, token: suppliedSig } = decoded;
    if (!id || typeof iat !== 'number' || typeof exp !== 'number' || !suppliedSig) {
      return { ok: false };
    }
    if (Date.now() > exp) return { ok: false, error: 'token_expired' };
    const expectedSig = signPayload(adminKey, { id, iat, exp });
    const a = Buffer.from(suppliedSig, 'base64url');
    const b = Buffer.from(expectedSig, 'base64url');
    const equal = a.length === b.length && timingSafeEqual(a, b);
    if (!equal) return { ok: false };
    return { ok: true, expiresAt: exp };
  } catch {
    return { ok: false };
  }
}

const allowedTables = new Set(['clients', 'products', 'settings']);
const allowedFunctions = new Set(['activate-license']);
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};
const json = (res, status, body) => { res.writeHead(status, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(body)); };
const readBody = (req) => new Promise((resolve, reject) => { let raw = ''; req.on('data', (chunk) => { raw += chunk; }); req.on('end', () => { try { resolve(JSON.parse(raw || '{}')); } catch (e) { reject(e); } }); req.on('error', reject); });

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a[i] ^ b[i];
  return result === 0;
}

async function proxy(req, res) {
  // Gate: prioritas x-session-key (time-limited) → fallback x-admin-key (legacy)
  let authed = false;

  const sessionKey = req.headers['x-session-key'];
  if (typeof sessionKey === 'string' && sessionKey.length > 0) {
    const v = validateSessionToken(adminKey, sessionKey);
    if (v.ok) authed = true;
    else if (v.error === 'token_expired') return json(res, 401, { error: 'token_expired', refresh: true });
  }

  if (!authed) {
    const supplied = req.headers['x-admin-key'];
    if (typeof supplied === 'string' && supplied.length > 0) {
      const a = Buffer.from(supplied, 'utf8');
      const b = Buffer.from(adminKey, 'utf8');
      authed = a.length === b.length && timingSafeEqual(a, b);
    }
  }

  if (!authed) return json(res, 401, { error: 'unauthorized' });

  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  const body = await readBody(req);
  const base = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!base || !svc) return json(res, 500, { error: 'server_not_configured' });

  let target;
  let options;
  if (body.storageSign === true) {
    const bucket = String(body.bucket || '');
    const objectPath = String(body.path || '').replace(/^\/+/, '');
    if (bucket !== 'bukti' || !objectPath || objectPath.includes('..')) return json(res, 400, { error: 'invalid_storage_path' });
    target = `${base}/storage/v1/object/sign/${bucket}/${encodeURIComponent(objectPath).replace(/%2F/g, '/')}`;
    options = { method: 'POST', headers: { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ expiresIn: 900 }) };
    const upstream = await fetch(target, options);
    const result = await upstream.json();
    if (!upstream.ok) return json(res, upstream.status, { error: 'storage_sign_failed', detail: result });
    const signed = result.signedURL || result.signedUrl;
    return json(res, 200, { url: signed && signed.startsWith('http') ? signed : `${base}/storage/v1${signed}` });
  }

  if (body.storage === true) {
    const bucket = String(body.bucket || '');
    const filename = String(body.filename || '');
    if (bucket !== 'qris' || !/^merchant-qris\.(png|jpe?g|webp)$/i.test(filename)) return json(res, 400, { error: 'invalid_storage_upload' });
    target = `${base}/storage/v1/object/${bucket}/${filename}`;
    options = { method: 'POST', headers: { apikey: svc, Authorization: `Bearer ${svc}`, 'Content-Type': body.contentType, 'x-upsert': 'true' }, body: Buffer.from(String(body.data || ''), 'base64') };
  } else {
    const targetPath = String(body.path || '');
    if (targetPath.startsWith('/rest/v1/')) {
      const table = targetPath.slice(9).split('?')[0].split('/')[0];
      if (!allowedTables.has(table)) return json(res, 403, { error: 'forbidden_table' });
    } else if (targetPath.startsWith('/functions/v1/')) {
      const fn = targetPath.slice(14).split('?')[0].split('/')[0];
      if (!allowedFunctions.has(fn)) return json(res, 403, { error: 'forbidden_function' });
    } else return json(res, 400, { error: 'forbidden_path' });
    const method = body.method || 'GET';
    target = base + targetPath;
    options = { method, headers: { ...(body.headers || {}), apikey: svc, Authorization: `Bearer ${svc}`, ...(method === 'GET' ? {} : { 'Content-Type': 'application/json' }) }, body: method === 'GET' ? undefined : JSON.stringify(body.data) };
  }
  const upstream = await fetch(target, options);
  const text = await upstream.text();
  if (!upstream.ok) return json(res, upstream.status, { error: 'upstream_error', detail: text });
  if (body.storage === true) return json(res, 200, { publicUrl: `${base}/storage/v1/object/public/qris/${body.filename}` });
  res.writeHead(upstream.status, { 'Content-Type': upstream.headers.get('content-type') || 'application/json' });
  res.end(text);
}

// Salt produk (sama dengan api/license.js dan app klien)
const DEFAULT_SALTS = {
  KK5: process.env.LICENSE_SALT_KAKI5 || 'KASIRSOLO-KAKI5-HMAC-V2',
  KSR: process.env.LICENSE_SALT_ROSOK || 'KASIRSOLO-ROSOK-HMAC-V2',
  GBK: process.env.LICENSE_SALT_GEROBAK || 'KASIRSOLO-GEROBAK-HMAC-V2',
  RTL: process.env.LICENSE_SALT_RETAIL || 'KASIRSOLO-RETAIL-HMAC-V2'
};
function getSaltMap() {
  try {
    const override = JSON.parse(process.env.LICENSE_SALTS || '{}');
    return { ...DEFAULT_SALTS, ...override };
  } catch { return { ...DEFAULT_SALTS }; }
}

function checkAdminGate(req) {
  const sessionKey = req.headers['x-session-key'];
  if (typeof sessionKey === 'string' && sessionKey.length > 0) {
    const v = validateSessionToken(adminKey, sessionKey);
    if (v.ok) return { ok: true };
    if (v.error === 'token_expired') return { ok: false, code: 401, error: 'token_expired' };
    return v;
  }
  const supplied = req.headers['x-admin-key'];
  if (typeof supplied === 'string' && supplied.length > 0) {
    const a = Buffer.from(supplied, 'utf8');
    const b = Buffer.from(adminKey, 'utf8');
    if (a.length === b.length && timingSafeEqual(a, b)) return { ok: true };
  }
  return { ok: false, code: 401, error: 'unauthorized' }
}

const server = http.createServer(async (req, res) => {
  try {
    const urlPath = decodeURIComponent(req.url.split('?')[0]);

    // GET /api/token — mint session token untuk browser (dev local)
    if (req.method === 'GET' && urlPath === '/api/token') {
      if (!adminKey) return json(res, 503, { error: 'server_not_configured' });
      const { token, expiresAt } = mintSessionToken(adminKey);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' });
      res.end(JSON.stringify({ token, expiresIn: Math.round((expiresAt - Date.now()) / 1000), expiresAt }));
      return;
    }

    if (urlPath === '/api/rest') return await proxy(req, res);

    // POST /api/license — generate/verify lisensi (dev local)
    if (req.method === 'POST' && urlPath === '/api/license') {
      const gate = checkAdminGate(req);
      if (!gate.ok) return json(res, gate.code, { error: gate.error });

      let body;
      try { body = await readBody(req); } catch { return json(res, 400, { error: 'bad_json' }); }

      const { action, prefix, deviceCode, expCode, serial, salt } = body || {};
      if (!action) return json(res, 400, { error: 'missing_action' });
      const upPrefix = String(prefix || '').toUpperCase();
      const saltMap = getSaltMap();
      const serverSalt = saltMap[upPrefix] || '';
      const effectiveSalt = serverSalt || (typeof salt === 'string' ? salt : '');

      if (action === 'generate') {
        if (!upPrefix || !deviceCode) return json(res, 400, { error: 'missing_input' });
        if (!effectiveSalt) return json(res, 400, { error: 'no_salt_for_prefix' });
        try {
          const mod = await import('./js/license-core.js');
          const serialOut = await mod.generateSerial(upPrefix, effectiveSalt, deviceCode, expCode ?? '99');
          return res.end(JSON.stringify({ serial: serialOut }));
        } catch (e) {
          return json(res, 500, { error: 'generate_failed', detail: String(e?.message || e) });
        }
      }

      if (action === 'verify') {
        if (!upPrefix || !serial || !deviceCode) return json(res, 400, { error: 'missing_input' });
        if (!effectiveSalt) return json(res, 400, { error: 'no_salt_for_prefix' });
        try {
          const mod = await import('./js/license-core.js');
          const result = await mod.verifySerial(upPrefix, effectiveSalt, serial, deviceCode);
          result.expiryText = mod.formatExpiry(result.expCode, result.valid && !result.expired ? new Date() : null);
          return res.end(JSON.stringify(result));
        } catch (e) {
          return json(res, 500, { error: 'verify_failed', detail: String(e?.message || e) });
        }
      }
      return json(res, 400, { error: 'invalid_action' });
    }

    const filePath = path.resolve(root, '.' + (urlPath === '/' ? '/index.html' : urlPath));
    if (!filePath.startsWith(root + path.sep)) return res.writeHead(403).end('Forbidden');
    fs.readFile(filePath, (err, content) => {
      if (err) return res.writeHead(404).end('Not found');
      const contentType = mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
      res.writeHead(200, { 'Cache-Control': 'no-store', 'Content-Type': contentType });
      res.end(content);
    });
  } catch (error) { json(res, 500, { error: 'local_server_error', detail: error.message }); }
});

const port = Number(process.argv[2]) || 8082;
server.listen(port, '0.0.0.0', () => console.log(`Admin local server: http://127.0.0.1:${port} (env: ${process.env.SUPABASE_URL ? 'loaded' : 'missing'})`));