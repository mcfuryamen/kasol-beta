// ==================== LICENSE UI (ESM) ====================
// DOM operations only. NO crypto, NO direct DB access.
import { getLicense, daysLeft, isLicensed, MAX_EXTENSIONS, activateSerial } from './license.logic.js';
import { escapeHtml } from './helpers.js';

// ----- UI wiring (refs injected by app.js to avoid circular imports) -----
let _updateTrialChip = null;
let _renderLicenseInfoCard = null;
let _checkLicenseGate = null;
let _openExtendFlow = null;
let _grantExtension = null;
let _openLicenseSheet = null;
let _openPurchaseSheet = null;

export function setLicenseRefs(refs) {
  _updateTrialChip = refs.updateTrialChip;
  _renderLicenseInfoCard = refs.renderLicenseInfoCard;
  _checkLicenseGate = refs.checkLicenseGate;
  _openExtendFlow = refs.openExtendFlow;
  _grantExtension = refs.grantExtension;
  _openLicenseSheet = refs.openLicenseSheet;
  _openPurchaseSheet = refs.openPurchaseSheet;
}

// ── Overlay helpers ─────────────────────────────────────────────────
export function openOverlay(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('show');
}
export function closeOverlay(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('show');
}
export function closeSheet(id) { closeOverlay(id); }

// ── License status HTML template (cloud-first) ────────────────────────
// Flow utama: trial → beli → verifikasi → aktif. Tiap state punya satu CTA utama.
function licenseSteps(activeStep) {
  const steps = [['1', 'Trial'], ['2', 'Beli'], ['3', 'Proses'], ['4', 'Aktif']];
  return `<div class="license-steps" aria-label="Tahapan lisensi">${steps.map(([number, label], index) => `
    <div class="license-step ${index + 1 < activeStep ? 'is-done' : ''} ${index + 1 === activeStep ? 'is-current' : ''}">
      <span class="license-step-dot">${index + 1 < activeStep ? '✓' : number}</span><span>${label}</span>
    </div>${index < steps.length - 1 ? '<span class="license-step-line"></span>' : ''}`).join('')}</div>`;
}

export function licenseStatusHtml(left, extUsed, inputId) {
  return `
    <div class="card license-card-trial license-state-card">
      ${licenseSteps(1)}
      <div class="license-header">
        <div class="license-icon">⏰</div>
        <div class="license-title">Masa Coba Gratis</div>
        <span class="badge ${left > 2 ? 'orange' : 'red'}">${left > 0 ? left + ' hari tersisa' : 'Sudah habis'}</span>
      </div>
      <div class="license-description">Nikmati trial sekarang. Saat siap, beli lisensi dan admin akan mengaktifkannya otomatis setelah pembayaran diverifikasi.</div>
      <div class="license-extend-section">
        ${extUsed < MAX_EXTENSIONS ? `<button class="btn-extend" onclick="window._ksr_openExtendFlow()">🎁 Tambah 1 Hari Gratis</button>` : `<div class="hint">Jatah perpanjangan gratis sudah habis (maks ${MAX_EXTENSIONS}x).</div>`}
        <div class="license-usage">Perpanjangan dipakai <b>${extUsed}/${MAX_EXTENSIONS}</b>x</div>
      </div>
    </div>
    <div class="license-actions license-actions-primary">
      <button class="btn-buy-wa" onclick="window._ksr_openPurchaseSheet()">💳 Beli Lisensi</button>
      <button class="btn btn-outline" onclick="window._ksr_checkLicenseStatus()">🔄 Cek Status</button>
    </div>
    <div class="license-secondary-actions"><button class="btn btn-ghost" onclick="window._ksr_contactViaWA()">💬 Tanya Admin</button></div>
    ${manualKeyHtml(inputId)}
  `;
}

function manualKeyHtml(inputId) {
  return `<div class="manual-key-toggle"><a href="javascript:void(0)" onclick="window._ksr_toggleManualKey('${inputId}')">Sudah punya kode? Aktivasi manual</a>
    <div id="manualKeyWrap-${inputId}" class="manual-key-wrap">
      <div class="field"><input type="text" id="${inputId}" placeholder="KK5-XXXX-XXXX-XX-XXXXXX" class="form-input uppercase"></div>
      <button class="btn btn-primary" onclick="window._ksr_activateLicense('${inputId}')">🔑 Aktifkan Kode</button>
    </div></div>`;
}

// ── Cloud status cards ────────────────────────────────────────────────
function activeLicenseCardHtml(serial, expTxt) {
  return `
    <div class="card license-card-active license-state-card">
      ${licenseSteps(4)}
      <div class="license-icon">✅</div>
      <div class="badge green compact">✓ Lisensi Aktif</div>
      <p class="license-key"><b>${escapeHtml(serial || '-')}</b></p>
      <p class="license-expiry">${expTxt}</p>
      <p class="license-desc">Semua fitur sudah terbuka. Terima kasih sudah memakai Kaki5.</p>
      <div class="license-active-actions"><button class="btn btn-outline" onclick="window._ksr_checkLicenseStatus()">🔄 Refresh Status</button></div>
    </div>`;
}

function pendingVerificationHtml(inputId) {
  return `
    <div class="card license-card-pending license-state-card">
      ${licenseSteps(3)}
      <div class="license-header"><div class="license-icon">⏳</div><div class="license-title">Aktivasi sedang diproses</div><span class="badge amber">Menunggu admin</span></div>
      <div class="license-description">Bukti pembayaran sudah diterima. Lisensi akan aktif otomatis setelah verifikasi selesai.</div>
      <div class="license-progress"><span></span></div>
      <div class="license-actions license-actions-primary"><button class="btn btn-primary" onclick="window._ksr_checkLicenseStatus()">🔄 Cek Status Sekarang</button></div>
      <div class="license-hint">Tidak perlu kirim ulang bukti pembayaran.</div>
    </div>
    ${manualKeyHtml(inputId)}
  `;
}

/**
 * Render area status lisensi berbasis cloud (tabel `clients`).
 * - aktif              → card lisensi aktif + unlock otomatis
 * - menunggu_verifikasi → card "Menunggu Verifikasi Admin"
 * - belum / tidak ada   → template lokal (trial / beli)
 * @returns {Promise<boolean>} true bila lisensi aktif (sudah unlock)
 */
export async function renderLicenseStatusArea(targetId, inputId) {
  const el = document.getElementById(targetId);
  if (!el) return false;
  const { fetchLicenseStatusFromCloud } = await import('./license.sync.js');
  const cloud = await fetchLicenseStatusFromCloud();

  if (cloud && cloud.license_status === 'aktif') {
      // Pastikan lisensi (serial dari cloud) tersimpan di local store supaya
      // chip banner & status konsisten setelah reload / saat offline.
      const local = await getLicense();
      if (cloud.license_serial && local?.status !== 'active') {
        const persisted = await activateSerial(cloud.license_serial);
        if (persisted?.valid) void persisted;
      }
      const lic = await getLicense();
    const expTxt = lic?.expiryLabel ? 'Masa berlaku: ' + escapeHtml(lic.expiryLabel) : 'Berlaku seumur hidup';
    el.innerHTML = activeLicenseCardHtml(cloud.license_serial || lic?.serial, expTxt);
    document.getElementById('lockOverlay')?.classList.remove('show');
    const gate = document.getElementById('licenseGate');
    if (gate) gate.style.display = 'none';
    if (_updateTrialChip) _updateTrialChip();
    return true;
  }

  if (cloud && cloud.license_status === 'menunggu_verifikasi') {
    el.innerHTML = pendingVerificationHtml(inputId);
    return false;
  }

  const lic = await getLicense();
  const left = daysLeft(lic);
  const extUsed = lic.extensionsUsed || 0;
  el.innerHTML = licenseStatusHtml(left, extUsed, inputId);
  return false;
}

/**
 * Tombol "Cek Status" — refresh status cloud; kalau sudah aktif, unlock.
 */
export async function checkCloudStatusAndUnlock() {
  const { showToast } = await import('./helpers.js');
  const { fetchLicenseStatusFromCloud } = await import('./license.sync.js');
  const cloud = await fetchLicenseStatusFromCloud();
  if (cloud && cloud.license_status === 'aktif') {
    await renderLicenseStatusArea('licenseSheetBody', 'licenseKeyInputSheet');
    document.getElementById('lockOverlay')?.classList.remove('show');
    const gate = document.getElementById('licenseGate');
    if (gate) gate.style.display = 'none';
    if (_checkLicenseGate) _checkLicenseGate();
    showToast('🎉 Lisensi berhasil diaktifkan!', 3000, 'success');
    return true;
  }
  showToast('Lisensi belum aktif. Pembayaran menunggu verifikasi admin.', 3000, 'info');
  return false;
}

/**
 * Toggle input serial manual (fallback tersembunyi).
 */
export function toggleManualKey(inputId) {
  const wrap = document.getElementById('manualKeyWrap-' + inputId);
  if (wrap) wrap.style.display = wrap.style.display === 'none' ? 'block' : 'none';
}

// ── Trial / License UI ─────────────────────────────────────────────────
export async function checkLicenseGate() {
  // Jika gate full-screen (onboarding / trial-habis) sedang tampil, jangan pop lock —
  // gate sendiri yang menangani state. (Smart gate → hindari double overlay.)
  const gateEl = document.getElementById('licenseGate');
  if (gateEl && gateEl.style.display !== 'none') return;

  const lic = await getLicense();
  const left = daysLeft(lic);
  if (await isLicensed()) {
    if (_updateTrialChip) _updateTrialChip();
    if (_renderLicenseInfoCard) _renderLicenseInfoCard();
    const lock = document.getElementById('lockOverlay');
    if (lock) lock.classList.remove('show');
    return;
  }
  // not licensed (trial running or expired) - cloud-first always sync
  const lockArea = document.getElementById('lockLicenseStatusArea');
  if (lockArea) {
    // Cloud aktif -> persist local + unlock otomatis (berlaku juga saat trial berjalan).
    const active = await renderLicenseStatusArea('lockLicenseStatusArea', 'lockLicenseInput');
    if (active) {
      if (_updateTrialChip) _updateTrialChip();
      if (_renderLicenseInfoCard) _renderLicenseInfoCard();
      const lock = document.getElementById('lockOverlay');
      if (lock) lock.classList.remove('show');
      return;
    }
  }
  if (_updateTrialChip) _updateTrialChip();
  if (_renderLicenseInfoCard) _renderLicenseInfoCard();
  if (left <= 0) {
      const lock = document.getElementById('lockOverlay');
      if (lock) lock.classList.add('show');
    }
  }

export async function updateTrialChip() {
  const chip = document.getElementById('trialChip');
  if (!chip) return;
  if (await isLicensed()) {
    chip.innerHTML = '<div class="trial-label-xs">LISENSI</div><div class="trial-value-sm">✓ Aktif</div>';
    chip.classList.remove('warn');
    return;
  }
  const lic = await getLicense();
  const left = daysLeft(lic);
  chip.innerHTML = '<div class="trial-label-xs">TRIAL</div><div class="trial-value-sm">' + (left > 0 ? left + ' hari' : 'Habis') + '</div>';
  chip.classList.toggle('warn', left <= 2);
}

export async function openLicenseSheet() {
  await renderLicenseStatusArea('licenseSheetBody', 'licenseKeyInputSheet');
  openOverlay('sheetLicense');
}

export async function renderLicenseInfoCard() {
  const card = document.getElementById('licenseInfoCard');
  if (!card) return;
  if (await isLicensed()) {
    const lic = await getLicense();
    const expTxt = lic.expiryLabel ? 'Masa berlaku: ' + escapeHtml(lic.expiryLabel) : 'Berlaku seumur hidup';
    card.innerHTML = `
      <div class="card license-card-active">
        <div class="license-icon">✅</div>
        <div class="badge green compact">✓ Lisensi Aktif</div>
        <p class="license-key"><b>${escapeHtml(lic.serial || '-')}</b></p>
        <p class="license-expiry">${expTxt}</p>
        <p class="license-desc">Lisensi terikat perangkat ini dan membuka semua fitur tanpa batasan.</p>
      </div>`;
    return;
  }
  await renderLicenseStatusArea('licenseInfoCard', 'licenseKeyInputSettings');
  }

// ── Share / Extension UI ──────────────────────────────────────────────
export async function contactViaWA() {
  // Import from logic to avoid circular dependency
  const { getDeviceIdentity } = await import('./license.logic.js');
  const { deviceCode } = await getDeviceIdentity();
  const text = `Halo, saya ingin aktivasi lisensi Kasir Solo - Kaki Lima.\nKode Perangkat: ${deviceCode}\nAplikasi: Kasir Solo Kaki Lima`;
  window.open('https://wa.me/628816566935?text=' + encodeURIComponent(text), '_blank');
}

export async function openExtendFlow() {
  const { getLicense } = await import('./license.logic.js');
  const { grantExtensionLogic } = await import('./license.logic.js');
  const { showToast } = await import('./helpers.js');
  const { MAX_EXTENSIONS } = await import('./license.logic.js');

  const lic = await getLicense();
  const extUsed = lic.extensionsUsed || 0;
  if (extUsed >= MAX_EXTENSIONS) { showToast('Jatah perpanjangan sudah habis', 'error'); return; }
  const { getAppLink } = await import('./app-link.js');
  const appLink = await getAppLink();
  const shareText = `Halo! Saya pakai *Kasir Solo - Kaki Lima* buat catat jualan saya, gampang & ringan banget. *PT Mesin Kasir Solo* juga menyediakan beragam aplikasi khusus sesuai kebutuhan bisnismu. Info lengkap: WA 0881-6566-935 atau email owner.kasirsolo@gmail.com.\n\nCoba langsung di: ${appLink}`;
  if ('contacts' in navigator && 'ContactsManager' in window) {
    try {
      const contacts = await navigator.contacts.select(['name', 'tel'], { multiple: false });
      if (contacts && contacts.length >= 1) {
        await tryShare(shareText);
        if (_grantExtension) _grantExtension();
        return;
      }
    } catch (err) {
      // user cancelled — fall through
    }
  }
  await tryShare(shareText);
  const ok = confirm('Apakah kamu berhasil membagikan info aplikasi ini ke kontak rekan atau media sosial? \n\nJika ya, kamu akan dapatkan 1 hari masa coba gratis tambahan.');
  if (ok) { if (_grantExtension) _grantExtension(); }
  else { showToast('Bagikan dulu ke kontak untuk klaim tambahan 1 hari', 'error'); }
}

export async function tryShare(text) {
  if (navigator.share) {
    try { await navigator.share({ title: 'Kasir Solo - Kaki Lima', text }); } catch (e) {}
  } else {
    window.open('https://wa.me/?text=' + encodeURIComponent(text), '_blank');
  }
}

export async function grantExtension() {
  const { grantExtensionLogic, daysLeft, isLicensed } = await import('./license.logic.js');
  const { showToast } = await import('./helpers.js');
  const { closeOverlay, openLicenseSheet } = await import('./license.ui.js');

  const res = await grantExtensionLogic();
  if (!res.granted) {
    closeOverlay('sheetLicense');
    if (_checkLicenseGate) _checkLicenseGate();
    showToast('Jatah perpanjangan gratis sudah habis', 'error');
    return;
  }
  const { lic, extUsed } = res;
  if (_updateTrialChip) _updateTrialChip();
  if (_renderLicenseInfoCard) _renderLicenseInfoCard();
  closeOverlay('sheetLicense');
  document.getElementById('lockOverlay')?.classList.remove('show');
  if (_checkLicenseGate) _checkLicenseGate();
  showToast('Masa coba ditambah 1 hari! 🎉 (' + extUsed + '/' + MAX_EXTENSIONS + ')');
}

export async function activateLicense(inputId) {
  const { activateSerial } = await import('./license.logic.js');
  const { showToast } = await import('./helpers.js');
  const { closeOverlay } = await import('./license.ui.js');

  const key = (document.getElementById(inputId).value || '').trim().toUpperCase();
  if (!key) { showToast('Masukkan kode lisensi', 'error'); return; }
  showToast('Memeriksa lisensi...');
  const res = await activateSerial(key);
  if (res.valid) {
    if (_updateTrialChip) _updateTrialChip();
    if (_renderLicenseInfoCard) _renderLicenseInfoCard();
    closeOverlay('sheetLicense');
    const lock = document.getElementById('lockOverlay');
    if (lock) lock.classList.remove('show');
    const gate = document.getElementById('licenseGate');
    if (gate) gate.style.display = 'none';
    showToast(res.message);
  } else {
    showToast(res.message || 'Kode lisensi tidak valid', 'error');
  }
}
