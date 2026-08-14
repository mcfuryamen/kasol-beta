// ==================== APP LINK (ESM) ====================
// Ambil link situs aplikasi AKTIF dari Supabase tabel `products` (field
// `store_url` / `vercel_url` dari kartu produk di dashboard admin). Berlaku
// utk semua aplikasi klien: tiap app memakai APP_TYPE sendiri sehingga
// footer/share menampilkan link yang sesuai, bukan hardcoded `kasirsolo.app`.
//
// Prioritas:
//   1. products.store_url  (domain live — dikelola admin di kartu produk)
//   2. products.vercel_url (domain vercel)
//   3. settings.app_links[APP_TYPE] (fallback lama)
//   4. https://kasirsolo.app

import { fetchSetting, getSupabaseClient } from './license.sync.js';

const APP_TYPE = 'kaki5';
const FALLBACK_URL = 'https://kasirsolo.app';

let _cache = null;

/** Ambil link dari tabel `products` (store_url > vercel_url). */
async function fetchProductLink() {
  const sb = getSupabaseClient();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from('products')
      .select('store_url,vercel_url')
      .eq('app_type', APP_TYPE)
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    const raw = data.store_url || data.vercel_url || '';
    return (raw && /^https?:\/\//i.test(raw)) ? raw : null;
  } catch (e) {
    console.warn('fetchProductLink:', e?.message || e);
    return null;
  }
}

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
  if (_cache && !force) return _cache;
  let url = await fetchProductLink();
  if (!url) {
    const links = await getAppLinks(force);
    url = links && links[APP_TYPE];
  }
  url = (url && /^https?:\/\//i.test(url)) ? url : FALLBACK_URL;
  _cache = url;
  return url;
}
