#!/usr/bin/env node
/**
 * Local development server untuk Kasir Rosok
 * Gunakan: node run-local.js
 * Akses: http://localhost:8084
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.argv[2] || 8084;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

const server = http.createServer((req, res) => {
  // Set CORS headers untuk ESM modules
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Query string (mis. ?v=MODULAR) tidak boleh ikut ke path/file lookup,
  // karena path.extname() akan menganggap "?v=MODULAR" sebagai bagian extension
  // sehingga MIME type jadi text/plain dan browser menolak module script.
  const pathname = new URL(req.url, 'http://localhost').pathname;
  let filePath = path.join(ROOT, pathname === '/' ? 'index.html' : pathname);
  const extname = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found: ' + req.url);
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n🚀 Kasir Rosok Development Server`);
  console.log(`\n📍 Open browser: http://localhost:${PORT}`);
  console.log(`\n✓ CORS enabled untuk ESM modules`);
  console.log(`✓ Hot reload: Refresh browser untuk melihat perubahan kode\n`);
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
