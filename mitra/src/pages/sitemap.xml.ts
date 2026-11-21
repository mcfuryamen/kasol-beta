import type { APIRoute } from 'astro';

/**
 * Sitemap app Program Mitra.
 * Halaman `/r/<kode>` ikut TIDAK — itu link per-referral, bukan URL publik
 * yang layak di-index (jugaionesional, kodenya bisa kedaluwarsa).
 */
export const GET: APIRoute = ({ site }) => {
  const base = site ?? 'https://mitra.kasirsolo.com';
  const urls = [
    { path: '/', priority: '1.0', freq: 'weekly' },
    // /daftar & /portal dialihkan ke /akun (2026-11-03 & 2026-11-04) —
    // daftarkan tujuan akhirnya saja.
    { path: '/akun', priority: '0.9', freq: 'weekly' },
  ];
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${new URL(u.path, base)}</loc>
    <changefreq>${u.freq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;
  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
