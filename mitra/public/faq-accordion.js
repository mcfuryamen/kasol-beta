/**
 * FAQ akordeon eksklusif — satu item terbuka, yang lain auto-close.
 * Dipisah jadi file eksternal (dulu inline module di index.astro) supaya
 * cukup dengan CSP `script-src 'self'` tanpa hash (audit 2026-11-18).
 */
const faqBox = document.querySelector('.mt-faq');
faqBox?.addEventListener(
  'toggle',
  (e) => {
    const el = e.target;
    if (!el || el.tagName !== 'DETAILS' || !el.open) return;
    faqBox.querySelectorAll('details[open]').forEach((d) => {
      if (d !== el) d.open = false;
    });
  },
  true
);
