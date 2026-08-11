// ==================== SETTINGS (ESM) — BACKWARD-COMPATIBILITY ENTRY POINT ====================
// Re-exports all public APIs from the split modules so existing imports continue to work.
// New code should import directly from settings.logic.js, settings.ui.js, or settings.sync.js.

// Logic module
export {
  regionSummary,
  validateAlamat,
  validateOwner,
  validateWa,
  buildAlamatPayload,
  saveOwnerLogic,
  saveWaLogic,
  saveAlamatLogic,
  saveNamaWarungLogic,
  loadSettingsData,
  checkProfileNotificationData,
  region
} from './settings.logic.js';

// UI module
export {
  loadSettings,
  checkProfileNotification,
  openOwnerModal,
  closeOwnerModal,
  saveOwner,
  openWaModal,
  closeWaModal,
  saveWa,
  openAlamatModal,
  closeAlamatModal,
  saveAlamat,
  openNameModal,
  closeNameModal,
  saveNamaWarung
} from './settings.ui.js';

// Sync module
export { syncNow } from './settings.sync.js';
