/**
 * Bootstrap bahasa sebelum paint (dulu inline di <head> Base.astro).
 * Dipisah jadi file eksternal supaya CSP `script-src 'self'` cukup —
 * tanpa hash/nonce yang mudah basi kalau skripnya diedit (audit 2026-11-18).
 * Isi logic sama persis dengan inline lama: baca localStorage → set lang +
 * atribut data-lang di <html>.
 */
try {
  var l = localStorage.getItem('mks-lang');
  if (l === 'en') document.documentElement.lang = 'en';
  document.documentElement.setAttribute('data-lang', l === 'en' ? 'en' : 'id');
} catch (e) { /* privat mode */ }
