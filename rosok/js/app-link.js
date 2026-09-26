/* =========================================================================
   KASIR SOLO - ROSOK
   app-link.js — Link situs aplikasi dari Supabase (port kaki5 app-link.js).
   Prioritas: products.store_url > products.vercel_url (kartu produk KSR di
   admin) > settings.app_links['rosok'] > fallback domain rosok.
   Dipakai blok Tentang Aplikasi & share nota supaya link tidak hardcoded.
   ========================================================================= */
import { fetchSetting, getSupabaseClient } from './license.sync.js';

const APP_TYPE = 'rosok';
const FALLBACK_URL = 'https://rosok.kasirsolo.com';

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

/** URL situs untuk aplikasi ini (cache per sesi; force=true untuk refresh). */
export async function getAppLink(force = false) {
  if (_cache && !force) return _cache;
  let url = await fetchProductLink();
  if (!url) {
    const links = (await fetchSetting('app_links')) || {};
    url = links && links[APP_TYPE];
  }
  url = (url && /^https?:\/\//i.test(url)) ? url : FALLBACK_URL;
  _cache = url;
  return url;
}

export function clearAppLinkCache() { _cache = null; }
