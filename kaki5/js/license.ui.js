// ==================== LICENSE UI (ESM) ====================
// DOM operations only. NO crypto, NO direct DB access.
import { getLicense, isLicensed, getLicenseStatus, activateSerial, markLicenseRevoked, persistCloudLicense, getDeviceIdentity } from './license.logic.js';
import { APP_VERSION } from './version.js';
import { escapeHtml } from './helpers.js';
import { rateLimiters } from './helpers.pure.js';
import { showToast } from './helpers.js';

// ----- UI wiring (refs injected by app.js to avoid circular imports) -----
let _updateTrialChip = null;
let _renderLicenseInfoCard = null;
let _checkLicenseGate = null;
let _openLicenseSheet = null;
let _openPurchaseSheet = null;

export function setLicenseRefs(refs) {
  _updateTrialChip = refs.updateTrialChip;
  _renderLicenseInfoCard = refs.renderLicenseInfoCard;
  _checkLicenseGate = refs.checkLicenseGate;
  _openLicenseSheet = refs.openLicenseSheet;
  _openPurchaseSheet = refs.openPurchaseSheet;
}

// ── Overlay helpers ─────────────────────────────────────────────────
// Use centralized modal management with focus trap (a11y)
import { openModal, closeModal, registerModalSelector } from './modal.js';

// Register custom selector for lockOverlay (uses .card.license-lock-card)
registerModalSelector('lockOverlay', '.card.license-lock-card');

export async function openOverlay(id) {
  await openModal(id);
}
export function closeOverlay(id) {
  closeModal(id);
}
export function closeSheet(id) { closeOverlay(id); }

// ── License status HTML template (cloud-first) ────────────────────────
// Flow utama: trial → beli → verifikasi → aktif. Tiap state punya satu CTA utama.
function licenseSteps(activeStep) {
  const steps = [['1', 'Gratis'], ['2', 'Beli'], ['3', 'Proses'], ['4', 'Aktif']];
  return `<div class="license-steps" aria-label="Tahapan lisensi">${steps.map(([number, label], index) => `
    <div class="license-step ${index + 1 < activeStep ? 'is-done' : ''} ${index + 1 === activeStep ? 'is-current' : ''}">
      <span class="license-step-dot">${index + 1 < activeStep ? '✓' : number}</span><span>${label}</span>
    </div>${index < steps.length - 1 ? '<span class="license-step-line"></span>' : ''}`).join('')}</div>`;
}

// Kartu status tier gratis = KUOTA TRANSAKSI per bulan kalender (2026-08-29).
// st = hasil getLicenseStatus() (txRemaining/txQuota/txUsed/txAdjust).
export function licenseStatusHtml(st, inputId) {
  const habis = st.status === 'expired';
  const quota = Number(st.txQuota) || 0;
  const remaining = habis ? 0 : Math.max(0, Number(st.txRemaining) || 0);
  const used = Math.max(0, quota - remaining);
  const pct = quota > 0 ? Math.min(100, Math.max(4, Math.round((remaining / quota) * 100))) : 0;
  const adj = Number(st.txAdjust) || 0;
  // Warna bar kuota dimiliki style.css (.license-progress): v160 (komentar
  // browser #1 & #2) = ISI hijau di atas track oranye. Jangan pasang override
  // inline di sini lagi — v151 pernah begitu dan warnanya jadi tidak konsisten.
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
    <div class="license-actions license-actions-row">
      <button class="btn btn-primary" data-action="open-purchase-sheet">💳 Beli Lisensi</button>
      <button class="btn btn-wa" data-action="contact-via-wa">💬 WhatsApp</button>
    </div>
  `;
}

function manualKeyHtml(inputId) {
  return `<div class="manual-key-toggle"><a href="javascript:void(0)" data-action="toggle-manual-key" data-input-id="${inputId}">Sudah punya kode? Aktivasi manual</a>
    <div id="manualKeyWrap-${inputId}" class="manual-key-wrap">
      <div class="field"><input type="text" id="${inputId}" placeholder="KK5-XXXX-XXXX-XX-XXXXXX" class="form-input uppercase"></div>
      <button class="btn btn-primary" data-action="activate-license" data-input-id="${inputId}">🔑 Aktifkan Kode</button>
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
      <div class="license-active-actions"><button class="btn btn-outline" data-action="check-license-status">🔄 Refresh Status</button></div>
    </div>`;
}

function revokedLicenseActionsHtml() {
  return `
    <div class="badge red compact">✖ Lisensi Dinonaktifkan</div>
    <div class="license-actions license-actions-row">
      <button class="btn btn-primary" data-action="open-purchase-sheet">💳 Beli Lisensi</button>
      <button class="btn btn-secondary" data-action="contact-via-wa">💬 Hubungi Admin</button>
    </div>`;
}

function revokedLicenseCardHtml() {
  return `
    <div class="card license-card-revoked license-state-card">
      <div class="license-icon">🚫</div>
      <div class="badge red compact">✖ Lisensi Dinonaktifkan</div>
      <div class="license-title kmt8">Lisensi Dicabut</div>
      <p class="license-desc">Lisensi untuk perangkat ini telah <b>dinonaktifkan</b> oleh admin. Aplikasi tidak dapat digunakan sampai lisensi dipulihkan.</p>
      <div class="license-actions license-actions-row">
        <button class="btn btn-primary" data-action="open-purchase-sheet">💳 Beli Lisensi</button>
        <button class="btn btn-secondary" data-action="contact-via-wa">💬 Hubungi Admin</button>
      </div>
    </div>`;
}

// Mode tampilan lockOverlay: 'revoked' = halaman penuh putih bergaya gate
// (permintaan pemilik 2026-08-17, konsisten dengan #gateLicenseBlock);
// 'default' = kartu kecil untuk kondisi lain (trial habis).
function setLockMode(mode) {
  const lock = document.getElementById('lockOverlay');
  const card = lock ? lock.querySelector('.license-lock-card') : null;
  const page = document.getElementById('lockRevokedPage');
  const revoked = mode === 'revoked';
  if (lock) lock.classList.toggle('revoked-page', revoked);
  if (card) card.style.display = revoked ? 'none' : '';
  if (page) {
    if (revoked) {
      // Hapus khide (display:none dari CSS) dan tampilkan halaman revoked
      page.classList.remove('khide');
      page.style.display = 'block';
    } else {
      page.style.display = 'none';
      page.classList.add('khide');
    }
  }
}

// Halaman "Lisensi Dicabut" — struktur meniru gate lisensi (logo, judul,
// tombol beli/tanya, footer WA) supaya pengalaman konsisten.
function revokedPageHtml(deviceCode) {
  return `
    <img src="assets/icon.png" style="width:80px;height:80px;margin-bottom:8px" alt="Logo">
    <div class="kfs22 kfw800 kmb8">Kasir Solo</div>
    <div style="font-size:14px;color:var(--text2);margin-bottom:16px">Kaki Lima Edition</div>
    <div style="font-size:17px;font-weight:800;color:var(--red)">Lisensi Dinonaktifkan</div>
    <p style="font-size:13px;color:var(--text2);margin:8px 0 14px;line-height:1.5">Lisensi untuk perangkat ini telah dicabut oleh admin.<br>Beli lisensi baru — aktivasi otomatis oleh admin setelah pembayaran diverifikasi.</p>
    <div class="license-actions license-actions-row">
      <button class="btn btn-primary" data-action="buy-gate">💳 Beli Lisensi</button>
      <button class="btn btn-wa" data-action="contact-via-wa">💬 WhatsApp</button>
    </div>
    <div class="kfs12 ktext3 kmt14" style="line-height:1.7">Versi ${APP_VERSION} · ID Perangkat: <b style="color:var(--text2);user-select:all">${deviceCode || '—'}</b><br>Ada masalah? Hubungi <a href="https://wa.me/628816566935" style="color:var(--green);text-decoration:none">WhatsApp</a> — sertakan ID perangkat</div>
  `;
}

async function renderRevokedLockOverlay() {
  const lock = document.getElementById('lockOverlay');
  setLockMode('revoked');
  if (lock) openModal('lockOverlay');
  const page = document.getElementById('lockRevokedPage');
  // Info versi + ID perangkat (permintaan pemilik 2026-08-29) — sama dengan gate.
  let deviceCode = '';
  try { deviceCode = (await getDeviceIdentity()).deviceCode; } catch (_) { /* halaman tetap tampil tanpa ID */ }
  if (page) page.innerHTML = revokedPageHtml(deviceCode);
  // lockLicenseStatusArea tidak dipakai di mode ini (halaman punya aksinya sendiri)
  const area = document.getElementById('lockLicenseStatusArea');
  if (area) area.innerHTML = '';
}

/** Enforce revoke: tandai local license revoked + tampilkan lock/kartu revoked. */
export async function enforceRevoked() {
  await markLicenseRevoked('admin');
  await renderRevokedLockOverlay();
  if (_updateTrialChip) _updateTrialChip();
  if (_renderLicenseInfoCard) _renderLicenseInfoCard();
}

function pendingVerificationHtml(inputId) {
  return `
    <div class="card license-card-pending license-state-card">
      ${licenseSteps(3)}
      <div class="license-header"><div class="license-icon">⏳</div><div class="license-title">Aktivasi sedang diproses</div><span class="badge amber">Menunggu admin</span></div>
      <div class="license-description">Bukti pembayaran sudah diterima. Lisensi akan aktif otomatis setelah verifikasi selesai.</div>
      <div class="license-progress"><span></span></div>
      <div class="license-actions license-actions-primary"><button class="btn btn-primary" data-action="check-license-status">🔄 Cek Status Sekarang</button></div>
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
      if (local?.status !== 'active') {
        // Persist berbasis cloud (sumber kebenaran server). Dulu activateSerial()
        // — gagal diam-diam bila serial cloud tidak lolos validasi HMAC/device
        // lokal, membuat chip & gate selamanya 'trial' sementara kartu status
        // (yang membaca cloud) menampilkan aktif.
        const persisted = await persistCloudLicense(cloud);
        if (!persisted?.valid) console.warn('[LICENSE] Persist lisensi cloud gagal:', persisted?.message || persisted);
      }
      const lic = await getLicense();
    const expTxt = lic?.expiryLabel ? 'Masa berlaku: ' + escapeHtml(lic.expiryLabel) : 'Berlaku seumur hidup';
    el.innerHTML = activeLicenseCardHtml(cloud.license_serial || lic?.serial, expTxt);
    closeModal('lockOverlay');
    hideQuotaBanner();
    if (_updateTrialChip) _updateTrialChip();
    return true;
  }

  // Lisensi dicabut / nonaktif oleh admin -> kunci app (tidak jatuh ke trial).
  if (cloud && (cloud.license_status === 'batal' || cloud.license_status === 'nonaktif')) {
    if (targetId === 'lockLicenseStatusArea') renderRevokedLockOverlay();
    else el.innerHTML = revokedLicenseCardHtml();
    await markLicenseRevoked('admin');
    if (_updateTrialChip) _updateTrialChip();
    return false;
  }

  if (cloud && cloud.license_status === 'menunggu_verifikasi') {
    el.innerHTML = pendingVerificationHtml(inputId);
    return false;
  }

  const st = await getLicenseStatus();
  el.innerHTML = licenseStatusHtml(st, inputId);
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
    closeModal('lockOverlay');
    hideQuotaBanner();
    if (_checkLicenseGate) _checkLicenseGate();
    showToast('🎉 Lisensi berhasil diaktifkan!', 3000, 'success');
    return true;
  }
    if (cloud && (cloud.license_status === 'batal' || cloud.license_status === 'nonaktif')) {
      await enforceRevoked();
      showToast('Lisensi telah dinonaktifkan oleh admin.', 3000, 'error');
      return false;
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
// ── Banner kuota (2026-08-29) — pengganti full-screen gate ──────────────
// Kuota habis TIDAK mengunci aplikasi: banner bisa-ditutup + blok transaksi
// di pos.js. Revoke admin tetap full-lock (lockOverlay). Banner menampilkan
// ID Perangkat agar mudah disebut saat hubungi admin.
function showQuotaBanner(st) {
  const b = document.getElementById('quotaBanner');
  if (!b) return;
  const txt = document.getElementById('quotaBannerText');
  if (txt) {
    const paid = st.protocol === 'licensed-expired';
    txt.innerHTML = (paid
      ? '🔑 Lisensi berbayar Anda sudah kedaluwarsa — eksplorasi tetap bebas, transaksi terkunci.'
      : '🚫 Kuota transaksi bulan ini habis — eksplorasi tetap bebas, transaksi terkunci.')
      + ' <b>ID Perangkat: ' + (st.deviceCode || '—') + '</b>';
  }
  b.classList.remove('khide');
}
export function hideQuotaBanner() {
  const b = document.getElementById('quotaBanner');
  if (b) b.classList.add('khide');
}

export async function checkLicenseGate() {
  // Cloud-first: kalau cloud=aktif tapi lokal=revoked (admin aktivasi ulang
  // setelah pencabutan), sync cloud → lokal dulu SEBELUM cek status lokal.
  // Tanpa ini, check berikutnya akan render overlay revoked terus walau
  // cloud sebenarnya sudah aktif. (Bug aktivasi-ulang setelah cabut 2026-08-26.)
  if (document.getElementById('lockLicenseStatusArea')) {
    const active = await renderLicenseStatusArea('lockLicenseStatusArea', 'lockLicenseInput');
    if (active) {
      if (_updateTrialChip) _updateTrialChip();
      if (_renderLicenseInfoCard) _renderLicenseInfoCard();
      const lock = document.getElementById('lockOverlay');
      if (lock) closeModal('lockOverlay');
      hideQuotaBanner();
      return;
    }
  }

  const lic = await getLicense();
  // Sinkronkan mode lockOverlay: revoked = halaman penuh putih, lainnya kartu
  // default (supaya bekas mode revoked kembali normal setelah aktivasi/pemulihan).
  setLockMode(lic.status === 'revoked' ? 'revoked' : 'default');
  // Revoke lokal (offline-first): tetap terkunci walau tidak ada koneksi cloud.
  if (lic.status === 'revoked') {
    renderRevokedLockOverlay();
    if (_updateTrialChip) _updateTrialChip();
    return;
  }
  if (await isLicensed()) {
    if (_updateTrialChip) _updateTrialChip();
    if (_renderLicenseInfoCard) _renderLicenseInfoCard();
    closeModal('lockOverlay');
    hideQuotaBanner();
    return;
  }
  if (_updateTrialChip) _updateTrialChip();
  if (_renderLicenseInfoCard) _renderLicenseInfoCard();
  // Kuota habis / lisensi kedaluwarsa → banner (bukan lock); transaksi
  // diblokir di pos.js, sisanya aplikasi tetap bisa dieksplor.
  const st = await getLicenseStatus();
  if (st.status === 'expired') showQuotaBanner(st);
  else hideQuotaBanner();
}

export async function updateTrialChip() {
  const chip = document.getElementById('trialChip');
  if (!chip) return;
  // Satu sumber kebenaran: chip = cermin persis getLicenseStatus() (sama
  // dengan gate boot & cek 60 detik). Dulu chip memakai daysLeft() berbasis
  // Date.now() mentah + tidak menangani revoked → tampilan bisa bertentangan
  // dengan status lisensi sebenarnya.
  const st = await getLicenseStatus();
  if (st.status === 'active') {
    chip.innerHTML = '<div class="trial-label-xs">LISENSI</div><div class="trial-value-sm">✓ Aktif</div>';
    chip.classList.remove('warn');
    return;
  }
  if (st.status === 'trial') {
    chip.innerHTML = '<div class="trial-label-xs">GRATIS</div><div class="trial-value-sm">' + st.txRemaining + ' trx</div>';
    chip.classList.toggle('warn', st.txRemaining <= 10);
    return;
  }
  if (st.status === 'expired') {
    chip.innerHTML = '<div class="trial-label-xs">GRATIS</div><div class="trial-value-sm">Habis</div>';
    chip.classList.add('warn');
    return;
  }
  if (st.status === 'revoked') {
    chip.innerHTML = '<div class="trial-label-xs">LISENSI</div><div class="trial-value-sm">✕ Dicabut</div>';
    chip.classList.add('warn');
    return;
  }
  chip.innerHTML = '<div class="trial-label-xs">GRATIS</div><div class="trial-value-sm">—</div>';
  chip.classList.remove('warn');
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
  const { getDeviceIdentity } = await import('./license.logic.js');
  const { deviceCode } = await getDeviceIdentity();
  const text = `Halo, saya ingin aktivasi lisensi Kasir Solo - Kaki Lima.\nKode Perangkat: ${deviceCode}\nAplikasi: Kasir Solo Kaki Lima`;
  window.open('https://wa.me/628816566935?text=' + encodeURIComponent(text), '_blank');
}

export async function activateLicense(inputId) {
  const { activateSerial, getUnitId } = await import('./license.logic.js');
  const { showToast } = await import('./helpers.js');
  const { closeOverlay } = await import('./license.ui.js');
  const { rateLimiters } = await import('./helpers.pure.js');

  // Rate limit: 5 calls per minute
  if (!rateLimiters.activateLicense('activate-license')) {
    showToast('Terlalu banyak percobaan aktivasi. Tunggu sebentar.', 'error');
    return;
  }

  const key = (document.getElementById(inputId).value || '').trim().toUpperCase();
  if (!key) { showToast('Masukkan kode lisensi', 'error'); return; }
  showToast('Memeriksa lisensi...');

  // ── Opsi 3: verifikasi & assign serial ke cloud DULU (1 serial = 1 unit = 1 profil).
  // Kalau online, pastikan profil perangkat cocok dengan baris serial di server.
  // - `assigned`       → unit_id/device direassign ke baris tsb; list tetap lanjut aktif.
  // - `profile-mismatch` → lisensi ditolak & aplikasi DIKUNCI (hubungi admin).
  // - `serial-not-found` → serial tidak ada di server admin.
  // - `network`        → offline; fallback ke validasi HMAC lokal (jalan seperti dulu).
  if (navigator.onLine) {
    const { verifyAndAssignSerial } = await import('./license.sync.js');
    const unitId = await getUnitId();
    const v = await verifyAndAssignSerial(key, unitId);
    if (!v.ok) {
      if (v.reason === 'profile-mismatch') {
        renderProfileMismatchOverlay();
        showToast('Profil perangkat tidak cocok dengan serial ini. Hubungi admin.', 'error', 5000);
        return;
      }
      if (v.reason === 'serial-not-found') {
        showToast('Serial tidak terdaftar di admin. Periksa kembali kode.', 'error');
        return;
      }
      if (v.reason !== 'network') {
        showToast('Lisensi ditolak (' + (v.reason || 'unknown') + '). Hubungi admin.', 'error');
        return;
      }
      // reason === 'network' → lanjut offline di bawah
    }
  }

  const res = await activateSerial(key);
  if (res.valid) {
    if (_updateTrialChip) _updateTrialChip();
    if (_renderLicenseInfoCard) _renderLicenseInfoCard();
    closeOverlay('sheetLicense');
    closeModal('lockOverlay');
    hideQuotaBanner();
    showToast(res.message);
  } else {
    showToast(res.message || 'Kode lisensi tidak valid', 'error');
  }
}

// Lock overlay penuh (mode revoked) saat profil perangkat TIDAK cocok dengan
// serial — aplikasi terkunci dan hanya bisa hubungi admin / beli lisensi baru.
// Tidak ada tombol tutup (mirip halaman "Lisensi Dicabut").
export function renderProfileMismatchOverlay() {
  setLockMode('revoked');
  const page = document.getElementById('lockRevokedPage');
  if (page) {
    page.innerHTML = `
      <img src="assets/icon.png" style="width:80px;height:80px;margin-bottom:8px" alt="Logo">
      <div class="kfs22 kfw800 kmb8">Kasir Solo</div>
      <div style="font-size:14px;color:var(--text2);margin-bottom:16px">Kaki Lima Edition</div>
      <div style="font-size:17px;font-weight:800;color:var(--red)">Profil Tidak Cocok</div>
      <p style="font-size:13px;color:var(--text2);margin:8px 0 14px;line-height:1.5">Lisensi ini terikat ke profil usaha lain.<br>Data usaha perangkat ini harus sesuai dengan data lisensi agar bisa digunakan.</p>
      <div class="license-actions license-actions-row">
        <button class="btn btn-primary" data-action="contact-via-wa">💬 Hubungi Admin</button>
      </div>
      <div class="kfs12 ktext3 kmt14">Perbaiki profil di Pengaturan, atau beli lisensi baru yang sesuai dengan usaha Anda.</div>
    `;
  }
  const area = document.getElementById('lockLicenseStatusArea');
  if (area) area.innerHTML = '';
  // Fallback kalau lockRevokedPage absen (mis. boot sebelum DOM modal siap):
  // render ke konten utama overlay supaya aplikasi tetap terkunci.
  if (!page) {
    const lockEl = document.getElementById('lockOverlay');
    const holder = lockEl && lockEl.querySelector('.modal-body, .mdl-body, [data-modal-body]');
    if (holder) holder.innerHTML = `
      <div style="padding:24px;text-align:center">
        <div style="font-size:18px;font-weight:800;color:var(--red)">Profil Tidak Cocok</div>
        <p style="font-size:13px;color:var(--text2);margin:10px 0">Lisensi ini terikat ke profil usaha lain.<br>Perbaiki profil di Pengaturan, atau hubungi admin.</p>
      </div>`;
  }
  openModal('lockOverlay');
}