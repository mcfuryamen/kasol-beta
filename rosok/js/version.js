/* =========================================================================
   KASIR SOLO - ROSOK
   version.js — SUMBER KEBENARAN VERSI TUNGGAL (port kaki5 version.js).
   Dulu APP_VERSION konstanta lokal app.js & token ?v= kata-bebas di index.html
   — tidak ada mekanisme mendeteksi rilis baru pada tab yang menganggur
   (insiden beta 2026-09-04: tab lama tak pernah konvergen). Kini: APP_VERSION
   + CACHE_BUST di sini, cerminannya js/version.json di server, dan update.js
   memaksa refresh lewat overlay saat keduanya berbeda.

   KONVENSI RILIS (jangan pecah — pelajaran insiden v100 kaki5): SATU bump
   menyentuh 4 slot sekaligus:
     1. CACHE_BUST di file ini (+ APP_VERSION bila ada perubahan fitur)
     2. js/version.json  → cacheBust + version + notes (bahasa user)
     3. sw.js            → CACHE_VERSION
     4. index.html       → ?v= pada style.css & js/app.js (angka, tanpa 'v')
   ========================================================================= */
export const APP_VERSION = '1.4.9';
export const CACHE_BUST = 'v70';
