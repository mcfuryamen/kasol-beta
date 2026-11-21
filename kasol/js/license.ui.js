/**
 * kasol/js/license.ui.js
 * License UI — DOM operations only
 * Didasarkan dari kaki5/js/license.ui.js dengan adaptasi untuk kasol
 */
import { getLicense, getLicenseStatus, activateSerial, markLicenseRevoked, persistCloudLicense, getDeviceIdentity } from './license.logic.js';
import { APP_VERSION } from './version.js';
import { escapeHtml } from './helpers.pure.js';
import { rateLimit } from './helpers.pure.js';

// ── Refs (injected by app.js to avoid circular imports) ────────────────────────
let _updateTrialChip = null;
let _renderLicenseInfoCard = null;
let _checkLicenseGate = null;

export function setLicenseRefs(refs) {
  _updateTrialChip = refs.updateTrialChip || null;
  _renderLicenseInfoCard = refs.renderLicenseInfoCard || null;
  _checkLicenseGate = refs.checkLicenseGate || null;
}

// ── Modal helpers ──────────────────────────────────────────────────────────────
import { openModal, closeModal } from './modal.js';

export async function openOverlay(id) { await openModal(id); }
export function closeOverlay(id) { closeModal(id); }
export function closeSheet(id) { closeModal(id); }

// ── Template helpers ──────────────────────────────────────────────────────────
function licenseSteps(activeStep) {
  const steps = [['1', 'Gratis'], ['2', 'Beli'], ['3', 'Proses'], ['4', 'Aktif']];
  return `<div class="license-steps">${steps.map(([number, label], idx) => `
    <div class="license-step ${idx + 1 < activeStep ? 'is-done' : ''} ${idx + 1 === activeStep ? 'is-current' : ''}">
      <span class="license-step-dot">${idx + 1 < activeStep ? '✓' : number}</span><span>${label}</span>
    </div>${idx < steps.length - 1 ? '<span class="license-step-line"></span>' : ''}`).join('')}</div>`;
}

function licUnitHtml(deviceCode) {
  const code = (deviceCode || '').trim();
  return code ? `<div class="kfs11 ktext3 lic-unit">ID Perangkat: ${escapeHtml(code)}</div>` : '';
}

// ── License cards ─────────────────────────────────────────────────────────────
export function licenseStatusHtml(st) {
  const habis = st.status === 'expired';
  const quota = Number(st.txQuota) || 0;
  const remaining = habis ? 0 : Math.max(0, Number(st.txRemaining) || 0);
  const used = Math.max(0, quota - remaining);
  const pct = quota > 0 ? Math.min(100, Math.max(4, Math.round((remaining / quota) * 100))) : 0;
  const adj = Number(st.txAdjust) || 0;

  return `
    <div class="card license-card-trial license-state-card">
      ${licenseSteps(1)}
      <div class="license-header">
        <div class="license-icon">🎁</div>
        <div class="license-title">Kuota Transaksi Gratis</div>
        <span class="badge ${habis ? 'red' : (remaining <= 10 ? 'orange' : 'green')}">${habis ? 'Habis bulan ini' : 'Sisa ' + remaining + ' transaksi'}</span>
      </div>
      <div class="license-description">Setiap bulan kamu dapat <b>${quota} transaksi</b> gratis tanpa batas waktu — kuota segar lagi di awal bulan. Terpakai <b>${used}</b> bulan ini${adj ? ' · termasuk bonus admin ' + (adj > 0 ? '+' : '') + adj : ''}.</div>
      <div class="license-progress"><span style="width:${pct}%;animation:none"></span></div>
    </div>
    <div class="license-actions" style="grid-template-columns:1fr">
      <button class="btn btn-primary" data-action="open-purchase-sheet">💳 Beli Lisensi</button>
    </div>
    ${licUnitHtml(st.deviceCode)}
  `;
}

function activeLicenseCardHtml(serial, expTxt, deviceCode) {
  return `
    <div class="card license-card-active license-state-card">
      ${licenseSteps(4)}
      <div class="license-icon">✅</div>
      <div class="badge green compact">✓ Lisensi Aktif</div>
      <p class="license-key"><b>${escapeHtml(serial || '-')}</b></p>
      ${licUnitHtml(deviceCode)}
      <p class="license-expiry">${expTxt}</p>
      <p class="license-desc">Semua fitur sudah terbuka. Terima kasih sudah memakai Kasir Solo.</p>
      <div class="license-active-actions"><button class="btn btn-outline" data-action="check-license-status">🔄 Refresh Status</button></div>
    </div>`;
}

function revokedLicenseCardHtml(deviceCode) {
  return `
    <div class="card license-card-revoked license-state-card">
      <div class="license-icon">🚫</div>
      <div class="badge red compact">✖ Lisensi Dinonaktifkan</div>
      <div class="license-title kmt8">Lisensi Dicabut</div>
      <p class="license-desc">Lisensi untuk perangkat ini telah <b>dinonaktifkan</b> oleh admin. Aplikasi tidak dapat digunakan sampai lisensi dipulihkan.</p>
      ${licUnitHtml(deviceCode)}
      <div class="license-actions" style="grid-template-columns:1fr">
        <button class="btn btn-primary" data-action="open-purchase-sheet">💳 Beli Lisensi</button>
      </div>
    </div>`;
}

function pendingVerificationHtml() {
  return `
    <div class="card license-card-pending license-state-card">
      ${licenseSteps(3)}
      <div class="license-header"><div class="license-icon">⏳</div><div class="license-title">Aktivasi sedang diproses</div><span class="badge amber">Menunggu admin</span></div>
      <div class="license-description">Bukti pembayaran sudah diterima. Lisensi akan aktif otomatis setelah verifikasi selesai.</div>
      <div class="license-progress"><span></span></div>
      <div class="license-actions"><button class="btn btn-primary" data-action="check-license-status">🔄 Cek Status Sekarang</button></div>
      <div class="license-hint">Tidak perlu kirim ulang bukti pembayaran.</div>
    </div>`;
}

// ── Render status area (cloud-first) ─────────────────────────────────────────
export async function renderLicenseStatusArea(targetId) {
  const el = document.getElementById(targetId);
  if (!el) return false;

  // Dynamic import to avoid circular
  let cloud = null;
  try {
    const { pullCloudProfile } = await import('./license.sync.js');
    cloud = await pullCloudProfile();
  } catch (_) { /* offline */ }

  if (cloud && cloud.license_status === 'aktif') {
    const local = await getLicense();
    if (local?.status !== 'active') {
      const persisted = await persistCloudLicense(cloud);
      if (!persisted?.valid) {
        console.warn('[LICENSE] Persist cloud license failed:', persisted?.message);
      }
    }
    const { deviceCode } = await getDeviceIdentity();
    el.innerHTML = activeLicenseCardHtml(cloud.license_serial, cloud.license_expires_at
      ? new Date(cloud.license_expires_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
      : 'Seumur Hidup', deviceCode);
    return true;
  }

  if (cloud && cloud.license_status === 'menunggu_verifikasi') {
    el.innerHTML = pendingVerificationHtml();
    return false;
  }

  // Local state
  const { lic, deviceCode } = await getLicenseStatus();

  if (lic.status === 'active') {
    el.innerHTML = activeLicenseCardHtml(lic.serial, lic.expiryLabel || 'Seumur Hidup', deviceCode);
    return true;
  }
  if (lic.status === 'revoked') {
    el.innerHTML = revokedLicenseCardHtml(deviceCode);
    return false;
  }

  // Trial
  const txQuota = Number(lic.txQuota) || 100;
  const txUsed = Number(lic.txUsed) || 0;
  const txRemaining = Math.max(0, txQuota - txUsed);
  el.innerHTML = licenseStatusHtml({
    status: txRemaining <= 0 ? 'expired' : 'trial',
    txQuota,
    txUsed,
    txRemaining,
    txAdjust: Number(lic.txAdjust) || 0,
    deviceCode
  });
  return false;
}

// ── License info card (Pengaturan) ─────────────────────────────────────────────
export async function renderLicenseInfoCard(targetId) {
  const el = document.getElementById(targetId);
  if (!el) return;
  await renderLicenseStatusArea(targetId);
}

// ── Trial chip / banner update ────────────────────────────────────────────────
export async function updateTrialChip(targetId) {
  const el = document.getElementById(targetId);
  if (!el) return;
  const { lic } = await getLicenseStatus();
  if (lic.status === 'active') {
    el.innerHTML = `<span class="badge green">✅ Lisensi Aktif</span>`;
    return;
  }
  if (lic.status === 'revoked') {
    el.innerHTML = `<span class="badge red">🚫 Dinonaktifkan</span>`;
    return;
  }
  const remaining = Math.max(0, (Number(lic.txQuota) || 100) - (Number(lic.txUsed) || 0));
  el.innerHTML = `<span class="badge ${remaining <= 0 ? 'red' : remaining <= 10 ? 'orange' : 'green'}">🎁 Sisa ${remaining} transaksi</span>`;
}

// ── Serial activation ─────────────────────────────────────────────────────────
export async function handleSerialActivation(serial) {
  if (!serial || !serial.trim()) {
    return { success: false, message: 'Serial tidak boleh kosong.' };
  }
  // Rate limit: max 5 attempts per minute
  if (!rateLimit('serial-activate', 5, 60000)) {
    return { success: false, message: 'Terlalu banyak percobaan. Tunggu sebentar.' };
  }
  const result = await activateSerial(serial);
  if (result.valid) {
    if (_updateTrialChip) _updateTrialChip();
    if (_renderLicenseInfoCard) _renderLicenseInfoCard();
  }
  return result;
}

// ── Revoked lock overlay ──────────────────────────────────────────────────────
export async function enforceRevoked() {
  await markLicenseRevoked('admin');
  const lock = document.getElementById('lockOverlay');
  if (lock) {
    const page = document.getElementById('lockRevokedPage');
    if (page) {
      const { deviceCode } = await getDeviceIdentity();
      page.innerHTML = `
        <img src="assets/icon.png" style="width:80px;height:80px;margin-bottom:8px" alt="Logo">
        <div class="kfs22 kfw800 kmb8">Kasir Solo</div>
        <div style="font-size:14px;color:var(--text2);margin-bottom:16px">Kasir Solo Root</div>
        <div style="font-size:17px;font-weight:800;color:var(--red)">Lisensi Dinonaktifkan</div>
        <p style="font-size:13px;color:var(--text2);margin:8px 0 14px;line-height:1.5">Lisensi untuk perangkat ini telah dicabut oleh admin.<br>Beli lisensi baru — aktivasi otomatis oleh admin setelah pembayaran diverifikasi.</p>
        <div class="license-actions" style="grid-template-columns:1fr">
          <button class="btn btn-primary" data-action="buy-gate">💳 Beli Lisensi</button>
        </div>
        <div class="kfs12 ktext3 kmt14" style="line-height:1.7">Versi ${APP_VERSION} · ID Perangkat: <b style="color:var(--text2);user-select:all">${deviceCode || '—'}</b><br>Ada masalah? Hubungi <a href="https://wa.me/628816566935" style="color:var(--green);text-decoration:none">WhatsApp</a> — sertakan ID perangkat</div>
      `;
      page.style.display = 'block';
    }
    lock.classList.add('revoked-page');
    lock.classList.remove('hidden');
  }
  if (_updateTrialChip) _updateTrialChip();
  if (_renderLicenseInfoCard) _renderLicenseInfoCard();
}
