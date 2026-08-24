// ============================================================
// Internationalization (i18n) - ID & EN
// ============================================================

import { id as localeId } from '../locales/id';
import { en as localeEn } from '../locales/en';

export type Locale = 'id' | 'en';
type TranslationKeys = keyof typeof localeId;

const locales: Record<Locale, Record<string, string>> = {
  id: localeId,
  en: localeEn,
};

let currentLocale: Locale = (
  (typeof window !== 'undefined' && localStorage.getItem('locale')) || 'id'
) as Locale;

export function setLocale(locale: Locale): void {
  currentLocale = locale;
  if (typeof window !== 'undefined') {
    localStorage.setItem('locale', locale);
  }
}

export function getLocale(): Locale {
  return currentLocale;
}

export function t(key: string, params?: Record<string, string | number>): string {
  let text = locales[currentLocale]?.[key] || locales['id']?.[key] || key;

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(`{${k}}`, String(v));
    }
  }

  return text;
}
