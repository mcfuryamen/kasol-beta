/**
 * i18n client — swap teks UI Indonesia ⇄ English tanpa reload.
 * Dipakai lewat <script> di Base.astro (Astro mem-bundle + mengimpor EN).
 * ID = nilai asli di DOM (kanonik); EN = override dari kamus.
 *
 * `refreshI18n(root)` dipakai untuk konten yang di-inject JS setelah load
 * (mis. baris tabel dashboard) supaya baris itu ikut berubah saat user
 * ganti bahasa.
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

/** Bahasa aktif (diisi juga oleh script inline di <head> sebelum DOM selesai). */
export function currentLang(): Lang {
  const l = document.documentElement.lang;
  return isLang(l) ? l : DEFAULT_LANG;
}

/**
 * Terapkan override bahasa ke subtree tertentu.
 * Elemen yang belum pernah di-snap -> ID dipakai sebagai snapshot asli,
 * jadi elemen yang baru di-inject tetap bisa ditranslate.
 *
 * `lang` WAJIB dikasih saat maunerah bahasa (dipakai `applyLang`): kalau
 * nggak, bahasa yang dibaca dari `document.documentElement.lang` — yang
 * pada saat toggle diklik masih bahasa LAMA, jadi teksnya tertinggal satu
 * klik. Defaultnya = bahasa aktif sekarang (cukup untuk refresh idempotent).
 */
export function refreshI18n(root: ParentNode = document, lang: Lang = currentLang()): void {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const s = snap(el);
    el.innerHTML = lang === 'en' && key && EN[key] ? EN[key] : s.html;
  });
}

function applyLang(lang: Lang) {
  refreshI18n(document, lang);
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
