#!/usr/bin/env node
/**
 * Local development server untuk Kasir Rosok
 * Gunakan: node run-local.js [port]
 * Akses: http://127.0.0.1:8084
 *
 * HARDENING 2026-11-08 (audit P0 — docs/AUDIT-ROSOK-2026-11-08.md):
 * Sebelumnya server ini (a) bind ke SEMUA interface jaringan, (b) mengirim
 * `Access-Control-Allow-Origin: *`, dan (c) menyajikan berkas apa pun di bawah
 * folder ini apa adanya — termasuk `.env.local` (memuat SUPABASE_SERVICE_ROLE_KEY)
 * dan `.git/`. Artinya kunci service_role bisa diambil perangkat lain di LAN,
 * atau oleh situs web apa pun yang sedang dibuka di browser developer.
 * Sekarang: hanya loopback, tanpa CORS, segmen tersembunyi ditolak, path wajib
 * berada di dalam ROOT, dan 404 tidak lagi memantulkan URL permintaan.
 * JANGAN dilonggarkan lagi — berkas rahasia hidup di folder yang sama.
 *
 * Butuh diakses dari HP/LAN (mis. uji printer BLE)? Pakai sadar risiko:
 *   HOST=0.0.0.0 node run-local.js
 * Server akan mencetak peringatan besar; pindahkan dulu rahasia dari folder ini.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.argv[2]) || 8084;
const ROOT = __dirname;
// Default LOOPBACK. Override hanya secara sadar lewat env HOST.
const HOST = process.env.HOST || '127.0.0.1';
const IS_LOOPBACK = HOST === '127.0.0.1' || HOST === 'localhost' || HOST === '::1';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

// Nama yang ditolak walau tidak berawalan titik (isi folder, bukan aset aplikasi).
const DENY_SEGMENTS = new Set(['node_modules', 'package.json', 'package-lock.json']);

/**
 * Ubah URL permintaan menjadi path absolut DI DALAM ROOT, atau null bila ditolak.
 * Penolakan: segmen tersembunyi (.env.local, .git, .vercel, ...), backslash
 * (separator Windows yang diselundupkan), dan hasil resolve di luar ROOT.
 */
function resolveSafePath(requestUrl) {
  let pathname;
  try {
    // decodeURIComponent: tanpa ini `%2e%2e%2f` lolos dari pemeriksaan segmen.
    pathname = decodeURIComponent(new URL(requestUrl, 'http://localhost').pathname);
  } catch {
    return null;
  }
  if (pathname.includes('\0') || pathname.includes('\\')) return null;

  const segments = pathname.split('/').filter(Boolean);
  if (segments.some(s => s.startsWith('.') || DENY_SEGMENTS.has(s.toLowerCase()))) return null;

  const target = (pathname === '' || pathname === '/') ? '/index.html' : pathname;
  const resolved = path.resolve(ROOT, '.' + target);
  // Kontainmen: satu-satunya jaminan yang menahan '..' & trik separator.
  if (resolved !== ROOT && !resolved.startsWith(ROOT + path.sep)) return null;
  return resolved;
}

function send(res, status, contentType, body) {
  res.writeHead(status, { 'Content-Type': contentType });
  res.end(body);
}

const server = http.createServer((req, res) => {
  // Header keamanan dasar, paritas vercel.json — server dev sekalipun.
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');

  // TANPA CORS: aplikasi ini di-serve same-origin (index.html memuat ./js/*).
  // Header '*' dulu ada "untuk ESM modules" — tidak diperlukan dan justru
  // membuat halaman mana pun bisa membaca respons server ini.

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    send(res, 405, 'text/plain; charset=utf-8', '405 Method Not Allowed');
    return;
  }

  // Query string (mis. ?v=85) tidak boleh ikut ke path/file lookup, karena
  // path.extname() akan menganggap "?v=85" sebagai bagian extension sehingga
  // MIME type jadi text/plain dan browser menolak module script.
  const filePath = resolveSafePath(req.url);
  if (!filePath) {
    send(res, 404, 'text/plain; charset=utf-8', '404 Not Found');
    return;
  }

  const extname = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // Pesan generik: tidak memantulkan URL (path traversal/penyembunyian jejak).
      send(res, 404, 'text/plain; charset=utf-8', '404 Not Found');
      return;
    }
    send(res, 200, contentType, data);
  });
});

server.listen(PORT, HOST, () => {
  console.log(`\n🚀 Kasir Rosok Development Server`);
  console.log(`\n📍 Open browser: http://${IS_LOOPBACK ? '127.0.0.1' : HOST}:${PORT}`);
  console.log(`✓ Bind: ${HOST}${IS_LOOPBACK ? ' (loopback saja)' : ' ⚠️  TERBUKA KE JARINGAN'}`);
  console.log(`✓ Rahasia ditolak: berkas/segmen tersembunyi (.env.local, .git, .vercel) + node_modules`);
  console.log(`✓ Hot reload: Refresh browser untuk melihat perubahan kode\n`);
  if (!IS_LOOPBACK) {
    console.log('⚠️  PERINGATAN: server ini terbuka untuk perangkat lain di jaringan.');
    console.log('   Folder ini memuat .env.local (SUPABASE_SERVICE_ROLE_KEY). Pindahkan');
    console.log('   rahasia keluar dari folder aplikasi, atau kembali ke mode loopback.\n');
  }
  console.log(`Press Ctrl+C untuk stop server\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} sudah digunakan`);
    console.error(`   Coba port lain atau kill process yang pakai port ini`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});
