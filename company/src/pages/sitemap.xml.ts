import type { APIRoute } from 'astro';
import { projects, cities } from '../data/portfolio';

export const GET: APIRoute = ({ site }) => {
  const base = site ?? 'https://www.kasirsolo.com';
  const urls = [
    { path: '/', priority: '1.0', freq: 'weekly' },
    { path: '/about', priority: '0.8', freq: 'monthly' },
    { path: '/visi-misi', priority: '0.7', freq: 'monthly' },
    { path: '/rekrutmen', priority: '0.7', freq: 'monthly' },
    { path: '/hardware', priority: '0.9', freq: 'weekly' },
    { path: '/portfolio', priority: '0.9', freq: 'weekly' },
    ...cities.map((c) => ({ path: `/kota/${c.slug}`, priority: '0.8', freq: 'monthly' as const })),
    ...projects.map((p) => ({ path: `/portfolio/${p.slug}`, priority: '0.7', freq: 'monthly' as const })),
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
