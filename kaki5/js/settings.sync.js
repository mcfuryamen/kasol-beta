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
  if (res.ok) showToast('✅ Profil tersinkron ke server');
  return res;
}
