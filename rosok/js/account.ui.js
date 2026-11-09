/* =========================================================================
   KASIR SOLO - ROSOK
   account.ui.js — Akun Kasol + multi-role: lapisan DOM. Port kaki5.
   =============================================================================
   · Kartu "Akun Kasol" di halaman Pengaturan.
   · Modal Masuk / Daftar (WA + PIN) + modal Kelola Pegawai (owner-only).
   · Gerbang login = LAYER PERTAMA saat boot (bisa ditutup hanya lewat login;
     Escape/Batal disembunyikan selama gerbang aktif).
   · Penegakan TAMPILAN berbasis peran lewat atribut `data-role`.

   ADAPTASI IDIOM ROSOK (2026-11-09) — jangan ikuti kaki5:
   · rosok TANPA CSP → handler inline `onclick` di markup + export window.*,
     BUKAN dispatcher `data-action` (kaki5 wajib data-action karena CSP).
   · Overlay memakai `openOverlay/closeSheet` (class .show), bukan
     openModal/closeModal + HARD_GATE_OVERLAYS modal.js.
   · `toast(msg)` SATU argumen (kaki5: showToast(msg, type, dur)).
   · `showConfirm({icon,text,okLabel,cancelLabel})` → Promise<boolean>
     (kaki5: showConfirm(icon,text,okLabel,cb,cancelLabel) callback).
   · Tidak ada formatPhoneDisplay → tampilWa() dari account.js.
   ========================================================================= */
import {
  masuk, keluar, muatCache, muatAkses, sesi, peran, boleh, sudahLogin, infoAkun,
  daftarAkun, daftarPegawai, tambahPegawai, ubahRolePegawai, hapusPegawai,
  ROLE_LABEL, ROLE_RANK, akunSiap, normWa, tampilWa, gateBypassed,
} from './account.js';
import { openOverlay, closeSheet, toast, escapeHtml, HARD_GATE_OVERLAYS } from './utils.js';
import { showConfirm } from './confirm.js';
// Fase B1: lisensi mengikuti AKUN. Login → ambil lisensi akun segera; logout →
// lepas lisensi akun dan kembali ke mode perangkat (tier gratis).
import { syncAkunLicense, lepasLisensiAkun } from './license.sync.js';
import { getLicense } from './license.js';

const $ = (id) => document.getElementById(id);
const ROLES = ['owner', 'manajer', 'kasir'];

/** Escape untuk konteks ATRIBUTUT — escapeHtml rosok tidak meng-escape kutip
 *  (temuan audit P1-4). Dipakai untuk data-member/value di markup dinamis. */
function escAttr(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/** Sembunyikan/tampilkan elemen `[data-role]` sesuai peran efektif. */
function filterRoleEls(root) {
  root.querySelectorAll('[data-role]').forEach((el) => {
    const ok = boleh(el.dataset.role);
    el.style.display = ok ? '' : 'none';
    el.setAttribute('aria-hidden', ok ? 'false' : 'true');
  });
}

/** Terapkan peran ke tampilan: render kartu DULU, baru disapu peran. */
export function applyRoleUI() {
  document.body.dataset.role = peran();
  // Urutan penting (pelajaran kaki5): render kartu dulu (ia membuat elemen
  // data-role baru), baru filterRoleEls — kalau terbalik, tombol owner-only
  // di dalam kartu tetap tampil ke kasir.
  renderAkunCard();
  filterRoleEls(document);
}

/** Render isi kartu akun di Pengaturan. */
export function renderAkunCard() {
  const host = $('akunCard');
  if (!host) return;
  _renderAkunCardInner(host);
  filterRoleEls(host);
}

function _renderAkunCardInner(host) {
  const p = peran();
  const badge = `<span class="badge ${p === 'owner' ? 'green' : 'orange'} compact">${escapeHtml(ROLE_LABEL[p] || p)}</span>`;

  if (!akunSiap()) {
    host.innerHTML = '<div class="s-desc">Fitur akun belum aktif di perangkat ini (kredensial server belum tersedia).</div>';
    return;
  }

  const info = infoAkun();
  if (!sudahLogin() || !info) {
    host.innerHTML = `
      <div class="setting-row" style="cursor:pointer" onclick="window.openAkunModal()">
        <span class="setting-ic ic-blue">🔐</span>
        <div class="setting-txt">
          <div class="s-title">Masuk Akun Kasol</div>
          <div class="s-desc">Satu akun untuk semua aplikasi · sekarang ${badge} (perangkat)</div>
        </div>
        <div class="setting-arrow">›</div>
      </div>
      <div class="s-desc" style="margin-top:8px">Belum masuk? Aplikasi tetap bisa dipakai sebagai <b>Pemilik perangkat</b>.</div>`;
    return;
  }

  const wa = tampilWa(info.wa) || info.wa || '—';
  const aksesNote = info.has_access === false ? ' · belum punya akses app ini' : '';
  host.innerHTML = `
    <div class="setting-row">
      <span class="setting-ic ic-green">✅</span>
      <div class="setting-txt">
        <div class="s-title">${escapeHtml(info.nama || 'Akun Kasol')} ${badge}</div>
        <div class="s-desc">${escapeHtml(wa)}${aksesNote}</div>
        <div class="s-desc" id="akunLicNote">Lisensi mengikuti akun ini.</div>
      </div>
    </div>
    <div class="setting-row" data-role="owner" style="cursor:pointer" onclick="window.openStaffModal()">
      <span class="setting-ic ic-orange">👥</span>
      <div class="setting-txt">
        <div class="s-title">Kelola Pegawai</div>
        <div class="s-desc">Tambah / ubah peran kasir &amp; manajer</div>
      </div>
      <div class="setting-arrow">›</div>
    </div>
    <div style="margin-top:10px">
      <button class="btn btn-secondary" type="button" onclick="window.akunLogout()">↩ Keluar Akun</button>
    </div>`;

  // Fase B1: sumber lisensi = akun. Kuota perangkat = SATU angka global
  // `products.max_devices` di Control > Katalog (berlaku semua akun).
  // Baca state lokal supaya kartu cepat, tanpa menunggu jaringan.
  getLicense().then((l) => {
    const el = $('akunLicNote');
    if (!el) return;
    if (l && l.source === 'account') {
      el.textContent = `Lisensi akun aktif · ${l.akunActiveDevices || 0}/${l.akunMaxDevices || 0} perangkat`;
    } else {
      el.textContent = 'Lisensi akun belum tersinkron — cek koneksi atau kuota perangkat.';
    }
  }).catch(() => { /* storage gagal → biarkan teks default */ });
}

// ── Modal Masuk / Daftar ────────────────────────────────────────────────────
export async function openAkunModal() {
  const msg = $('akunMsg'); if (msg) { msg.textContent = ''; msg.style.color = ''; }
  const w = $('akunWa'); if (w) w.value = '';
  const pin = $('akunPin'); if (pin) pin.value = '';
  // Buka modal selalu mulai dari tab Masuk + form daftar dikosongkan (paritas
  // kaki5 v215 — sisa input tab Daftar tidak boleh bocor ke sesi berikutnya).
  ['akunDaftarNama', 'akunDaftarWa', 'akunDaftarPin', 'akunDaftarPin2'].forEach((id) => {
    const el = $(id); if (el) el.value = '';
  });
  akunTabUI('masuk');
  openOverlay('akunModal');
  setTimeout(() => { try { $('akunWa')?.focus(); } catch { /* noop */ } }, 120);
}

export function closeAkunModal() { closeSheet('akunModal'); }

// ── Gerbang login sebagai LAYER PERTAMA ─────────────────────────────────────
// Modal login ditampilkan saat boot bila belum ada sesi Akun Kasol. Selama
// gerbang aktif: Escape TIDAK bisa menutupnya (HARD_GATE_OVERLAYS) dan tombol
// "Batal" disembunyikan. rosok TIDAK punya backdrop-click-close, jadi cukup
// dua penjaga itu. Jalan keluar tanpa akun = tautan khusus #akses-perangkat.
let _lockActive = false;
export function akunLockAktif() { return _lockActive; }

export async function showAkunLock() {
  if (!akunSiap()) return;               // tanpa kredensial server → jangan kunci
  if (!$('akunModal')) return;
  _lockActive = true;
  HARD_GATE_OVERLAYS.add('akunModal');   // Escape tak menutup
  const cancel = $('akunCancel'); if (cancel) cancel.style.display = 'none';
  await openAkunModal();
}

/** Lepas gerbang (login sukses / buka dari Pengaturan). */
export function hideAkunLock() {
  _lockActive = false;
  HARD_GATE_OVERLAYS.delete('akunModal');
  const cancel = $('akunCancel'); if (cancel) cancel.style.display = '';
  closeAkunModal();
}

// ── Tab Masuk / Daftar + pendaftaran in-page ────────────────────────────────
// Daftar = POST Edge Function account-register (backend sama dengan mitra/
// kaki5 — satu tabel akun), lalu auto-masuk. Pesan selalu lewat setAkunMsg.

function setAkunMsg(t, err) {
  const msg = $('akunMsg'); if (!msg) return;
  msg.textContent = t || '';
  msg.style.color = t ? (err ? 'var(--red)' : 'var(--green)') : '';
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

/** Setelah login/daftar sukses: tarik lisensi akun (Fase B1) + segarkan UI. */
async function pascaLoginBerhasil() {
  applyRoleUI();
  try {
    const lic = await syncAkunLicense();
    if (lic && lic.handled && !lic.ok && lic.message) toast('⚠️ ' + lic.message);
    // checkLicenseGate → updateTrialChip + renderLicenseInfoCard + sync throttled
    // (jalur legacy otomatis dilewati bila sesi akun menanggani — Stage E).
    if (typeof window.checkLicenseGate === 'function') await window.checkLicenseGate();
    // Render ulang kartu SETELAH lisensi akun tersimpan: renderAkunCard membaca
    // getLicense() saat digambar, jadi kalau hanya applyRoleUI() di atas, catatan
    // kartu masih "belum tersinkron" walau lisensi baru saja aktif (QA 2026-11-09).
    applyRoleUI();
  } catch (e) { console.warn('[AKUN] sinkron lisensi:', e?.message || e); }
}

/** Daftar akun baru → sukses = langsung masuk. */
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
    await pascaLoginBerhasil();
    toast('✅ Akun Kasol dibuat — selamat datang, ' + (String(nama).trim() || 'Sahabat Kasol') + '!');
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
    await pascaLoginBerhasil();
    toast('✅ Masuk sebagai ' + (ROLE_LABEL[peran()] || peran()));
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Masuk'; }
  }
}

export function akunLogout() {
  showConfirm({
    icon: '🚪',
    text: 'Keluar dari akun ini?',
    okLabel: 'Ya, Keluar',
    cancelLabel: 'Batal',
  }).then(async (ok) => {
    if (!ok) return;
    await keluar();
    // Fase B1: lisensi ikut akun ⇒ saat keluar, lepas lisensi akun dan kembali
    // ke mode perangkat (tier gratis). Bukan revoke penuh — app tetap bisa
    // dipakai, gerbang login tampil sebagai layer pertama lagi.
    try {
      await lepasLisensiAkun('akun-logout');
      if (typeof window.checkLicenseGate === 'function') await window.checkLicenseGate();
    } catch (e) { console.warn('[AKUN] lepas lisensi:', e?.message || e); }
    applyRoleUI();
    closeStaffModal();
    toast('Sudah keluar dari akun.');
    await showAkunLock();   // kembali ke gerbang login (layer pertama)
  });
}

// ── Modal kelola pegawai (owner-only) ───────────────────────────────────────

/** Tukar panel daftar/tambah (dipakai reset openStaffModal). */
function staffTabUI(tab) {
  const isTambah = tab === 'tambah';
  const pD = $('staffPanelDaftar'); if (pD) pD.hidden = isTambah;
  const pT = $('staffPanelTambah'); if (pT) pT.hidden = !isTambah;
  [['staffTabDaftar', !isTambah], ['staffTabTambah', isTambah]].forEach(([id, on]) => {
    const b = $(id); if (!b) return;
    b.classList.toggle('is-on', on);
    b.setAttribute('aria-selected', String(on));
  });
}

/** Aksi tab dari UI — tukar panel + fokus ke field pertama di panel tujuan. */
export function staffTab(tab) {
  staffTabUI(tab);
  if (tab === 'tambah') setTimeout(() => { try { $('staffWa')?.focus(); } catch { /* noop */ } }, 80);
}

export async function openStaffModal() {
  if (!boleh('owner')) { toast('Kelola pegawai khusus pemilik.'); return; }
  const list = $('staffList');
  if (list) list.innerHTML = '<div class="s-desc">Memuat...</div>';
  const msg = $('staffMsg'); if (msg) msg.textContent = '';
  staffTabUI('daftar');   // selalu mulai di tab Daftar (bukan sisa tab terakhir)
  openOverlay('staffModal');
  await muatDaftarStaff();
}

export function closeStaffModal() { closeSheet('staffModal'); }

async function muatDaftarStaff() {
  const list = $('staffList');
  if (!list) return;
  const res = await daftarPegawai();
  if (!res || res.ok === false) {
    const ket = res && res.code === 'forbidden' ? ' (khusus pemilik)' : '';
    list.innerHTML = `<div class="s-desc">Gagal memuat daftar pegawai${ket}. Periksa koneksi.</div>`;
    return;
  }
  const members = Array.isArray(res.members) ? res.members : [];
  if (!members.length) { list.innerHTML = '<div class="s-desc">Belum ada pegawai.</div>'; return; }
  list.innerHTML = members.map((m) => {
    const nm = escapeHtml(m.nama || m.wa || 'Pegawai');
    const wa = escapeHtml(tampilWa(m.wa) || m.wa || '');
    const opts = ROLES.map((r) => `<option value="${r}"${r === m.role ? ' selected' : ''}>${escapeHtml(ROLE_LABEL[r])}</option>`).join('');
    return `
      <div class="staff-row">
        <div class="staff-info">
          <div class="s-title">${nm}${m.is_self ? ' <span class="badge green compact">saya</span>' : ''}</div>
          <div class="s-desc">${wa}</div>
        </div>
        <div class="staff-actions">
          <select class="staff-role" data-member="${escAttr(m.member_id)}" aria-label="Peran pegawai"
                  onchange="window.ubahRoleStaff(this.dataset.member, this.value)">${opts}</select>
          <button type="button" class="btn btn-outline staff-hapus"
                  data-member="${escAttr(m.member_id)}" onclick="window.hapusStaff(this.dataset.member)">Hapus</button>
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
  const setMsg = (t, err) => { if (msg) { msg.textContent = t; msg.style.color = err ? 'var(--red)' : 'var(--green)'; } };
  if (!normWa(wa)) { setMsg('Nomor WhatsApp tidak valid.', true); return; }
  if (btn) { btn.disabled = true; btn.textContent = 'Menyimpan...'; }
  try {
    const res = await tambahPegawai({ wa, nama, role });
    if (!res || res.ok === false) { setMsg((res && res.reason) || 'Gagal menyimpan pegawai.', true); return; }
    if ($('staffWa')) $('staffWa').value = '';
    if ($('staffNama')) $('staffNama').value = '';
    await muatDaftarStaff();
    // Sukses → lompat ke tab Daftar supaya baris barunya langsung terlihat;
    // pesan sukses pindah ke toast (pesan di #staffMsg ada di panel yang
    // baru saja disembunyikan — kalau tetap ditulis, user tak membacanya).
    staffTabUI('daftar');
    if (msg) msg.textContent = '';
    toast('Pegawai ditambahkan.');
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Tambah'; }
  }
}

export function hapusStaff(memberId) {
  if (!memberId) return;
  showConfirm({
    icon: '🗑️',
    text: 'Hapus pegawai ini? Aksesnya ke aplikasi akan dicabut.',
    okLabel: 'Ya, Hapus',
    cancelLabel: 'Batal',
  }).then(async (ok) => {
    if (!ok) return;
    const res = await hapusPegawai(memberId);
    if (!res || res.ok === false) { toast((res && res.reason) || 'Gagal menghapus pegawai.'); return; }
    toast('Pegawai dihapus.');
    await muatDaftarStaff();
  });
}

export async function ubahRoleStaff(memberId, role) {
  if (!memberId || !ROLE_RANK[role]) return;
  const res = await ubahRolePegawai(memberId, role);
  if (!res || res.ok === false) {
    toast((res && res.reason) || 'Gagal mengubah peran.');
    await muatDaftarStaff();
    return;
  }
  toast('Peran diperbarui.');
}

// ── Inisialisasi (dipanggil dari app.js initApp) ────────────────────────────
export async function initAkun() {
  try {
    await muatCache();
    applyRoleUI();
    if (!akunSiap()) return;
    // Cek sesi LOKAL dulu (cepat, tanpa jaringan) → putuskan gerbang lebih awal
    // supaya modal login tampil sebagai layer pertama sebelum UI berat render.
    const s = await sesi();
    const masukSesi = sudahLogin() || !!s;
    if (!masukSesi && !gateBypassed()) {
      // GERBANG HANYA SAAT ONLINE (perbaikan 2026-11-09): rosok dipakai untuk
      // jualan di lapangan. Kalau offline + belum login, mengunci layar berarti
      // perangkat sama sekali tak bisa dipakai padahal login mustahil. Gerbang
      // tetap berlaku penuh begitu ada internet — dipasang listener 'online'.
      if (navigator.onLine) {
        await showAkunLock();
      } else {
        toast('Mode offline — masuk akun tersedia setelah terhubung internet.');
        if (!window._ksr_akunOnlineHook) {
          window._ksr_akunOnlineHook = true;
          window.addEventListener('online', () => {
            try {
              if (!sudahLogin() && !gateBypassed() && !akunLockAktif()) showAkunLock();
            } catch { /* abaikan */ }
          });
        }
      }
    }
    // Segarkan peran dari server di latar (tidak menahan boot / gerbang).
    if (s) muatAkses().then(() => applyRoleUI()).catch(() => {});
  } catch (e) {
    console.warn('[AKUN] init:', e?.message || e);
  }
}
