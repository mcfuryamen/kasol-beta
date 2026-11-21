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
    // decodeURIComponent melempar URIError pada escape rusak (mis. `%`) —
    // audit 2026-11: jangan sampai jadi 500, biarkan alur biasa (404).
    let code: string;
    try {
      code = decodeURIComponent(m[1]);
    } catch {
      return next();
    }
    const url = new URL('/r', ctx.url);
    url.searchParams.set('code', code);
    return ctx.rewrite(url);
  }
  return next();
});
