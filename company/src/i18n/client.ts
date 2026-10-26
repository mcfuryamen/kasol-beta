/**
 * i18n client — swap teks UI Indonesia ⇄ English tanpa reload.
 * Dipakai lewat <script> di Base.astro (Astro mem-bundle + mengimpor EN).
 * ID = nilai asli di DOM (kanonik); EN = override dari kamus.
 */
import { EN, DEFAULT_LANG, STORAGE_KEY, type Lang } from './dictionary';

const isLang = (v: string | null): v is Lang => v === 'id' || v === 'en';

/** Snapshot innerHTML/atribut asli (bahasa kanonik) sekali saat load. */
type Snap = { html: string; aria?: string; ph?: string };
const originals = new WeakMap<HTMLElement, Snap>();

function snap(el: HTMLElement): Snap {
  let s = originals.get(el);
  if (!s) {
    s = { html: el.innerHTML };
    if (el.hasAttribute('aria-label')) s.aria = el.getAttribute('aria-label')!;
    if (el.hasAttribute('placeholder')) s.ph = el.getAttribute('placeholder')!;
    originals.set(el, s);
  }
  return s;
}

function applyLang(lang: Lang) {
  document.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const s = snap(el);
    el.innerHTML = lang === 'en' && key && EN[key] ? EN[key] : s.html;
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-aria]').forEach((el) => {
    const key = el.getAttribute('data-i18n-aria');
    const s = snap(el);
    el.setAttribute('aria-label', lang === 'en' && key && EN[key] ? EN[key] : s.aria ?? '');
  });
  document.querySelectorAll<HTMLElement>('[data-i18n-ph]').forEach((el) => {
    const key = el.getAttribute('data-i18n-ph');
    const s = snap(el);
    el.setAttribute('placeholder', lang === 'en' && key && EN[key] ? EN[key] : s.ph ?? '');
  });
  document.documentElement.lang = lang;
  document.querySelectorAll('meta[property="og:locale"]').forEach((m) =>
    m.setAttribute('content', lang === 'en' ? 'en_US' : 'id_ID'));
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* privat mode */ }
  syncToggle(lang);
  window.dispatchEvent(new CustomEvent('mks:lang', { detail: { lang } }));
}

function syncToggle(lang: Lang) {
  const btn = document.getElementById('langToggle');
  if (!btn) return;
  btn.setAttribute('aria-pressed', lang === 'en' ? 'true' : 'false');
  btn.setAttribute('data-lang', lang);
}

export function initI18n() {
  let start: Lang = DEFAULT_LANG;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (isLang(stored)) start = stored;
  } catch { /* abaikan */ }
  if (start !== DEFAULT_LANG) applyLang(start);
  else syncToggle(start);

  const btn = document.getElementById('langToggle');
  btn?.addEventListener('click', () => {
    const next: Lang = document.documentElement.lang === 'en' ? 'id' : 'en';
    applyLang(next);
  });
}
