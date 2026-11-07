/**
 * Akun Kasol + multi-role — lapisan DOM (kaki5).
 * =============================================================================
 * · Kartu "Akun & Peran" di halaman Pengaturan.
 * · Modal login (WA + PIN) dan modal kelola pegawai (owner-only).
 * · Penegakan TAMPILAN berbasis peran lewat atribut `data-role="owner|manajer"`.
 *   Penegakan AKSI juga terjadi di dispatcher app.js (bukan hanya sembunyi UI).
 *
 * Tidak ada inline handler (CSP `script-src 'self'`): semua lewat data-action.
 */
import {
  masuk, keluar, muatCache, muatAkses, sesi, peran, boleh, sudahLogin, infoAkun,
  daftarAkun, daftarPegawai, tambahPegawai, ubahRolePegawai, hapusPegawai,
  ROLE_LABEL, ROLE_RANK, akunSiap, normWa,
  gateBypassed,
} from './account.js';
import { openModal, closeModal, HARD_GATE_OVERLAYS } from './modal.js';
import { showToast, escapeHtml, formatPhoneDisplay } from './helpers.js';
import { showConfirm } from './confirm.js';
// Fase B1: lisensi mengikuti AKUN. Login → ambil lisensi akun segera; logout →
// lepas lisensi akun dan kembali ke mode perangkat (tier gratis).
import { syncAkunLicense, lepasLisensiAkun } from './license.sync.js';
import { getLicense } from './license.logic.js';

const $ = (id) => document.getElementById(id);
const ROLES = ['owner', 'manajer', 'kasir'];

/** Sembunyikan/tampilkan elemen `[data-role]` sesuai peran efektif. */
function filterRoleEls(root) {
  root.querySelectorAll('[data-role]').forEach((el) => {
    const ok = boleh(el.dataset.role);
    el.style.display = ok ? '' : 'none';
    el.setAttribute('aria-hidden', ok ? 'false' : 'true');
  });
}

/** Terapkan peran ke tampilan: sembunyikan elemen yang perannya kurang. */
export function applyRoleUI() {
  const p = peran();
  document.body.dataset.role = p;
  // Render kartu DULU (ia membuat elemen data-role baru), baru disapu peran —
  // urutan terbalik membuat tombol owner-only di dalam kartu tetap tampil ke
  // kasir (temuan uji gerbang 2026-11-04; aksi tetap diblokir server, tapi UI
  // jangan berbohong).
  renderAkunCard();
  filterRoleEls(document);
}

/** Render isi kartu akun di Pengaturan (termasuk sapu peran untuk isinya). */
export function renderAkunCard() {
  const host = $('akunCard');
  if (!host) return;
  _renderAkunCardInner(host);
  filterRoleEls(host);
}

function _renderAkunCardInner(host) {
  const p = peran();
  const badge = `<span class="akun-badge akun-badge-${p}">${escapeHtml(ROLE_LABEL[p] || p)}</span>`;

  if (!akunSiap()) {
    host.innerHTML = '<p class="s-desc">Fitur akun belum aktif di perangkat ini (kredensial server belum tersedia).</p>';
    return;
  }

  const info = infoAkun();
  if (!sudahLogin() || !info) {
    host.innerHTML = `
      <div class="setting-item" data-action="open-akun-modal">
        <div class="setting-icon kbg-blue">🔐</div>
        <div class="setting-info">
          <div class="s-title">Masuk Akun Kasol</div>
          <div class="s-desc">Satu akun untuk semua aplikasi · sekarang ${badge} (perangkat)</div>
        </div>
        <div class="setting-arrow">›</div>
      </div>
      <p class="s-desc kmt8">Belum masuk? Aplikasi tetap bisa dipakai sebagai <b>Pemilik perangkat</b>.</p>`;
    return;
  }

  const wa = formatPhoneDisplay(info.wa) || info.wa || '—';
  const aksesNote = info.has_access === false ? ' · belum punya akses app ini' : '';
  host.innerHTML = `
    <div class="setting-item">
      <div class="setting-icon kbg-green">✅</div>
      <div class="setting-info">
        <div class="s-title">${escapeHtml(info.nama || 'Akun Kasol')} ${badge}</div>
        <div class="s-desc">${escapeHtml(wa)}${aksesNote}</div>
        <div class="s-desc" id="akunLicNote">Lisensi mengikuti akun ini.</div>
      </div>
    </div>
    <div class="setting-item" data-action="open-staff-modal" data-role="owner">
      <div class="setting-icon kbg-orange">👥</div>
      <div class="setting-info"><div class="s-title">Kelola Pegawai</div><div class="s-desc">Tambah / ubah peran kasir &amp; manajer</div></div>
      <div class="setting-arrow">›</div>
    </div>
    <div class="btn-row kmt10">
      <button class="btn btn-secondary" type="button" data-action="akun-logout">↩ Keluar Akun</button>
    </div>`;
  // Fase B1: sumber lisensi = akun. Kuota perangkat = SATU angka global
  // `products.max_devices` di Control > Katalog (berlaku semua akun); angkanya
  // diterima dari respons RPC. Baca state lokal supaya kartu cepat.
  getLicense().then((l) => {
    const el = $('akunLicNote');
    if (!el) return;
    if (l?.source === 'account') {
      el.textContent = `Lisensi akun aktif · ${l.akunActiveDevices || 0}/${l.akunMaxDevices || 0} perangkat`;
    } else {
      el.textContent = 'Lisensi akun belum tersinkron — cek koneksi atau kuota perangkat.';
    }
  }).catch(() => { /* storage gagal → biarkan teks default */ });
}

// ── Modal login ─────────────────────────────────────────────────────────────
export async function openAkunModal() {
  const msg = $('akunMsg'); if (msg) { msg.textContent = ''; msg.style.color = ''; }
  const w = $('akunWa'); if (w) w.value = '';
  const pin = $('akunPin'); if (pin) pin.value = '';
  // v215: reset juga form daftar — buka modal selalu mulai dari tab Masuk.
  ['akunDaftarNama', 'akunDaftarWa', 'akunDaftarPin', 'akunDaftarPin2'].forEach((id) => {
    const el = $(id); if (el) el.value = '';
  });
  akunTabUI('masuk');
  await openModal('akunModal');
  setTimeout(() => { try { $('akunWa')?.focus(); } catch { /* noop */ } }, 120);
}

export function closeAkunModal() { closeModal('akunModal'); }

// ── Gerbang login sebagai LAYER PERTAMA (2026-11-04) ────────────────────────
// Modal login ditampilkan saat boot bila belum ada sesi Akun Kasol. Selama
// gerbang aktif: Escape / klik backdrop / klik navbar TIDAK bisa menutupnya
// (HARD_GATE_OVERLAYS) dan tombol "Batal" disembunyikan. Jalan keluar tanpa
// akun (mode Pemilik perangkat) kini lewat TAUTAN KHUSUS dari dashboard Akun
// Kasol di situs mitra — lihat applyAksesPerangkatLink() di account.js.
let _lockActive = false;
export function akunLockAktif() { return _lockActive; }

export async function showAkunLock() {
  if (!akunSiap()) return;               // tanpa kredensial server → jangan kunci
  if (!$('akunModal')) return;
  _lockActive = true;
  HARD_GATE_OVERLAYS.add('akunModal');   // tak bisa ditutup dari UI
  // Presentasi SELALU lock overlay penuh (kelas permanen `akun-lock-overlay` di
  // index.html) — tak ada kelas tampilan yang ditoggle di sini; yang berubah
  // hanya hak-tutup (HARD_GATE) dan footer gerbang.
  const sub = $('akunSub');
  if (sub) { sub.textContent = 'Masuk dengan Akun Kasol — satu akun untuk semua aplikasi Kasol.'; sub.style.display = ''; }
  const cancel = $('akunCancel'); if (cancel) cancel.style.display = 'none';
  await openAkunModal();
}

/** Lepas gerbang (login sukses / buka dari Pengaturan). */
export function hideAkunLock() {
  _lockActive = false;
  HARD_GATE_OVERLAYS.delete('akunModal');
  const sub = $('akunSub'); if (sub) { sub.textContent = ''; sub.style.display = 'none'; }
  const cancel = $('akunCancel'); if (cancel) cancel.style.display = '';
  closeAkunModal();
}

// ── Tab Masuk / Daftar + pendaftaran in-page (v215) ─────────────────────────
// Daftar = POST Edge Function account-register (backend sama dengan situs
// mitra — satu tabel akun), lalu auto-masuk. Pesan selalu lewat setAkunMsg.

function setAkunMsg(t, err) {
  const msg = $('akunMsg'); if (!msg) return;
  msg.textContent = t || '';
  msg.style.color = t ? (err ? 'var(--danger,#dc2626)' : 'var(--success,#16a34a)') : '';
}

/** Tukar panel tanpa memindah fokus (dipakai reset openAkunModal). */
function akunTabUI(mode) {
  const isDaftar = mode === 'daftar';
  const fM = $('akunFormMasuk'); if (fM) fM.hidden = isDaftar;
  const fD = $('akunFormDaftar'); if (fD) fD.hidden = !isDaftar;
  [['akunTabMasuk', !isDaftar], ['akunTabDaftar', isDaftar]].forEach(([id, on]) => {
    const b = $(id); if (!b) return;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-selected', String(on));
  });
  setAkunMsg('');
}

/** Aksi tab dari UI — tukar panel + fokus ke field pertama. */
export function akunTab(mode) {
  akunTabUI(mode);
  const target = mode === 'daftar' ? 'akunDaftarNama' : 'akunWa';
  setTimeout(() => { try { $(target)?.focus(); } catch { /* noop */ } }, 80);
}

/** Daftar akun baru → sukses = langsung masuk (alur lisensi paritas akunLogin). */
export async function akunDaftar() {
  const nama = $('akunDaftarNama')?.value || '';
  const wa = $('akunDaftarWa')?.value || '';
  const pin = $('akunDaftarPin')?.value || '';
  const pin2 = $('akunDaftarPin2')?.value || '';
  if (pin !== pin2) { setAkunMsg('PIN dan ulangannya tidak sama.', true); return; }
  const btn = $('akunDaftarBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Membuat akun...'; }
  try {
    const res = await daftarAkun({ wa, pin, nama });
    if (!res.ok) {
      if (res.code === 'already_registered') {
        // Sudah punya akun → bawa ke tab Masuk dengan nomor terisi.
        const w = $('akunWa'); if (w && wa) w.value = wa;
        akunTabUI('masuk');
        setAkunMsg('Nomor ini sudah punya akun — silakan masuk.', true);
        return;
      }
      setAkunMsg(res.reason || 'Pendaftaran gagal. Coba lagi sebentar.', true);
      return;
    }
    setAkunMsg('Akun dibuat — masuk otomatis...', false);
    const login = await masuk(wa, pin);
    if (!login.ok) {
      akunTabUI('masuk');
      setAkunMsg('Akun dibuat, tapi login otomatis gagal. Coba masuk manual.', true);
      return;
    }
    hideAkunLock();          // lepas gerbang (sekaligus menutup modal)
    applyRoleUI();
    // Fase B1: lisensi milik akun — tarik segera (paritas akunLogin).
    try {
      const lic = await syncAkunLicense();
      if (lic?.handled && !lic.ok && lic.message) showToast('⚠️ ' + lic.message, 'error', 6000);
      window._ksr_checkLicenseGate?.();
      window._ksr_updateTrialChip?.();
      window._ksr_renderLicenseInfoCard?.();
      renderAkunCard();
    } catch (e) { console.warn('[AKUN] sinkron lisensi:', e?.message || e); }
    showToast('✅ Akun Kasol dibuat — selamat datang, ' + (nama.trim() || 'Sahabat Kasol') + '!', 'success', 5000);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Buat Akun'; }
  }
}

export async function akunLogin() {
  const wa = $('akunWa')?.value || '';
  const pin = $('akunPin')?.value || '';
  const btn = $('akunLoginBtn');
  if (btn) { btn.disabled = true; btn.textContent = 'Memproses...'; }
  try {
    const res = await masuk(wa, pin);
    if (!res.ok) { setAkunMsg(res.reason || 'Gagal masuk.', true); return; }
    setAkunMsg('Berhasil masuk.', false);
    hideAkunLock();          // lepas gerbang (sekaligus menutup modal)
    applyRoleUI();
    // Fase B1: lisensi sekarang MILIK AKUN — ambil SEGERA setelah login, jangan
    // menunggu reload/boot berikutnya. Kuota perangkat ditegakkan server di sini.
    try {
      const lic = await syncAkunLicense();
      if (lic?.handled && !lic.ok && lic.message) showToast('⚠️ ' + lic.message, 'error', 6000);
      window._ksr_checkLicenseGate?.();
      window._ksr_updateTrialChip?.();
      window._ksr_renderLicenseInfoCard?.();
      renderAkunCard();
    } catch (e) { console.warn('[AKUN] sinkron lisensi:', e?.message || e); }
    showToast('✅ Masuk sebagai ' + (ROLE_LABEL[peran()] || peran()), 'success');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Masuk'; }
  }
}

export function akunLogout() {
  showConfirm('🚪', 'Keluar dari akun ini?', 'Ya, Keluar', async () => {
    await keluar();
    // Fase B1: lisensi ikut akun ⇒ saat keluar, lepas lisensi akun dan kembali
    // ke mode perangkat (tier gratis). Bukan revoke penuh — app tetap bisa
    // dipakai, gerbang login tampil sebagai layer pertama lagi.
    try {
      await lepasLisensiAkun('akun-logout');
      window._ksr_checkLicenseGate?.();
      window._ksr_updateTrialChip?.();
      window._ksr_renderLicenseInfoCard?.();
    } catch (e) { console.warn('[AKUN] lepas lisensi:', e?.message || e); }
    applyRoleUI();
    closeModal('staffModal');
    showToast('Sudah keluar dari akun.', 'success');
    await showAkunLock();   // kembali ke gerbang login (layer pertama)
  }, 'Batal');
}

// ── Modal kelola pegawai (owner-only) ───────────────────────────────────────
export async function openStaffModal() {
  if (!boleh('owner')) { showToast('Kelola pegawai khusus pemilik.', 'error'); return; }
  const list = $('staffList');
  if (list) list.innerHTML = '<p class="s-desc">Memuat…</p>';
  const msg = $('staffMsg'); if (msg) msg.textContent = '';
  await openModal('staffModal');
  await muatDaftarStaff();
}

export function closeStaffModal() { closeModal('staffModal'); }

async function muatDaftarStaff() {
  const list = $('staffList');
  if (!list) return;
  const res = await daftarPegawai();
  if (!res || res.ok === false) {
    const ket = res?.code === 'forbidden' ? ' (khusus pemilik)' : '';
    list.innerHTML = `<p class="s-desc">Gagal memuat daftar pegawai${ket}. Periksa koneksi.</p>`;
    return;
  }
  const members = Array.isArray(res.members) ? res.members : [];
  if (!members.length) { list.innerHTML = '<p class="s-desc">Belum ada pegawai.</p>'; return; }
  list.innerHTML = members.map((m) => {
    const nm = escapeHtml(m.nama || m.wa || 'Pegawai');
    const wa = escapeHtml(formatPhoneDisplay(m.wa) || m.wa || '');
    const opts = ROLES.map((r) => `<option value="${r}"${r === m.role ? ' selected' : ''}>${escapeHtml(ROLE_LABEL[r])}</option>`).join('');
    return `
      <div class="staff-row">
        <div class="staff-info">
          <div class="s-title">${nm}${m.is_self ? ' <span class="akun-badge">saya</span>' : ''}</div>
          <div class="s-desc">${wa}</div>
        </div>
        <div class="staff-actions">
          <select class="form-input staff-role" data-action="staff-ubah-role" data-member="${escapeHtml(m.member_id)}" aria-label="Peran pegawai">${opts}</select>
          <button type="button" class="btn btn-secondary btn-sm" data-action="staff-hapus" data-member="${escapeHtml(m.member_id)}">Hapus</button>
        </div>
      </div>`;
  }).join('');
}

export async function tambahStaff() {
  const wa = $('staffWa')?.value || '';
  const nama = $('staffNama')?.value || '';
  const role = $('staffRole')?.value || 'kasir';
  const msg = $('staffMsg');
  const btn = $('staffAddBtn');
  const setMsg = (t, err) => { if (msg) { msg.textContent = t; msg.style.color = err ? 'var(--danger,#dc2626)' : 'var(--success,#16a34a)'; } };
  if (!normWa(wa)) { setMsg('Nomor WhatsApp tidak valid.', true); return; }
  if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }
  try {
    const res = await tambahPegawai({ wa, nama, role });
    if (!res || res.ok === false) { setMsg(res?.reason || 'Gagal menyimpan pegawai.', true); return; }
    if ($('staffWa')) $('staffWa').value = '';
    if ($('staffNama')) $('staffNama').value = '';
    setMsg('Pegawai disimpan.', false);
    await muatDaftarStaff();
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Tambah'; }
  }
}

export function hapusStaff(memberId) {
  if (!memberId) return;
  showConfirm('🗑️', 'Hapus pegawai ini? Aksesnya ke aplikasi akan dicabut.', 'Ya, Hapus', async () => {
    const res = await hapusPegawai(memberId);
    if (!res || res.ok === false) { showToast(res?.reason || 'Gagal menghapus pegawai.', 'error'); return; }
    showToast('Pegawai dihapus.', 'success');
    await muatDaftarStaff();
  }, 'Batal');
}

export async function ubahRoleStaff(memberId, role) {
  if (!memberId || !ROLE_RANK[role]) return;
  const res = await ubahRolePegawai(memberId, role);
  if (!res || res.ok === false) {
    showToast(res?.reason || 'Gagal mengubah peran.', 'error');
    await muatDaftarStaff();
    return;
  }
  showToast('Peran diperbarui.', 'success');
}

// ── Inisialisasi (dipanggil dari app.js init) ───────────────────────────────
export async function initAkun() {
  try {
    await muatCache();
    applyRoleUI();
    if (!akunSiap()) return;
    // Cek sesi LOKAL dulu (cepat, tanpa jaringan) → putuskan gerbang lebih awal
    // supaya modal login tampil sebagai layer pertama sebelum UI berat render.
    const s = await sesi();
    const masukSesi = sudahLogin() || !!s;
    if (!masukSesi && !gateBypassed()) await showAkunLock();
    // Segarkan peran dari server di latar (tidak menahan boot / gerbang).
    if (s) muatAkses().then(() => applyRoleUI()).catch(() => {});
  } catch (e) {
    console.warn('[AKUN] init:', e?.message || e);
  }
}