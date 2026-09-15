// ==================== SETTINGS SYNC (ESM) ====================
// Sync operations only — delegates to sync.js ensureSynced.

import { ensureSynced } from './sync.js';
import { showToast } from './helpers.js';

/**
 * Trigger manual sync and return result.
 * @returns {Promise<{ok:boolean, reason?:string}>}
 */
export async function syncNow() {
  const res = await ensureSynced({ force: true });
  if (res.ok) {
    if (res.reason !== 'already-synced') showToast('✅ Profil tersinkron ke server');
    return res;
  }
  // Alasan spesifik, bukan generic "cek internet" (dulu semua kegagalan
  // tampak sama & menyesatkan).
  const msg = {
    'no-config': 'Komponen sinkronisasi tidak termuat — muat ulang halaman.',
    'offline': 'Perangkat sedang offline — akan otomatis dicoba saat online.',
    'no-profile': 'Isi Nama Usaha dulu di Profil sebelum sinkron.'
  }[res.reason] || ('Gagal sinkron (' + (res.stage || '?') + '): ' + (res.error || '').slice(0, 120));
  showToast(msg, 'error', { duration: 5000 });
  return res;
}
