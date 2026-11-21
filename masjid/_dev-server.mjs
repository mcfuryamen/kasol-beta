// Server statis dev untuk repo masjid/ (adm-masjid + web-masjid).
//
// Kenapa bukan `python -m http.server`:
//   - python http.server memakai HTTP/1.0 -> koneksi ditutup tiap response,
//     tidak ada keep-alive, dan setiap request baru membuka socket.
//   - python http.server diam-diam memakai `mimetypes` yang membaca registry
//     Windows (HKCR\MIME\Database\Content Type) -> lambat di mesin ini.
//   - File statis (foto) bisa di-cache browser berhari-hari tanpa header
//     cache-control, sehingga versi lama masih muncul setelah aset diganti.
//
// Pakai: node masjid/_dev-server.mjs [port]
//        default port 8095
import http from 'node:http';
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('./', import.meta.url));
const PORT = Number(process.argv[2] || 8095);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

const server = http.createServer(async (req, res) => {
  const started = process.hrtime.bigint();
  try {
    let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    // Alias rute — cermin model SATU project Vercel (root = masjid/):
    //   "/adm"        -> redirect 302 ke "/adm/" (cermin redirect di vercel.json)
    //   "/adm/*"      -> "/adm-masjid/*"   (admin PWA, scope sw = /adm/)
    //   "/"           -> website klien (index web-masjid)
    //   "/<slug>"     -> website klien (index web-masjid), kecuali path cadangan
    //   "/m/<slug>"   -> tetap didukung (kompatibilitas URL lama)
    //   "/assets/*", "/data-website.json", "/manifest.webmanifest" -> prefix /web-masjid
    //   "/adm-masjid/*", "/web-masjid/*" -> tetap bisa diakses langsung di dev
    // Catatan: di produksi 1-project, aset web memakai path absolut root
    // ("/assets/..." hasil rewrite vercel.json ke /web-masjid/assets/...),
    // sedangkan di dev folder web memang berada di /web-masjid/.
    const RESERVED = new Set([
      'adm', 'adm-masjid', 'web-masjid', 'assets', 'm',
      'data-website.json', 'manifest.webmanifest', 'sw.js', 'vercel.json',
    ]);
    if (pathname === '/adm') {
      res.writeHead(302, { Location: '/adm/' });
      res.end();
      console.log(`${req.method} /adm -> 302 /adm/`);
      return;
    }
    if (pathname === '/adm/' || pathname.startsWith('/adm/')) {
      pathname = '/adm-masjid/' + pathname.slice('/adm/'.length);
    } else if (pathname === '/') {
      pathname = '/web-masjid/index.html';
    } else {
      const mSlug = pathname.match(/^\/(?:m\/)?([a-z0-9-]+)\/?$/i);
      if (mSlug && !RESERVED.has(mSlug[1].toLowerCase())) {
        pathname = '/web-masjid/index.html';
      }
    }
    if (pathname.startsWith('/assets/')) pathname = '/web-masjid' + pathname;
    else if (pathname === '/data-website.json' || pathname === '/manifest.webmanifest') pathname = '/web-masjid' + pathname;
    else if (pathname.endsWith('/')) pathname += 'index.html';

    // Cegah path traversal keluar dari ROOT.
    const filePath = normalize(join(ROOT, pathname));
    if (filePath !== normalize(ROOT).replace(/[\\/]$/, '') && !filePath.startsWith(normalize(ROOT))) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('forbidden');
      return;
    }

    const info = await stat(filePath).catch(() => null);
    if (!info || !info.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('not found: ' + pathname);
      return;
    }

    const type = TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream';
    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': info.size,
      // Dev: jangan biarkan browser menahan aset lama berhari-hari.
      'Cache-Control': 'no-store, must-revalidate',
      'Last-Modified': info.mtime.toUTCString(),
    });
    createReadStream(filePath).pipe(res);

    res.on('finish', () => {
      const ms = Number(process.hrtime.bigint() - started) / 1e6;
      console.log(`${req.method} ${pathname} -> 200 (${info.size} B, ${ms.toFixed(1)} ms)`);
    });
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('server error');
    console.error(err);
  }
});

server.keepAliveTimeout = 30000;
server.listen(PORT, '127.0.0.1', () => {
  console.log(`dev server masjid/ (model 1-project) -> http://127.0.0.1:${PORT}/adm/  dan  http://127.0.0.1:${PORT}/<slug>`);
});
