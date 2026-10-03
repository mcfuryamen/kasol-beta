// ==================== LAUNDRY LICENSE BOOTSTRAP ====================
// Menyatukan modul lisensi kaki5 (license.logic/ui/sync + quota.offline +
// purchase) dengan aplikasi laundry:
//   • migrasi sekali dari state lisensi inline lama (DB.license v2)
//   • wiring UI (chip/banner/kartu/sheet) + delegasi data-action modul
//   • boot sequence standar ekosistem: ensureUnitId → reanchor → sync →
//     verify serial-bound → push profil → gate → realtime + interval 60 dtk
import { setLicenseRefs, checkLicenseGate, enforceRevoked, renderLicenseInfoCard, updateTrialChip, hideQuotaBanner, openLicenseSheet as openLicenseSheetFromUI } from './license.ui.js';
import { syncLicenseStatus, reanchorUnitId, verifyAndAssignSerial } from './license.sync.js';
import { startTrial, incrementTxCount, isLicensed, getLicenseStatus, getUnitId, ensureUnitId, getDeviceCode, getLicense, getLicense as getLicenseState } from './license.logic.js';
import { openPurchaseSheet as modOpenPurchaseSheet, pollLicenseStatus, subscribeToLicenseUpdates } from './purchase.js';
import { migrateLegacyLicenseState } from './db.js';

/* ---- wrappers untuk POS laundry (index.html) ---- */
async function canCreateTx(){
  try {
    const st = await getLicenseStatus();
    return st.status === 'active' || st.status === 'trial';
  } catch (_){ return true; }
}
async function bumpTx(){
  try { await incrementTxCount(); } catch (_){ /* non-kritikel */ }
  try { await updateTrialChip(); } catch (_){ }
}

/* ---- UI helpers laundry ---- */
async function openLicenseSheet(){
  try { hideQuotaBanner(); } catch (_){ }
  await openLicenseSheetFromUI();
}
async function openPurchaseSheet(){
  try { await modOpenPurchaseSheet(); } catch (e){
    console.warn('[LICENSE] purchase sheet gagal:', e);
  }
}
async function refreshLicenseUI(){
  try { await updateTrialChip(); } catch (_){ }
  try { await renderLicenseInfoCard(); } catch (_){ }
  try { await checkLicenseGate(); } catch (_){ }
}

/* ---- delegasi data-action dari markup modul (laundry tanpa CSP dispatcher) ---- */
function bindDataActions(){
  document.addEventListener('click', (e) => {
    const el = e.target && e.target.closest ? e.target.closest('[data-action]') : null;
    if (!el) return;
    const a = el.getAttribute('data-action');
    if (a === 'open-purchase-sheet'){ e.preventDefault(); openPurchaseSheet(); }
    else if (a === 'check-license-status'){ e.preventDefault(); (async () => {
      await syncLicenseStatus().catch(() => {});
      await refreshLicenseUI();
    })(); }
    else if (a === 'buy-gate'){ e.preventDefault(); openPurchaseSheet(); }
    else if (a === 'trigger-bukti-input'){
      e.preventDefault();
      // Dua fase (pola dispatcher kaki5): foto belum dipilih → buka file picker;
      // foto sudah dipilih → kirim bukti.
      if (window._ksr_currentBuktiFile){
        import('./purchase.js')
          .then(m => m.submitPurchase(window._ksr_purchaseUnitId, window._ksr_purchaseDeviceCode))
          .catch(() => {});
      } else {
        const f = document.getElementById('buktiInput');
        if (f) f.click();
      }
    }
  });
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el && el.getAttribute && el.getAttribute('data-action') === 'handle-bukti-upload'){
      import('./purchase.js').then(m => m.handleBuktiUpload(e)).catch(() => {});
    }
  });
  // Klik backdrop sheet lisensi/pembelian menutup sheet
  document.addEventListener('click', (e) => {
    const bd = e.target && e.target.closest ? e.target.closest('.license-sheet-backdrop') : null;
    if (bd){
      const holder = bd.closest('.license-sheet');
      if (holder) import('./modal.js').then(m => m.closeModal(holder.id)).catch(() => {});
    }
  });
}

async function boot(){
  try { await migrateLegacyLicenseState(); } catch (_){ }

  // Wiring UI (refs ala kaki5) + jendela global untuk POS/QA
  setLicenseRefs({
    updateTrialChip: async () => { try { await updateTrialChip(); } catch (_){ } },
    renderLicenseInfoCard: async () => { try { await renderLicenseInfoCard(); } catch (_){ } },
    checkLicenseGate: async () => { try { await checkLicenseGate(); } catch (_){ } },
    openLicenseSheet,
    openPurchaseSheet,
  });
  window._ksr_updateTrialChip = async () => { try { await updateTrialChip(); } catch (_){ } };
  window._ksr_checkLicenseGate = async () => { try { await checkLicenseGate(); } catch (_){ } };
  window._ksr_renderLicenseInfoCard = async () => { try { await renderLicenseInfoCard(); } catch (_){ } };
  window._ksr_enforceRevoked = async () => { try { await enforceRevoked(); } catch (_){ } };
  window._ksr_pollLicenseStatus = (unitId) => { try { pollLicenseStatus(unitId); } catch (_){ } };
  window.openLicenseSheet = openLicenseSheet;
  window.openPurchaseSheet = openPurchaseSheet;
  window.LicenseAPI = {
    getLicenseStatus, isLicensed, startTrial, incrementTxCount, canCreateTx, bumpTx,
    getUnitId, getDeviceCode, getLicense: getLicenseState, syncLicenseStatus, checkLicenseGate,
    updateTrialChip, openLicenseSheet, openPurchaseSheet, enforceRevoked,
  };

  bindDataActions();

  // Boot sequence standar ekosistem (ala kaki5 app.js)
  try { await ensureUnitId(); } catch (_){ }
  try { await reanchorUnitId(); } catch (_){ }
  try { await syncLicenseStatus(); } catch (_){ }
  try {
    const lic = await getLicense();
    if (lic && lic.status === 'active' && lic.serial){
      const unitId = await getUnitId();
      await verifyAndAssignSerial(lic.serial, unitId).catch(() => { /* self-healing opsional */ });
    }
  } catch (_){ }
  try {
    /* Push profil menunggu onboarding selesai (S&K + nomor WA) — pola kaki5:
       baris clients lahir saat onboarding/aktivasi, bukan saat gate masih terbuka. */
    const st = await getLicenseStatus();
    if (st.status !== 'none'){
      const { ensureSynced } = await import('./sync.js');
      await ensureSynced({ silent: true });
    }
  } catch (_){ }
  try { await checkLicenseGate(); } catch (_){ }
  try { await updateTrialChip(); } catch (_){ }
  try {
    const unitId = await getUnitId();
    if (unitId) subscribeToLicenseUpdates(unitId);
  } catch (_){ }
  // Cek berkala + saat kembali online / tab terlihat
  setInterval(async () => {
    try { await syncLicenseStatus(); } catch (_){ }
    try { await checkLicenseGate(); } catch (_){ }
  }, 60 * 1000);
  window.addEventListener('online', async () => {
    try { await syncLicenseStatus(); } catch (_){ }
    try { await checkLicenseGate(); } catch (_){ }
  });
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible'){
      syncLicenseStatus().catch(() => {});
      checkLicenseGate().catch(() => {});
    }
  });
  // Sinyal ke index.html: status lisensi siap (gate boleh dirender)
  window.dispatchEvent(new Event('laundry-license-ready'));
}

boot();
