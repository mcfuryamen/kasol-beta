import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
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

async function proxy(req, res) {
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  if ((req.headers['x-admin-key'] || '') !== (process.env.ADMIN_API_KEY || '')) return json(res, 401, { error: 'unauthorized' });
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

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.split('?')[0] === '/api/rest') return await proxy(req, res);
    const urlPath = decodeURIComponent(req.url.split('?')[0]);
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
