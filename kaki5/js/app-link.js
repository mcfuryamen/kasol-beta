// ==================== APP LINK (ESM) ====================
// Ambil link situs aplikasi AKTIF dari Supabase tabel `settings` (key
// `app_links`, jsonb: app_type -> URL). Berlaku utk semua aplikasi klien:
// tiap app memakai APP_TYPE sendiri sehingga footer/share menampilkan link
// yang sesuai, bukan hardcoded `kasirsolo.app`.
//
// Fallback ke `https://kasirsolo.app` bila: gagal fetch, offline, key belum
// ada, atau app_type belum terdaftar di `app_links`.

import { fetchSetting } from './license.sync.js';

const APP_TYPE = 'kaki5';
const FALLBACK_URL = 'https://kasirsolo.app';

let _cache = null;

/** Ambil peta {app_type: url} dari Supabase (cache + force refresh). */
export async function getAppLinks(force = false) {
  if (_cache && !force) return _cache;
  const links = (await fetchSetting('app_links')) || {};
  _cache = links;
  return links;
}

/** Bersihkan cache (mis. saat online lagi / mau refresh). */
export function clearAppLinksCache() {
  _cache = null;
}

/**
 * URL situs untuk aplikasi aktif ini.
 * @returns {Promise<string>} URL lengkap (dengan skema https).
 */
export async function getAppLink(force = false) {
  const links = await getAppLinks(force);
  const url = links && links[APP_TYPE];
  return (url && /^https?:\/\//i.test(url)) ? url : FALLBACK_URL;
}
