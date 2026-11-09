/**
 * Middleware dev.
 * =============================================================================
 * Di produksi, link referral `/r/<kode>` diterjemahkan oleh rewrite Vercel
 * (lihat `vercel.json`) ke `/r?code=<kode>`.
 *
 * Di `astro dev` rewrite itu nggak ada, jadi middleware ini meniru perilaku
 * yang sama supaya link yang sama bisa diuji lokal. Output-nya static, jadi
 * middleware cuma relevan untuk mode dev.
 */
import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (ctx, next) => {
  const m = ctx.url.pathname.match(/^\/r\/([^/]+)\/?$/);
  if (m) {
    const code = decodeURIComponent(m[1]);
    const url = new URL('/r', ctx.url);
    url.searchParams.set('code', code);
    return ctx.rewrite(url);
  }
  return next();
});
