/**
 * Control Center Kasir Solo — Clients Module (CRM)
 * Menampilkan & mengelola profil klien yang tersinkron dari app klien (kaki5 dll)
 * ke tabel Supabase `clients`. Kartu klien bisa langsung GENERATE lisensi
 * (tanpa pindah ke menu Lisensi) + kirim serial ke WhatsApp merchant.
 * Analitik: total outlet, aktif 30 hari, per app, sebaran wilayah.
 *
 * Akses: semua data lewat supabaseFetch() → Vercel Serverless /api/rest
 * (service_role key hanya server-side, tidak pernah di browser).
 */

import { showToast } from './toast.js';
import { escapeHtml, formatRelativeTime, formatDate, normalizePhone } from './utils.js';
import { STATE, setState, subscribe } from './app-state.js';
import { supabaseFetch, supabaseStorageSign, licenseApi } from './api.js';
import { updateSidebarBadges } from './navigation.js';
import { icon, appIcon, plainLabel } from './icons.js';
import { openAgentDraft, closeAgentDraft } from './agent-draft-ui.js';

// app_type → produk (HANYA metadata: prefix/ikon/label).
// SECURITY (Fix C1): HMAC salt TIDAK lagi di client — generate/verify lisensi
// dipindah ke Vercel Serverless /api/license yang memegang salt server-side.
export const APP_META = {
  kaki5:  { prefix: 'KK5', icon: '🛵', label: 'Kaki Lima' },
  rosok:  { prefix: 'KSR', icon: '♻️', label: 'Rosok' },
  retail: { prefix: 'RTL', icon: '🏪', label: 'Retail' },
  laundry:{ prefix: 'KSL', icon: '🧺', label: 'Laundry' }
};
const catalogProductFor = (at) => (STATE.catalog || []).find((p) => p.appType === at) || null;
const metaFor = (at) => {
  const product = catalogProductFor(at);
  const fallback = APP_META[at] || { prefix: '', icon: '📦', label: (at || 'Lain') };
  return {
    ...fallback,
    icon: product?.icon || fallback.icon,
    label: product?.name || fallback.label,
    kodeProduk: product?.kodeProduk || fallback.prefix || ''
  };
};

let clients = [];

// ══════════════════════════════════════════════════════════════════════════
// HUB — AKUN UTAMA + LISENSI BERBASIS AKUN (Phase 0, 2026-10-20)
// ══════════════════════════════════════════════════════════════════════════
// Model: satu akun (pemilik) bisa punya banyak aplikasi. Setiap baris `clients`
// = 1 perangkat × 1 aplikasi (unit lama). Tampilan admin dikelompokkan jadi
// "akun" supaya terlihat: siapa yang punya berapa app, lisensi, dan perangkat.
//
// Kunci pengelompokan (berurutan prioritas):
//   1. global_identity_id → akun Hub yang sudah diklaim (sumber kebenaran)
//   2. nomor WhatsApp ternormalisasi → calon akun, sebelum ada akun Hub
//   3. unit_id →klien tanpa WA (satu baris = satu akun)
//
// Lihat docs/HUB-DESIGN-DECISIONS.md untuk keputusan desainnya.
let hubIdentities = [];
let hubLicenses = [];
let hubLicenseDevices = [];
let hubMemberships = [];
let hubLoadError = false;    // true = tabel HUB gagal dimuat → jangan tampilkan data lisensi seolah lengkap
let accounts = [];
let clientViewMode = 'account';   // 'account' = kelompok pemilik | 'device' = baris lama
let pageAccountKey = null;        // akun yang sedang dibuka di halaman detail
let pageAccountReturn = null;     // akun asal saat detail perangkat dibuka dari akun

/** Load tabel HUB (akun + lisensi + perangkat + membership). Gagal = array kosong,
 *  bukan fatal: tab Klien harus tetap jalan walau tabel HUB belum ter-migrasi.
 *  TAPI kegagalan harus TERLIHAT — kalau diam-diam, semua akun akan tampil
 *  "Belum ada lisensi" padahal lisensinya ada → admin bisa menerbitkan
 *  lisensi dobel. */
async function loadHubData() {
  const [idRes, licRes, devRes, memRes] = await Promise.all([
    supabaseFetch('/rest/v1/global_identities?order=created_at.desc'),
    supabaseFetch('/rest/v1/licenses?order=created_at.desc'),
    supabaseFetch('/rest/v1/license_devices?order=activated_at.desc'),
    supabaseFetch('/rest/v1/app_memberships')
  ]);
  hubIdentities = idRes.ok ? (idRes.data || []) : [];
  hubLicenses = licRes.ok ? (licRes.data || []) : [];
  hubLicenseDevices = devRes.ok ? (devRes.data || []) : [];
  hubMemberships = memRes.ok ? (memRes.data || []) : [];
  const gagal = [];
  if (!idRes.ok) gagal.push('global_identities');
  if (!licRes.ok) gagal.push('licenses');
  if (!devRes.ok) gagal.push('license_devices');
  if (!memRes.ok) gagal.push('app_memberships');
  hubLoadError = gagal.length > 0;
  if (hubLoadError) console.warn('[hub] gagal memuat:', gagal.join(', '));
}

/** Init module — pipeline tunggal dari tabel `clients` */
let clientChip = ''; // '' = semua status pipeline

/** Chip rail status pipeline — filter + statistik sekaligus (pola outreach).
 *  Di tampilan AKUN, angka = jumlah akun; di tampilan PERANGKAT = jumlah baris. */
function renderClientChips() {
  const host = document.getElementById('clientsChips');
  if (!host) return;
  const byAccount = clientViewMode === 'account' && accounts.length > 0;
  const countFor = (key) => {
    if (!byAccount) return key === '' ? clients.length : clients.filter((c) => c.status === key).length;
    if (key === '') return accounts.length;
    return accounts.filter((a) =>
      a.clients.some((c) => c.status === key)
      || (key === 'aktif' && a.activeLicenses > 0)
    ).length;
  };
  const chips = [{ key: '', short: 'Semua', tone: 'gray', n: countFor('') }]
    .concat(PIPELINE_STAGES.map((st) => ({ key: st.key, short: plainLabel(st.label), tone: st.tone, n: countFor(st.key) })));
  const nArsip = countFor('arsip');
  if (nArsip) chips.push({ key: 'arsip', short: 'Arsip', tone: 'gray', n: nArsip });
  host.innerHTML = chips.map((ch) => `
    <button type="button" class="oc-chip ${clientChip === ch.key ? 'on' : ''}" data-tone="${ch.tone}"
      aria-pressed="${clientChip === ch.key}" onclick="setClientChip('${ch.key}')">
      <i aria-hidden="true"></i>${escapeHtml(ch.short)}<span class="n">${ch.n}</span>
    </button>`).join('');
}

window.setClientChip = function (key) {
  if (clientChip === key) return;
  clientChip = key;
  renderClientChips();
  renderClients();
};

export async function initClients() {
  document.getElementById('clientsSearch')?.addEventListener('input', renderAll);
  document.getElementById('clientsAppFilter')?.addEventListener('change', renderAll);

  // Escape menutup halaman detail (flip page) — halaman detail akun & perangkat.
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const page = document.getElementById('clientDetailPage');
    if (page && !page.hidden) { e.preventDefault(); closeClientPage(); }
  });

  window.addEventListener('screen:change', (e) => {
    if (e.detail?.screen === 'klien') { loadClients(); }
  });

  // Harga (STATE.catalog) bisa datang SETELAH klien selesai dimuat (race saat
  // boot) — render ulang begitu katalog tiba supaya revenue tidak menampilkan Rp0.
  subscribe('catalog', () => renderAll());

  await loadClients();
}

/** Halaman Klien = satu tampilan tabel/kartu (pola katalog).
 *  Analitik sudah digabung ke Dashboard; fungsi tetap ada karena navigation
 *  memanggil switchClientView() di setiap perpindahan layar. */
function switchClientView() {
  renderAll();
}
window.switchClientView = switchClientView;

/** Pipeline stages — satu tabel `clients` */
export const PIPELINE_STAGES = [
  { key: 'baru', label: '🆕 Baru', tone: 'blue' },
  { key: 'dihubungi', label: '📞 Dihubungi', tone: 'orange' },
  { key: 'tertarik', label: '💡 Tertarik', tone: 'amber' },
  { key: 'menunggu_verifikasi', label: '⏳ Verifikasi', tone: 'teal' },
  { key: 'aktif', label: '✅ Aktif', tone: 'green' },
  { key: 'batal', label: '❌ Batal', tone: 'red' },
];

export function stageMeta(status) {
  if (status === 'arsip') return { key: 'arsip', label: '📦 Arsip', tone: 'gray' };
  return PIPELINE_STAGES.find((s) => s.key === status) || { key: status, label: status || 'Tanpa status', tone: 'gray' };
}

/** Chip status (badge tone) utk sel tabel & kartu */
function statusBadgeHtml(c) {
  const sm = stageMeta(c.status);
  return `<span class="badge ${sm.tone}">${escapeHtml(plainLabel(sm.label))}</span>`;
}

/** Tombol CTA pipeline di sheet — lanjut tahap berikutnya sesuai konteks status */
function sheetCtaHtml(c) {
  const id = escapeHtml(c.id);
  switch (c.status) {
    case 'baru': return `<button type="button" class="btn btn-primary" onclick="moveStage('${id}','next')">📞 Hubungi</button>`;
    case 'dihubungi': return `<button type="button" class="btn btn-primary" onclick="moveStage('${id}','next')">💡 Tawarkan</button>`;
    case 'tertarik': return `<button type="button" class="btn btn-primary" onclick="moveStage('${id}','next')">⏳ Minta Verifikasi</button>`;
    case 'aktif': return ''; // aksi lisensi = tombol Cabut di baris aksi
    default: return '';
  }
}

/** Update status pipeline klien (prev/next tab status) */
async function updateClientStatus(id, status) {
  const prev = clients.find((c) => c.id === id);
  if (!prev) return;
  clients = clients.map((c) => c.id === id ? { ...c, status } : c);

  renderAll();
  refreshClientPage();
  updateSidebarBadges({ clients: clients.length });

  try {
    const res = await supabaseFetch(`/rest/v1/clients?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      data: { status },
      headers: { Prefer: 'return=representation' }
    });
    if (!res.ok) throw new Error('Failed to update status');
    showToast(`Status → ${plainLabel(stageMeta(status).label)}`, 1800, 'success');
  } catch (e) {
    clients = clients.map((c) => c.id === id ? prev : c);
    renderAll();
  refreshClientPage();
    console.error(e);
    showToast('Gagal update status', 2000, 'error');
  }
}

/**
 * REVOKE lisensi klien + set status pipeline ke "batal".
 * Mencabut license_serial, license_status, dan activated_at agar perangkat
 * terkunci di sisi klien (realtime) pada refresh berikutnya.
 */
async function revokeClientLicense(id) {
  const c = clients.find((x) => x.id === id);
  if (!c) return;
  const danger = confirm('Revoke lisensi untuk "' + (c.nama_usaha || c.nama_pemilik || c.device_code || 'klien ini') + '"?\n\nLisensi akan dicabut, perangkat akan terkunci, dan klien tidak bisa memakai aplikasi sampai dipulihkan. Lanjutkan?');
  if (!danger) return;

  // optimistic update supaya UI langsung merespon
  const prev = { ...c };
  const now = new Date().toISOString();
  clients = clients.map((x) => x.id === id ? {
    ...x,
    status: 'batal',
    license_status: 'batal',
    license_serial: null,
    activated_at: null,
    revoked_at: now
  } : x);
  renderAll();
  refreshClientPage();

  try {
    const res = await supabaseFetch(`/rest/v1/clients?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      data: {
        status: 'batal',
        license_status: 'batal',
        license_serial: null,
        activated_at: null,
        revoked_at: now
      },
      headers: { Prefer: 'return=representation' }
    });
    if (!res.ok) throw new Error('Failed to revoke');
    showToast('🚫 Lisensi dicabut & perangkat terkunci', 2500, 'success');
  } catch (e) {
    // rollback
    const roll = clients.find((x) => x.id === id);
    clients = clients.map((x) => x.id === id ? prev : x);
    renderAll();
  refreshClientPage();
    console.error(e);
    showToast('Gagal revoke lisensi', 2500, 'error');
  }
}

/** Arsipkan klien — status 'arsip' (non-destruktif; tanpa menyentuh lisensi). */
window.archiveClient = async function (id) {
  const c = clients.find((x) => x.id === id);
  if (!c) return;
  const ok = confirm('Arsipkan "' + (c.nama_usaha || c.nama_pemilik || c.device_code || 'klien ini') + '"?\n\nKlien keluar dari pipeline aktif tapi tidak dihapus — bisa dikeluarkan dari arsip kapan saja. Lanjutkan?');
  if (!ok) return;

  const prev = { ...c };
  clients = clients.map((x) => x.id === id ? { ...x, status: 'arsip' } : x);
  renderAll();
  refreshClientPage();

  try {
    const res = await supabaseFetch(`/rest/v1/clients?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      data: { status: 'arsip' },
      headers: { Prefer: 'return=representation' }
    });
    if (!res.ok) throw new Error('Failed to archive');
    showToast('📦 Klien diarsipkan', 2200, 'success');
  } catch (e) {
    clients = clients.map((x) => x.id === id ? prev : x);
    renderAll();
    refreshClientPage();
    console.error('[archiveClient]', e);
    showToast('Gagal mengarsipkan klien', 2500, 'error');
  }
};

/** Keluarkan klien dari arsip — kembali ke tahap 'baru'. */
window.unarchiveClient = async function (id) {
  const c = clients.find((x) => x.id === id);
  if (!c) return;
  const prev = { ...c };
  clients = clients.map((x) => x.id === id ? { ...x, status: 'baru' } : x);
  renderAll();
  refreshClientPage();

  try {
    const res = await supabaseFetch(`/rest/v1/clients?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      data: { status: 'baru' },
      headers: { Prefer: 'return=representation' }
    });
    if (!res.ok) throw new Error('Failed to unarchive');
    showToast('📤 Klien keluar dari arsip → Baru', 2200, 'success');
  } catch (e) {
    clients = clients.map((x) => x.id === id ? prev : x);
    renderAll();
    refreshClientPage();
    console.error('[unarchiveClient]', e);
    showToast('Gagal mengeluarkan klien dari arsip', 2500, 'error');
  }
};

/** Aktifkan klien — generate lisensi valid + set status 'aktif' + simpan ke Supabase.
 *  Contoh app_type: 'kaki5' → prefix 'KK5'. Serial lifetime (99) dibuat di
 *  server (/api/license) agar cocok dengan salt yang sama dipakai app klien.
 */
async function restoreClientLicense(id) {
  const c = clients.find((x) => x.id === id);
  if (!c) return;

  const appType = c.app_type || '';
  const prefix = (APP_META[appType] || {}).prefix || '';
  const deviceCode = c.device_code || '';

  if (!prefix || !deviceCode) {
    showToast('Data aplikasi/device code belum lengkap untuk generate lisensi', 2500, 'error');
    return;
  }

  // Optimistic: langsung set status aktif + license placeholder di UI
  const prev = { ...c };
  clients = clients.map((x) => x.id === id ? {
    ...x,
    status: 'aktif',
    license_status: 'aktif',
    license_serial: '⏳ Generating...',
    activated_at: new Date().toISOString(),
    verified_at: new Date().toISOString()
  } : x);
  renderAll();
  refreshClientPage();

  try {
    // 1) Generate serial via server (salt server-side only)
    const gen = await licenseApi('generate', {
      prefix,
      deviceCode,
      expCode: '99' // lifetime
    });

    if (!gen.ok || !gen.data?.serial) {
      throw new Error(gen.data?.error || 'Gagal generate serial lisensi');
    }
    const serial = gen.data.serial;

    // 2) Verifikasi cepat (pastikan format valid sebelum disimpan)
    const verify = await licenseApi('verify', {
      prefix,
      serial,
      deviceCode
    });
    if (!verify.ok || !verify.data?.valid) {
      throw new Error('Serial tidak valid setelah generate: ' + (verify.data?.reason || 'unknown'));
    }

    // 3) Simpan ke Supabase (status aktif + serial + license_status + activated_at + verified_at + restored_at)
    const now = new Date().toISOString();
    const patchData = {
      status: 'aktif',
      license_status: 'aktif',
      license_serial: serial,
      activated_at: now,
      verified_at: now,
      restored_at: now
    };

    const res = await supabaseFetch(`/rest/v1/clients?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      data: patchData,
      headers: { Prefer: 'return=representation' }
    });

    if (!res.ok) {
      throw new Error('Gagal menyimpan lisensi ke Supabase (status ' + res.status + ')');
    }

    // 4) Update local state dengan data final
    clients = clients.map((x) => x.id === id ? {
      ...x,
      status: 'aktif',
      license_status: 'aktif',
      license_serial: serial,
      activated_at: now,
      verified_at: now,
      restored_at: now
    } : x);
    renderAll();
  refreshClientPage();

    showToast(`✅ Lisensi aktif • ${prefix}-${serial.slice(-13)}`, 3000, 'success');
  } catch (e) {
    // Rollback
    clients = clients.map((x) => x.id === id ? prev : x);
    renderAll();
  refreshClientPage();
    console.error('[restoreClientLicense]', e);
    showToast('Gagal aktivasi lisensi: ' + (e.message || 'unknown'), 3500, 'error');
  }
}

/** Reassign unit_id CLIENT secara manual (Opsi 3: 1 serial → 1 unit_id → 1 profil).
 *  Dipakai bila perangkat berpindah tanpa jalur otomatis device_assign, atau ada
 *  unit_id yang salah/korup di sisi admin. Validasi konflik unit_id terhadap klien
 *  lain yang masih AKTIF sebelum disimpan ke Supabase.
 */
async function reassignClientUnit(id) {
  const row = clients.find((x) => x.id === id);
  if (!row) return;

  const curUnit = row.unit_id || '';
  const curDevice = row.device_code || '';
  const newUnit = prompt(
    'Reassign unit untuk "' + (row.nama_usaha || row.nama_pemilik || curDevice || 'klien ini') + '".\n\n'
    + 'Aturan (Opsi 3): 1 serial → 1 unit_id → 1 profil.\n'
    + 'Mengubah unit_id di sini TIDAK mengubah serial/js aktivasi.\n\n'
    + 'Unit ID saat ini  : ' + curUnit + '\n'
    + 'Device code saat ini : ' + curDevice + '\n\n'
    + 'Masukkan Unit ID BARU:',
    curUnit || ''
  );
  if (newUnit === null) return;
  const unit = String(newUnit || '').trim();
  if (!unit) { showToast('Unit ID tidak boleh kosong', 2500, 'error'); return; }
  if (unit === curUnit) { showToast('Unit ID tidak berubah', 1800, 'info'); return; }

  // Konflik: unit_id sudah terpakai klien lain yang masih AKTIF (lisensi berjalan)
  const conflict = clients.find((x) => x.id !== id && x.unit_id === unit && x.status === 'aktif');
  if (conflict) {
    showToast('Unit ID ' + unit + ' sudah dipakai klien aktif: ' + (conflict.nama_usaha || conflict.nama_pemilik || conflict.device_code || 'lainnya'), 3500, 'error');
    return;
  }

  // Optimistic update supaya UI langsung merespon
  const prev = { ...row };
  clients = clients.map((x) => x.id === id ? { ...x, unit_id: unit } : x);
  renderAll();
  refreshClientPage();

  try {
    const res = await supabaseFetch(`/rest/v1/clients?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      data: { unit_id: unit },
      headers: { Prefer: 'return=representation' }
    });
    if (!res.ok) throw new Error('Failed to reassign');
    showToast('↔️ Unit ID → ' + unit, 2500, 'success');
  } catch (e) {
    // Rollback
    clients = clients.map((x) => x.id === id ? prev : x);
    renderAll();
  refreshClientPage();
    console.error('[reassignClientUnit]', e);
    showToast('Gagal reassign unit', 2500, 'error');
  }
}

window.revokeClientLicense = revokeClientLicense;
window.restoreClientLicense = restoreClientLicense;
window.reassignClientUnit = reassignClientUnit;

/** Render all (stats + view aktif) */
// --- Info perangkat klien (sheet detail) ---
function deviceInfoHtml(c, esc) {
  const typeTxt = c.device_type ? (c.device_type[0].toUpperCase() + c.device_type.slice(1)) : '';
  const osTxt = c.os ? c.os : '';
  const browserTxt = c.browser || '';
  const bits = [typeTxt, osTxt, browserTxt].filter(Boolean);
  const full = bits.join(' · ');
  return `<span>${esc(full) || '—'}</span>`;
}

function renderAll() {
  buildAccounts();
  renderHubNotice();
  renderClientChips();
  renderClients();
  renderAnalytics();
}

/** Banner peringatan saat tabel HUB gagal dimuat. Tanpa ini, admin melihat
 *  "Belum ada lisensi" untuk semua akun padahal lisensinya ada di DB. */
function renderHubNotice() {
  const el = document.getElementById('hubNotice');
  if (!el) return;
  if (!hubLoadError) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  el.innerHTML = `
    <div class="hub-notice-ic" aria-hidden="true">⚠️</div>
    <div class="hub-notice-txt">
      <strong>Data lisensi &amp; akun tidak termuat.</strong>
      Tabel HUB (akun/lisensi/perangkat) gagal diakses, jadi kolom Lisensi dan tombol
      “Buat Akun Hub” sengaja dinonaktifkan. <b>Jangan terbitkan lisensi baru sebelum
      data termuat</b> — admin bisa melihat “belum ada lisensi” padahal lisensinya ada.
    </div>
    <button type="button" class="btn btn-outline btn-sm" onclick="refreshClients()">⟳ Muat ulang</button>`;
}

/** Render daftar klien: TABEL padat di desktop, KARTU di mobile (pola katalog) */
function renderClients() {
  // ── Tampilan AKUN (default): satu baris = satu pemilik/akun, semua app-nya
  //    digabung. Tampilan PERANGKAT = baris lama (1 perangkat × 1 aplikasi).
  const accWrap = document.getElementById('accountsTableWrap');
  const accCards = document.getElementById('accountsCardList');
  const devWrap = document.getElementById('clientsTableWrap');
  const devCards = document.getElementById('clientsCardList');
  if (clientViewMode === 'account') {
    if (accWrap) accWrap.hidden = false;
    if (accCards) accCards.hidden = false;
    if (devWrap) devWrap.hidden = true;
    if (devCards) devCards.hidden = true;
    renderAccounts();
    return;
  }
  if (accWrap) accWrap.hidden = true;
  if (accCards) accCards.hidden = true;
  if (devWrap) devWrap.hidden = false;
  if (devCards) devCards.hidden = false;

  const tbody = document.getElementById('clientsTableBody');
  const grid = document.getElementById('clientsCardList');
  const empty = document.getElementById('clientsEmpty');
  if (!tbody || !grid || !empty) return;

  const q = (document.getElementById('clientsSearch')?.value || '').toLowerCase();
  const qNorm = (c) => [c.nama_usaha, c.nama_pemilik, c.device_code, c.no_whatsapp, c.email, c.kabkota, c.provinsi, c.unit_id, c.license_serial]
    .some((v) => (v || '').toLowerCase().includes(q));
  const appF = document.getElementById('clientsAppFilter')?.value || '';
  const rows = clients.filter((c) => {
    if (appF && c.app_type !== appF) return false;
    if (clientChip && c.status !== clientChip) return false;
    return q ? qNorm(c) : true;
  });

  if (!rows.length) {
    tbody.innerHTML = '';
    grid.innerHTML = '';
    empty.hidden = false;
    if (clients.length) {
      empty.querySelector('.empty-t').textContent = 'Tidak ada yang cocok';
      empty.querySelector('.empty-d').textContent = 'Ubah kata kunci atau filter app/status.';
    } else {
      empty.querySelector('.empty-t').textContent = 'Belum ada klien';
      empty.querySelector('.empty-d').textContent = 'Data klien muncul otomatis saat aplikasi klien pertama kali terhubung.';
    }
    return;
  }
  empty.hidden = true;

  // ── Tabel (desktop) ──
  // Device code yang sama bisa punya >1 baris di cloud (re-anchor/reinstall).
  // Tandai supaya dua baris yang identik itu jelas BUKAN dua perangkat berbeda.
  const rowsByDevice = new Map();
  clients.forEach((c) => {
    if (!c.device_code) return;
    rowsByDevice.set(c.device_code, (rowsByDevice.get(c.device_code) || 0) + 1);
  });
  tbody.innerHTML = rows.map((c) => {
    const m = metaFor(c.app_type);
    // Baris tanpa nama usaha (mis. 5 baris rosok yang belum isi profil) akan
    // tampil "— —" dan IDENTIK satu sama lain. Pakai device code sebagai
    // identitas, unit_id sebagai sub-teks (unik per baris, termasuk device
    // yang punya 2 baris cloud).
    const nama = c.nama_usaha || c.nama_pemilik || c.device_code || '—';
    const kontak = normalizePhone(c.no_whatsapp) || c.email || '';
    const sub = [c.nama_usaha ? c.nama_pemilik : '', kontak].filter(Boolean).join(' · ')
      || c.unit_id || c.device_code || '—';
    const dupN = rowsByDevice.get(c.device_code) || 1;
    const dupBadge = dupN > 1
      ? `<span class="badge amber" title="Device code ini punya ${dupN} baris di cloud — indikasi duplikat">⚠ ${dupN} baris</span>`
      : '';
    return `
      <tr data-id="${escapeHtml(c.id)}">
        <td><div class="ct-icon">${appIcon(c.app_type, 16)}</div></td>
        <td>
          <div class="ct-name">${escapeHtml(nama)}</div>
          <div class="ct-kode">${escapeHtml(sub)}</div>
        </td>
        <td>
          <div class="ct-name" style="font-weight:600">${escapeHtml(m.label)}</div>
          <div class="ct-kode mono">${escapeHtml(c.unit_id || c.device_code || m.kodeProduk || '—')}</div>
        </td>
        <td>${dupBadge ? dupBadge + ' ' : ''}${statusBadgeHtml(c)}</td>
        <td>${escapeHtml(c.kabkota || c.provinsi || '—')}</td>
        <td class="ct-quota">${txInfoHtml(c)}</td>
        <td class="ct-seen">${formatRelativeTime(c.last_seen)}</td>
        <td class="ct-actions">
          <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); openClientPage('${escapeHtml(c.id)}')" aria-label="Detail ${escapeHtml(nama)}" title="Detail">${icon('pencil', 14)}</button>
        </td>
      </tr>`;
  }).join('');
  tbody.querySelectorAll('tr').forEach((tr) => {
    tr.style.cursor = 'pointer';
    tr.addEventListener('click', () => { rememberFocusOrigin(tr); openClientPage(tr.dataset.id); });
  });

  // ── Kartu (mobile) — dense rows ala native, reuse sistem .oc-* outreach ──
  grid.innerHTML = rows.map((c) => {
    const m = metaFor(c.app_type);
    const nama = c.nama_usaha || c.nama_pemilik || c.device_code || '—';
    const kontak = normalizePhone(c.no_whatsapp) || c.email || '';
    const sm = stageMeta(c.status);
    const q = Number(catalogProductFor(c.app_type)?.txQuota) || 100;
    return `
      <div class="oc-row" data-id="${escapeHtml(c.id)}" role="button" tabindex="0" aria-label="Detail ${escapeHtml(nama)}">
        <div class="oc-ava" title="${escapeHtml(m.label)}">${appIcon(c.app_type, 18)}</div>
        <div class="oc-main">
          <div class="oc-name">${escapeHtml(nama)}</div>
          <div class="oc-sub">${escapeHtml([m.label, c.kabkota].filter(Boolean).join(' · ') || '—')} · <span class="mono">${txInfoHtml(c)}</span></div>
        </div>
        <div class="oc-side">
          <span class="badge ${sm.tone}">${escapeHtml(plainLabel(sm.label))}</span>
          <button class="oc-more" aria-label="Detail ${escapeHtml(nama)}" title="Detail">${icon('pencil', 14)}</button>
        </div>
      </div>`;
  }).join('');
  grid.querySelectorAll('.oc-row').forEach((row) => {
    row.addEventListener('click', () => { rememberFocusOrigin(row); openClientPage(row.dataset.id); });
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); rememberFocusOrigin(row); openClientPage(row.dataset.id); }
    });
  });
}

// ══════════════════════════════════════════════════════════════════════════
// HUB — pengelompokan akun (pemilik) + daftar akun
// ══════════════════════════════════════════════════════════════════════════

/** Kunci akun untuk satu baris klien.
 *  WA dinormalisasi (normalizePhone: 08xx → 62xx) supaya 082325103336 dan
 *  6282325103336 dianggap orang yang sama. Tanpa WA → satu baris = satu akun. */
function hubAccountKeyFor(c) {
  const wa = normalizePhone(c.no_whatsapp || '');
  if (wa) return 'wa:' + wa;
  return 'unit:' + (c.unit_id || c.id || '');
}

/** Bangun grup akun dari baris clients + data lisensi HUB.
 *  Pengelompokan PRIMER = nomor WA (satu orang = satu akun, berapa pun app &
 *  perangkatnya). GID hanya menempel sebagai identitas akun — bukan pemisah
 *  grup: baris instalasi yang sudah diklaim punya GID, yang belum tidak punya.
 *  Kalau GID jadi pemisah, akunnya terpecah jadi dua. */
function buildAccounts() {
  const identById = new Map(hubIdentities.map((i) => [i.id, i]));
  const licById = new Map(hubLicenses.map((l) => [l.id, l]));
  // Satu baris/outlet bisa punya >1 lisensi (lisensi lama dicabut + lisensi
  // baru). Kumpulkan SEMUA — `set` menimpa, dan karena daftar lisensi diurutkan
  // created_at DESC, lisensi TERLAMA justru yang menang (lisensi terbaru hilang).
  const licByClient = new Map();
  const licByOutlet = new Map();
  const pushLic = (map, key, l) => {
    if (!key) return;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(l);
  };
  hubLicenses.forEach((l) => {
    pushLic(licByClient, l.source_client_id, l);
    pushLic(licByOutlet, l.outlet_ref, l);
  });
  const devByLic = new Map();
  const licByDevice = new Map();
  hubLicenseDevices.forEach((d) => {
    if (!devByLic.has(d.license_id)) devByLic.set(d.license_id, []);
    devByLic.get(d.license_id).push(d);
    const l = licById.get(d.license_id);
    if (l && d.status === 'active') licByDevice.set(d.device_code, l);
  });

  const groups = new Map();
  clients.forEach((c) => {
    const key = hubAccountKeyFor(c);
    let g = groups.get(key);
    if (!g) {
      g = { key, gid: null, wa: '', clients: [], licenseIds: new Set() };
      groups.set(key, g);
    }
    if (c.global_identity_id) g.gid = c.global_identity_id;
    if (!g.wa && c.no_whatsapp) g.wa = normalizePhone(c.no_whatsapp);
    g.clients.push(c);
    // Tautan lisensi → baris clients: baris asal (source_client_id), unit/outlet
    // (outlet_ref), atau perangkat aktif. Satu lisensi bisa ketemu lewat lebih
    // dari satu jalur — Set licenseIds yang mencegah dobel.
    const linked = [];
    if (licByClient.has(c.id)) linked.push(...licByClient.get(c.id));
    if (licByOutlet.has(c.unit_id)) linked.push(...licByOutlet.get(c.unit_id));
    const byCode = licByDevice.get(c.device_code);
    if (byCode) linked.push(byCode);
    linked.forEach((l) => g.licenseIds.add(l.id));
  });

  // Gabungkan kelompok yang ternyata satu akun (GID sama) — mis. baris ber-WA
  // dan baris tanpa WA yang milik orang yang sama.
  const byGid = new Map();
  groups.forEach((g) => { if (g.gid) { if (!byGid.has(g.gid)) byGid.set(g.gid, []); byGid.get(g.gid).push(g); } });
  byGid.forEach((list) => {
    if (list.length < 2) return;
    const main = list[0];
    list.slice(1).forEach((other) => {
      main.clients.push(...other.clients);
      other.licenseIds.forEach((id) => main.licenseIds.add(id));
      groups.delete(other.key);
      if (!main.wa && other.wa) main.wa = other.wa;
    });
  });

  // Lisensi yang tertaut ke sebuah akun (GID) ikut masuk grup akun tersebut,
  // walau baris clients-nya belum ada / belum ter-taut.
  // GID = kepemilikan MUTLAK. Kalau lisensi sudah diklaim ke akun A tapi baris
  // clients-nya nempel ke akun B, lisensi itu nongol di dua akun → jumlah
  // lisensi aktif terhitung dobel. Karena itu lisensi dilepas dari grup lain.
  hubLicenses.forEach((l) => {
    if (!l.global_identity_id) return;
    let target = null;
    groups.forEach((g) => { if (!target && g.gid === l.global_identity_id) target = g; });
    if (!target) {
      target = { key: 'gid:' + l.global_identity_id, gid: l.global_identity_id, wa: '', clients: [], licenseIds: new Set() };
      groups.set(target.key, target);
    }
    groups.forEach((g) => { if (g !== target) g.licenseIds.delete(l.id); });
    target.licenseIds.add(l.id);
  });

  accounts = Array.from(groups.values()).map((g) => {
    const licenses = Array.from(g.licenseIds).map((id) => licById.get(id)).filter(Boolean);
    const devices = [];
    licenses.forEach((l) => (devByLic.get(l.id) || []).forEach((d) => devices.push({ ...d, license: l })));

    const apps = new Map();
    g.clients.forEach((c) => apps.set(c.app_type, (apps.get(c.app_type) || 0) + 1));
    licenses.forEach((l) => { if (!apps.has(l.app_type)) apps.set(l.app_type, 0); });

    // Nama akun harus DETERMINISTIK. Urutan `clients` berubah-ubah (last_seen),
    // jadi "ambil yang pertama" bikin nama akun melompat tiap ada perangkat
    // yang heartbeat — admin mengira akun berbeda. Prioritas:
    //   1) outlet pemilik lisensi aktif (yang bayar) — paling representatif
    //   2) nama usaha pertama, diurutkan stabil (unit_id)
    //   3) nama pemilik → 4) nomor WA → 5) "Tanpa nama"
    const byUnit = [...g.clients].sort((x, y) =>
      String(x.unit_id || '').localeCompare(String(y.unit_id || ''), 'id'));
    const activeLicenses = licenses.filter((l) => l.status === 'active');
    const licOwner = activeLicenses
      .map((l) => g.clients.find((c) => c.id === l.source_client_id)
        || g.clients.find((c) => c.unit_id === l.outlet_ref))
      .find((c) => c && (c.nama_usaha || '').trim());
    const withUsaha = licOwner || byUnit.find((c) => (c.nama_usaha || '').trim());
    const withPemilik = byUnit.find((c) => (c.nama_pemilik || '').trim());
    const nama = (withUsaha && withUsaha.nama_usaha)
      || (withPemilik && withPemilik.nama_pemilik)
      || g.wa
      || 'Tanpa nama';

    // Perangkat terpakai + jatah dihitung dari lisensi AKTIF saja. Kalau lisensi
    // lama (dicabut/expired) ikut dihitung, kuotanya ngaco ("1/2 dev" padahal
    // paketnya cuma 1 perangkat).
    const activeDevices = activeLicenses.reduce((s, l) =>
      s + (devByLic.get(l.id) || []).filter((d) => d.status === 'active').length, 0);
    const deviceCodes = Array.from(new Set(g.clients.map((c) => c.device_code).filter(Boolean)));
    // Baris client per kode device (device yang sama bisa punya >1 baris cloud —
    // artefak re-anchor/re-install). Dipakai untuk menandai duplikat di detail.
    const rowsByDevice = new Map();
    g.clients.forEach((c) => {
      if (!c.device_code) return;
      rowsByDevice.set(c.device_code, (rowsByDevice.get(c.device_code) || 0) + 1);
    });
    const identity = g.gid ? (identById.get(g.gid) || null) : null;
    const memberships = hubMemberships.filter((m) => m.global_identity_id === g.gid);

    return {
      key: g.key,
      gid: g.gid,
      identity,
      wa: g.wa,
      nama,
      clients: g.clients,
      licenses,
      devices,
      apps: Array.from(apps.keys()),
      appCount: apps.size,
      activeLicenses: activeLicenses.length,
      activeDevices,
      deviceCodes,
      rowsByDevice,
      // Jatah perangkat per lisensi (device terpakai / jatah paket)
      deviceQuota: activeLicenses.reduce((s, l) => s + (Number(l.max_devices) || 1), 0),
      memberships,
      claimed: !!identity,
      claimable: !identity && licenses.length > 0 && !!g.wa && !hubLoadError
    };
  });

  // Urutan: akun ber-lisensi dulu, lalu multi-aplikasi, lalu alfabetis.
  accounts.sort((a, b) =>
    (b.activeLicenses - a.activeLicenses)
    || (b.appCount - a.appCount)
    || String(a.nama).localeCompare(String(b.nama), 'id')
  );
  return accounts;
}

/** Status agregat sebuah akun: lisensi dulu, kalau belum ada → pipeline. */
function accountStatusMeta(a) {
  if (a.activeLicenses > 0) return { key: 'aktif', label: '✅ Aktif', tone: 'green' };
  for (const st of PIPELINE_STAGES) {
    if (a.clients.some((c) => c.status === st.key)) return st;
  }
  if (a.clients.some((c) => c.status === 'arsip')) return { key: 'arsip', label: '📦 Arsip', tone: 'gray' };
  return { key: '', label: 'Tanpa status', tone: 'gray' };
}

/** Sub-teks baris akun.
 *  Desktop: identitas saja (WA). Jumlah perangkat sudah ada di kolom sendiri —
 *    memunculkannya dua kali dengan arti berbeda bikin membingungkan.
 *  Mobile (compact): WA + aplikasi. `.oc-sub` sengaja satu baris (nowrap +
 *  ellipsis) supaya baris rapat, jadi isinya harus pendek — kalau terlalu
 *  panjang, app pertama ketimpa jadi "Kasir …" yang tidak informatif.
 *  Akun tanpa WA ditampilkan pakai device code, tanpa itu semua akun
 *  "Tanpa nama" jadi baris identik dan tidak bisa dibedakan. */
function accountSubText(a, compact) {
  const labels = a.apps.map((at) => metaFor(at).label);
  const appTxt = labels.length > 1
    ? labels[0] + ' +' + (labels.length - 1)
    : (labels[0] || '');
  if (compact) {
    const id = a.wa || ('tanpa WA ' + (a.deviceCodes[0] || ''));
    return appTxt ? id + ' · ' + appTxt : id;
  }
  if (a.wa) return a.wa;
  const codes = a.deviceCodes.slice(0, 2).join(', ');
  const more = a.deviceCodes.length > 2 ? ' +' + (a.deviceCodes.length - 2) : '';
  return 'tanpa WA' + (codes ? ' · ' + codes + more : '');
}

/** Render daftar akun: TABEL (desktop) + KARTU (mobile). */
function renderAccounts() {
  const tbody = document.getElementById('accountsTableBody');
  const grid = document.getElementById('accountsCardList');
  const empty = document.getElementById('clientsEmpty');
  if (!tbody || !grid || !empty) return;

  const q = (document.getElementById('clientsSearch')?.value || '').toLowerCase();
  const appF = document.getElementById('clientsAppFilter')?.value || '';

  const rows = accounts.filter((a) => {
    if (appF && !a.apps.includes(appF)) return false;
    if (clientChip) {
      const hit = a.clients.some((c) => c.status === clientChip);
      const licHit = clientChip === 'aktif' && a.activeLicenses > 0;
      if (!hit && !licHit) return false;
    }
    if (!q) return true;
    return [a.nama, a.wa, a.gid, a.apps.join(' '), a.deviceCodes.join(' ')]
      .some((v) => (v || '').toLowerCase().includes(q));
  });

  if (!rows.length) {
    tbody.innerHTML = '';
    grid.innerHTML = '';
    empty.hidden = false;
    if (accounts.length) {
      empty.querySelector('.empty-t').textContent = 'Tidak ada akun yang cocok';
      empty.querySelector('.empty-d').textContent = 'Ubah kata kunci, filter app, atau status pipeline.';
    } else {
      empty.querySelector('.empty-t').textContent = 'Belum ada akun';
      empty.querySelector('.empty-d').textContent = 'Data akun muncul otomatis saat aplikasi klien pertama kali terhubung.';
    }
    return;
  }
  empty.hidden = true;

  // ── Tabel (desktop) ──
  tbody.innerHTML = rows.map((a) => {
    const sm = accountStatusMeta(a);
    const appChips = a.apps.map((at) =>
      `<span class="hub-app-chip">${appIcon(at, 12)} ${escapeHtml(metaFor(at).label)}</span>`
    ).join('');
    // Kolom Lisensi: jumlah lisensi aktif + status akun + jatah perangkat.
    // Kolom Perangkat: JUMLAH DEVICE UNIK milik akun (device sama yang punya
    // >1 baris cloud dihitung 1 — itu satu device fisik).
    const licBadge = hubLoadError
      ? '<span class="badge gray">— gagal dimuat</span>'
      : (a.activeLicenses > 0
        ? `<span class="badge green">${a.activeLicenses} aktif</span>`
        : '<span class="badge gray">Belum ada lisensi</span>');
    const acctBadge = hubLoadError ? ''
      : (a.claimed
        ? '<span class="badge teal">🔑 Akun Hub</span>'
        : (a.claimable ? '<span class="badge amber">Belum diklaim</span>' : ''));
    const quotaBadge = (!hubLoadError && a.activeLicenses > 0)
      ? `<span class="badge ${a.activeDevices >= a.deviceQuota ? 'amber' : 'gray'}" title="Perangkat terpakai / jatah paket">${a.activeDevices}/${a.deviceQuota} dev</span>`
      : '';
    const devTxt = a.deviceCodes.length ? `${a.deviceCodes.length}` : '—';
    return `
      <tr data-key="${escapeHtml(a.key)}">
        <td><div class="ct-icon hub-ava">👤</div></td>
        <td>
          <div class="ct-name">${escapeHtml(a.nama)}</div>
          <div class="ct-kode">${escapeHtml(accountSubText(a))}</div>
        </td>
        <td><div class="hub-app-list">${appChips}</div></td>
        <td>${licBadge} ${acctBadge} ${quotaBadge}</td>
        <td class="ct-seen">${escapeHtml(devTxt)}</td>
        <td><span class="badge ${sm.tone}">${escapeHtml(plainLabel(sm.label))}</span></td>
        <td class="ct-actions">
          <button class="btn btn-outline btn-sm" data-acct-open="${escapeHtml(a.key)}" aria-label="Detail akun" title="Detail">${icon('pencil', 14)}</button>
        </td>
      </tr>`;
  }).join('');
  tbody.querySelectorAll('tr').forEach((tr) => {
    tr.style.cursor = 'pointer';
    tr.addEventListener('click', () => { rememberFocusOrigin(tr); openAccountPage(tr.dataset.key); });
  });
  tbody.querySelectorAll('[data-acct-open]').forEach((b) => {
    b.addEventListener('click', (e) => { e.stopPropagation(); rememberFocusOrigin(b); openAccountPage(b.dataset.acctOpen); });
  });

  // ── Kartu (mobile) ──
  grid.innerHTML = rows.map((a) => {
    const sm = accountStatusMeta(a);
    return `
      <div class="oc-row" data-key="${escapeHtml(a.key)}" role="button" tabindex="0" aria-label="Detail akun ${escapeHtml(a.nama)}">
        <div class="oc-ava hub-ava">👤</div>
        <div class="oc-main">
          <div class="oc-name">${escapeHtml(a.nama)}</div>
          <div class="oc-sub">${escapeHtml(accountSubText(a, true))}</div>
        </div>
        <div class="oc-side">
          <span class="badge ${sm.tone}">${escapeHtml(plainLabel(sm.label))}</span>
          <button class="oc-more" data-acct-open="${escapeHtml(a.key)}" aria-label="Detail akun" title="Detail">${icon('pencil', 14)}</button>
        </div>
      </div>`;
  }).join('');
  grid.querySelectorAll('.oc-row').forEach((row) => {
    row.addEventListener('click', () => { rememberFocusOrigin(row); openAccountPage(row.dataset.key); });
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); rememberFocusOrigin(row); openAccountPage(row.dataset.key); }
    });
  });
}

/** Ganti tampilan daftar: 'account' (kelompok pemilik) | 'device' (baris lama). */
window.setClientViewMode = function (mode) {
  const next = mode === 'device' ? 'device' : 'account';
  if (clientViewMode === next) return;
  clientViewMode = next;
  document.querySelectorAll('.oc-seg-view .oc-seg-b').forEach((b) => {
    const on = b.dataset.view === next;
    b.classList.toggle('on', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  renderAll();
  const page = document.getElementById('clientDetailPage');
  if (page) page.hidden = true;
  pageClientId = null;
  pageAccountKey = null;
  const list = document.getElementById('clientsList');
  if (list) list.hidden = false;
  renderAll();
};

/* ============ Halaman detail akun (flip page) ============ */

window.openAccountPage = function (key) {
  if (!accounts.some((a) => a.key === key)) return;
  if (!pageReturnFocus) rememberFocusOrigin();   // klik sudah sering menyetor pemicunya
  pageAccountKey = key;
  pageClientId = null;
  pageAccountReturn = null;
  renderAccountPage();
  const list = document.getElementById('clientsList');
  const page = document.getElementById('clientDetailPage');
  if (list) list.hidden = true;
  if (page) {
    page.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  focusDetailPage();
};

/** Detail akun: aplikasi, lisensi, perangkat, dan aksi admin. */
function renderAccountPage() {
  const page = document.getElementById('clientDetailPage');
  if (!page || !pageAccountKey) return;
  const keepFocus = captureDetailFocus();
  const a = accounts.find((x) => x.key === pageAccountKey);
  if (!a) { closeClientPage(); return; }
  const esc = escapeHtml;
  const sm = accountStatusMeta(a);

  // Badge status akun Hub — label SAMA dengan di daftar (belum diklaim),
  // supaya tidak terlihat seperti dua state berbeda.
  const acctBadge = a.claimed
    ? '<span class="badge teal">🔑 Akun Hub</span>'
    : (a.claimable ? '<span class="badge amber">Belum diklaim</span>' : '<span class="badge gray">Tanpa akun Hub</span>');

  const claimBtn = !a.claimed && a.claimable
    ? `<button type="button" class="btn btn-primary btn-sm" data-acct-claim="${esc(a.key)}">🔑 Buat Akun Hub</button>`
    : '';

  // Baris lisensi per aplikasi
  const licRows = a.licenses.map((l) => {
    const m = metaFor(l.app_type);
    const devs = a.devices.filter((d) => d.license_id === l.id);
    const activeDevs = devs.filter((d) => d.status === 'active');
    const tone = l.status === 'active' ? 'green' : (l.status === 'expired' ? 'amber' : 'gray');
    const statusTxt = l.status === 'active' ? '✅ Lisensi aktif'
      : l.status === 'expired' ? '⏰ Kedaluwarsa'
      : (l.status === 'revoked' ? '🚫 Dicabut' : 'Lisensi belum aktif');
    const planTxt = l.plan === 'multi'
      ? `Multi perangkat (${Number(l.max_devices) || 3})`
      : '1 perangkat';
    const devHtml = devs.length
      ? devs.map((d) => `
          <span class="hub-dev ${esc(d.status)}" title="${esc(d.status === 'active' ? 'Perangkat aktif' : 'Perangkat nonaktif')}">
            ${d.status === 'active' ? '●' : '○'} ${esc(d.device_code)}${d.device_label ? ' · ' + esc(d.device_label) : ''}
          </span>`).join('')
      : '<span class="muted">Belum ada perangkat terdaftar</span>';
    const nextPlan = l.plan === 'multi' ? 'single' : 'multi';
    const nextTxt = l.plan === 'multi' ? '→ 1 perangkat' : '→ Multi perangkat';
    return `
      <div class="hub-lic-row">
        <div class="hub-lic-app">${appIcon(l.app_type, 16)} ${esc(m.label)}</div>
        <div class="hub-lic-mid">
          <div class="hub-lic-meta">
            <span class="badge ${tone}">${esc(statusTxt)}</span>
            <span class="badge ${l.plan === 'multi' ? 'blue' : 'gray'}">${esc(planTxt)}</span>
            ${l.expires_at
              ? `<span class="badge amber">Berakhir ${esc(formatDate(l.expires_at))}</span>`
              : '<span class="badge gray">Seumur hidup</span>'}
            ${Number(l.tx_used) ? `<span class="badge gray">${Number(l.tx_used)} trx terpakai</span>` : ''}
          </div>
          <div class="hub-dev-list">${devHtml}</div>
        </div>
        <div class="hub-lic-act">
          <button type="button" class="btn btn-outline btn-sm" data-lic-plan="${esc(l.id)}" data-next-plan="${esc(nextPlan)}">${esc(nextTxt)}</button>
        </div>
      </div>`;
  }).join('') || '<div class="muted" style="padding:var(--s3) 0">Belum ada lisensi untuk akun ini.</div>';

  // Judul bagian: bedakan BARIS instalasi vs JUMLAH PERANGKAT. Device yang
  // sama bisa punya 2 baris cloud → angka sebelumnya bikin "7" vs "6" kelihatan
  // kontradiktif (kolom Perangkat di list = 6, judul = 7).
  const devSecTitle = a.clients.length === a.deviceCodes.length
    ? `Perangkat & Outlet (${a.clients.length})`
    : `Perangkat & Outlet (${a.clients.length} baris · ${a.deviceCodes.length} perangkat)`;

  // Baris perangkat (dari baris clients)
  const clientRows = a.clients.map((c) => {
    // Device code yang sama bisa punya >1 baris di cloud (artefak re-anchor /
    // reinstall). Tandai supaya admin tahu itu duplikat, bukan device berbeda.
    const dupN = a.rowsByDevice.get(c.device_code) || 1;
    const dupBadge = dupN > 1
      ? `<span class="badge amber" title="Device code ini punya ${dupN} baris di cloud — indikasi duplikat">⚠ ${dupN} baris</span>`
      : '';
    return `
    <div class="oc-row" data-client="${esc(c.id)}" role="button" tabindex="0" aria-label="Detail ${esc(c.nama_usaha || c.device_code)}">
      <div class="oc-ava">${appIcon(c.app_type, 18)}</div>
      <div class="oc-main">
        <div class="oc-name">${esc(c.nama_usaha || c.device_code || '—')}</div>
        <div class="oc-sub">${esc(metaFor(c.app_type).label)} · <span class="mono">${esc(c.device_code || '—')}</span>${c.nama_pemilik ? ' · ' + esc(c.nama_pemilik) : ''}</div>
      </div>
      <div class="oc-side">
        ${dupBadge}
        ${statusBadgeHtml(c)}
        <button class="oc-more" aria-label="Detail" title="Detail">${icon('pencil', 14)}</button>
      </div>
    </div>`;
  }).join('');

  page.innerHTML = `
    <div class="cd-head cd-head-sticky">
      <button type="button" class="btn btn-outline btn-sm" onclick="closeClientPage()">← Kembali</button>
      <div class="cd-title">
        <h3>${esc(a.nama)}</h3>
        <div class="cd-badges">
          <span class="badge ${sm.tone}">${esc(plainLabel(sm.label))}</span>
          ${acctBadge}
          <span class="badge gray">${a.appCount} aplikasi</span>
        </div>
      </div>
      <div class="cd-head-actions">
        ${claimBtn}
      </div>
    </div>

    <div class="cd-sec">
      <div class="cd-sec-t">Akun</div>
      <div class="sheet-info">
        <div class="sheet-info-r"><span class="sheet-info-l">Nama</span><span class="sheet-info-v">${esc(a.nama)}</span></div>
        <div class="sheet-info-r"><span class="sheet-info-l">WhatsApp</span><span class="sheet-info-v">${esc(a.wa || '—')}</span></div>
        <div class="sheet-info-r"><span class="sheet-info-l">Global ID</span><span class="sheet-info-v mono">${esc(a.gid || '— belum ada akun —')}</span></div>
        <div class="sheet-info-r"><span class="sheet-info-l">Aplikasi</span><span class="sheet-info-v">${esc(a.apps.map((at) => metaFor(at).label).join(', ') || '—')}</span></div>
        <div class="sheet-info-r"><span class="sheet-info-l">Perangkat</span><span class="sheet-info-v">${esc(a.deviceCodes.join(', ') || '—')}</span></div>
      </div>
    </div>

    <div class="cd-sec">
      <div class="cd-sec-t">Lisensi per Aplikasi</div>
      <div class="hub-lic-list">${hubLoadError
        ? '<div class="muted" style="padding:var(--s3) 0">Data lisensi gagal dimuat — muat ulang halaman.</div>'
        : licRows}</div>
    </div>

    <div class="cd-sec">
      <div class="cd-sec-t">${esc(devSecTitle)}</div>
      <div class="oc-list" style="padding:0">${clientRows}</div>
    </div>
  `;

  // Aksi: buat akun Hub
  page.querySelectorAll('[data-acct-claim]').forEach((el) => {
    el.addEventListener('click', () => createHubAccount(el.dataset.acctClaim));
  });

  // Aksi: ubah paket perangkat
  page.querySelectorAll('[data-lic-plan]').forEach((el) => {
    el.addEventListener('click', () => toggleDevicePlan(el.dataset.licPlan, el.dataset.nextPlan));
  });

  // Aksi: buka detail perangkat (kembali ke akun setelah ditutup)
  page.querySelectorAll('[data-client]').forEach((el) => {
    const go = () => {
      pageAccountReturn = pageAccountKey;
      openClientPage(el.dataset.client);
    };
    el.addEventListener('click', go);
    el.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
    });
  });

  restoreDetailFocus(keepFocus);
}

/**
 * Buat akun Hub untuk sebuah akun (grup), lalu klaim lisensinya.
 * Urutan: (1) insert global_identities → (2) rpc license_claim_identity per lisensi.
 * RPC memverifikasi profil (nama usaha / WA) → lisensi orang lain tidak bisa diklaim diam-diam.
 */
window.createHubAccount = async function (key) {
  const a = accounts.find((x) => x.key === key);
  if (!a) { showToast('Akun tidak ditemukan — muat ulang daftar', 2500, 'error'); return; }
  if (!a.wa) {
    showToast('Akun ini belum punya nomor WhatsApp — lengkapi di detail perangkat dulu', 3200, 'error');
    return;
  }
  const defaultName = a.nama || a.wa;
  const input = prompt(
    'Buat Akun Hub untuk ' + a.wa + '\n\n'
    + 'Nama ini yang akan tampil di aplikasi Kasol.\n'
    + 'Akun ini menggabungkan semua aplikasi milik nomor tersebut.',
    defaultName
  );
  if (input === null) return;
  const displayName = String(input).trim() || defaultName;

  const btn = document.querySelector('[data-acct-claim]');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Memproses…'; }

  try {
    // 1) Idempoten: kalau nomor ini sudah punya akun Hub, PAKAI yang ada
    //    (bukan insert lagi → bentrok UNIQUE phone_e164).
    let gid = null;
    const found = await supabaseFetch(
      '/rest/v1/global_identities?phone_e164=eq.' + encodeURIComponent(a.wa) + '&limit=1'
    );
    if (found.ok && found.data && found.data[0]) {
      gid = found.data[0].id;
      // lengkapi nama kalau masih kosong
      if (!found.data[0].display_name) {
        await supabaseFetch('/rest/v1/global_identities?id=eq.' + encodeURIComponent(gid), {
          method: 'PATCH', data: { display_name: displayName }
        });
      }
    } else {
      const ins = await supabaseFetch('/rest/v1/global_identities', {
        method: 'POST',
        data: {
          phone_e164: a.wa,
          display_name: displayName,
          status: 'active',
          phone_verified_at: new Date().toISOString()
        },
        headers: { Prefer: 'return=representation' }
      });
      gid = ins.ok && ins.data && ins.data[0] && ins.data[0].id;
      if (!gid) {
        const detail = (ins.data && (ins.data.message || ins.data.error)) || ins.status;
        throw new Error('Gagal membuat akun: ' + detail);
      }
    }

    // 2) Klaim lisensi milik akun ini
    let claimed = 0;
    let failed = 0;
    for (const l of a.licenses) {
      const src = a.clients.find((c) => c.id === l.source_client_id)
        || a.clients.find((c) => c.unit_id === l.outlet_ref);
      const res = await supabaseFetch('/rest/v1/rpc/license_claim_identity', {
        method: 'POST',
        data: {
          p_license_id: l.id,
          p_global_identity_id: gid,
          p_profile: {
            nama_usaha: (src && src.nama_usaha) || '',
            no_whatsapp: (src && src.no_whatsapp) || a.wa
          }
        }
      });
      let ok = !!(res.ok && res.data && res.data.ok);
      if (!ok) {
        // Proxy kadang balas 502 padahal query-nya SUDAH jadi → verifikasi nyata.
        const check = await supabaseFetch('/rest/v1/licenses?id=eq.' + encodeURIComponent(l.id) + '&limit=1');
        const licNow = check.ok && check.data && check.data[0];
        ok = !!(licNow && licNow.global_identity_id === gid);
      }
      if (ok) claimed++; else failed++;
    }

    await loadClients();
    // Pengelompokan berbasis WA → kunci akun TIDAK berubah setelah diklaim.
    // Tetap cari ulang supaya halaman nempel di akun yang sama.
    const same = accounts.find((x) => x.key === key) || accounts.find((x) => x.gid === gid);
    if (same) pageAccountKey = same.key;
    pageAccountReturn = null;
    renderAccountPage();
    showToast(
      `🔑 Akun Hub siap • ${claimed} lisensi diklaim` + (failed ? ` • ${failed} gagal` : ''),
      3500,
      failed ? 'info' : 'success'
    );
  } catch (e) {
    console.error('[createHubAccount]', e);
    await loadClients();
    renderAccountPage();
    showToast('Gagal membuat akun: ' + (e.message || 'unknown'), 3500, 'error');
  }
};

/**
 * Ubah paket perangkat sebuah lisensi: 'single' (1 perangkat) | 'multi' (3 perangkat).
 * Ini levers upsell: lisensi tetap milik akun, jatah perangkat yang bertambah.
 */
window.toggleDevicePlan = async function (licenseId, plan) {
  const next = plan === 'multi' ? 'multi' : 'single';
  const maxDevices = next === 'multi' ? 3 : 1;
  try {
    const res = await supabaseFetch(`/rest/v1/licenses?id=eq.${encodeURIComponent(licenseId)}`, {
      method: 'PATCH',
      data: { plan: next, max_devices: maxDevices },
      headers: { Prefer: 'return=representation' }
    });
    if (!res.ok) throw new Error(res.status);
    await loadClients();
    renderAccountPage();
    showToast(next === 'multi'
      ? '📱 Paket multi-perangkat aktif (3 perangkat)'
      : '📱 Dikembalikan ke 1 perangkat', 2500, 'success');
  } catch (e) {
    console.error('[toggleDevicePlan]', e);
    showToast('Gagal mengubah paket perangkat', 2500, 'error');
  }
};

/* ============ Halaman detail klien (flip page — daftar diganti detail) ============ */

let pageClientId = null;
let pageReturnFocus = null;   // elemen pemicu → fokus dikembalikan saat ditutup

/** Fokus ke halaman detail yang baru dibuka.
 *  Tanpa ini fokus jatuh ke <body> → pengguna keyboard/screen reader kehilangan
 *  tempatnya dan harus menabak-tabak dari awal halaman. */
function focusDetailPage() {
  const page = document.getElementById('clientDetailPage');
  if (!page) return;
  const h = page.querySelector('h3');
  if (h) {
    if (!h.hasAttribute('tabindex')) h.setAttribute('tabindex', '-1');
    h.focus({ preventScroll: true });
    return;
  }
  page.focus({ preventScroll: true });
}

/** Simpan elemen yang sedang fokus sebelum halaman detail dibuka, supaya
 *  fokus bisa dikembalikan ke sana saat ditutup. */
function rememberFocusOrigin(el) {
  const cand = el || document.activeElement;
  if (!cand || cand === document.body || !document.contains(cand)) {
    pageReturnFocus = null;
    return;
  }
  // Kalau elemennya sendiri tidak bisa difokus (mis. <tr>), ambil tombol
  // di dalamnya supaya fokus tetap bisa dikembalikan.
  const focusable = 'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  const target = (cand.matches && cand.matches(focusable))
    ? cand
    : (cand.querySelector && cand.querySelector(focusable));
  pageReturnFocus = target || null;
}

/** Elemen benar-benar terlihat? Wrapper tabel disembunyikan di <=1024px
 *  (mobile pakai daftar kartu), jadi fallback fokus harus sadar ini. */
function isVisibleEl(el) {
  return !!(el && (el.offsetParent || el.getClientRects().length));
}

/** Kembalikan fokus ke pemicu (atau kontrol pertama yang terlihat di daftar
 *  kalau pemicunya sudah hilang karena re-render). */
function restoreFocusOrigin() {
  let target = (pageReturnFocus && document.contains(pageReturnFocus) && isVisibleEl(pageReturnFocus))
    ? pageReturnFocus
    : null;
  if (!target) {
    const cands = [
      document.querySelector('#accountsCardList .oc-more'),
      document.querySelector('#accountsTableBody [data-acct-open]'),
      document.querySelector('#clientsCardList .oc-more'),
      document.querySelector('#clientsTableBody [data-acct-open]'),
    ];
    target = cands.find(isVisibleEl) || null;
  }
  pageReturnFocus = null;
  if (target) target.focus({ preventScroll: true });
}

/** Re-render halaman detail mengganti seluruh isinya → tombol yang sedang
 *  difokus hilang dan fokus jatuh ke <body>. Simpan identitas elemennya dulu
 *  supaya bisa dikembalikan setelah render ulang (mis. setelah loadClients). */
function captureDetailFocus() {
  const page = document.getElementById('clientDetailPage');
  if (!page || page.hidden) return null;
  const el = document.activeElement;
  if (!el || !page.contains(el)) return null;
  for (const attr of ['data-acct-claim', 'data-lic-plan', 'data-client']) {
    const v = el.getAttribute && el.getAttribute(attr);
    if (v) return { attr, v };
  }
  return null;
}

function restoreDetailFocus(saved) {
  if (!saved) return;
  const page = document.getElementById('clientDetailPage');
  if (!page) return;
  let el = null;
  try { el = page.querySelector('[' + saved.attr + '="' + CSS.escape(saved.v) + '"]'); }
  catch { el = null; }
  if (el) el.focus({ preventScroll: true });
}

window.openClientPage = function (id) {
  const c = clients.find((x) => x.id === id);
  if (!c) return;
  if (!pageReturnFocus) rememberFocusOrigin();   // klik sudah sering menyetor pemicunya
  pageClientId = id;
  pageAccountKey = null;   // kini yang terbuka = detail perangkat
  renderClientPage();
  const list = document.getElementById('clientsList');
  const page = document.getElementById('clientDetailPage');
  if (list) list.hidden = true;
  if (page) {
    page.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  focusDetailPage();
};

window.closeClientPage = function () {
  // Kalau detail perangkat dibuka DARI halaman akun → kembali ke akun, bukan daftar.
  const back = pageAccountReturn;
  pageAccountReturn = null;
  pageClientId = null;
  const list = document.getElementById('clientsList');
  const page = document.getElementById('clientDetailPage');
  if (page) page.hidden = true;
  if (back && accounts.some((a) => a.key === back)) {
    openAccountPage(back);
    return;
  }
  pageAccountKey = null;
  if (list) {
    list.hidden = false;
    renderClients();
  }
  restoreFocusOrigin();
};

/** Re-render halaman detail bila sedang terbuka (setelah mutasi / reload data) */
function refreshClientPage() {
  // Mode akun: halaman detail akun yang terbuka
  if (pageAccountKey) {
    if (!accounts.some((a) => a.key === pageAccountKey)) { closeClientPage(); return; }
    renderAccountPage();
    return;
  }
  if (!pageClientId) return;
  if (!clients.some((x) => x.id === pageClientId)) { closeClientPage(); return; }
  renderClientPage();
}

function renderClientPage() {
  const page = document.getElementById('clientDetailPage');
  if (!page || !pageClientId) return;
  const keepFocus = captureDetailFocus();
  const c = clients.find((x) => x.id === pageClientId);
  if (!c) { closeClientPage(); return; }
  const m = metaFor(c.app_type);
  const esc = escapeHtml;
  const id = esc(c.id);
  const nama = c.nama_usaha || c.nama_pemilik || c.device_code || 'Klien';
  const harga = Number(catalogProductFor(c.app_type)?.price) || 0;
  const sm = stageMeta(c.status);

  // Chip lisensi/aktivasi
  const lic = (c.license_status || '').toLowerCase();
  const licChips = [];
  if (lic === 'aktif' || lic === 'active') licChips.push('<span class="lic-chip on">✓ Lisensi Aktif</span>');
  else if (c.activated_at) licChips.push(`<span class="lic-chip">✓ Diaktifkan ${esc(formatDate(c.activated_at))}</span>`);
  if (c.verified_at) licChips.push(`<span class="lic-chip">🔎 Verifikasi ${esc(formatDate(c.verified_at))}</span>`);

  // Bukti pembayaran (hanya saat menunggu verifikasi)
  const buktiBtn = (c.status === 'menunggu_verifikasi' && c.bukti_url)
    ? `<button type="button" class="btn btn-outline" data-bukti="${esc(c.bukti_url)}">🧾 Lihat Bukti Pembayaran</button>` : '';

  page.innerHTML = `
    <div class="cd-head cd-head-sticky">
      <button type="button" class="btn btn-outline btn-sm" onclick="closeClientPage()">← Kembali</button>
      <div class="cd-title">
        <h3>${esc(nama)}</h3>
        <div class="cd-badges">
          <span class="badge ${sm.tone}">${esc(plainLabel(sm.label))}</span>
          ${licChips.join('')}
        </div>
      </div>
      <div class="cd-head-actions">
        <button type="button" class="btn btn-outline btn-sm cd-draft-btn" data-client-id="${id}" data-nama-usaha="${esc(c.nama_usaha || c.nama_pemilik || c.device_code || 'Klien')}" data-app-type="${c.app_type}">💬 Draft Pesan</button>
        ${c.status === 'aktif'
          ? `<button type="button" class="btn btn-danger btn-sm" onclick="revokeClientLicense('${id}')">🚫 Cabut Lisensi</button>`
          : `<button type="button" class="btn btn-primary btn-sm" onclick="restoreClientLicense('${id}')">🟢 Aktifkan Lisensi</button>`}
        ${c.status === 'arsip'
          ? `<button type="button" class="btn btn-outline btn-sm" onclick="unarchiveClient('${id}')">📤 Keluarkan dari Arsip</button>`
          : `<button type="button" class="btn btn-outline btn-sm" onclick="archiveClient('${id}')">📦 Arsipkan</button>`}
      </div>
    </div>

    <div class="cd-sec">
      <div class="cd-sec-t">Pipeline — tap untuk pindah tahap</div>
      <div class="oc-seg" role="group" aria-label="Status pipeline">
        ${PIPELINE_STAGES.map((st) => `
          <button type="button" class="oc-seg-b ${c.status === st.key ? 'on' : ''}" data-tone="${st.tone}"
            aria-pressed="${c.status === st.key}" onclick="setClientStage('${id}','${st.key}')">
            <i aria-hidden="true"></i>${esc(plainLabel(st.label))}
          </button>`).join('')}
      </div>
      ${buktiBtn ? `<div class="cd-btnrow" style="margin-top:10px">${buktiBtn}</div>` : ''}
    </div>

    <div class="cd-sec">
      <div class="cd-sec-t">Profil Outlet</div>
      <div class="sheet-info">
        <div class="sheet-info-r"><span class="sheet-info-l">Pemilik</span><span class="sheet-info-v">${esc(c.nama_pemilik || '—')}</span></div>
        <div class="sheet-info-r"><span class="sheet-info-l">Kontak</span><span class="sheet-info-v">${esc(normalizePhone(c.no_whatsapp) || c.email || '—')}</span></div>
        <div class="sheet-info-r"><span class="sheet-info-l">Lokasi</span><span class="sheet-info-v">${esc([c.desa, c.kecamatan, c.kabkota].filter(Boolean).join(', ') || '—')}</span></div>
        <div class="sheet-info-r"><span class="sheet-info-l">Aplikasi</span><span class="sheet-info-v">${esc(m.label)}${m.kodeProduk ? ' · ' + esc(m.kodeProduk) : ''}</span></div>
        ${harga ? `<div class="sheet-info-r"><span class="sheet-info-l">Harga Deal</span><span class="sheet-info-v">Rp ${harga.toLocaleString('id-ID')}</span></div>` : ''}
        ${c.unit_id ? `<div class="sheet-info-r"><span class="sheet-info-l">Unit ID</span><span class="sheet-info-v mono">${esc(c.unit_id)}</span></div>` : ''}
        <div class="sheet-info-r"><span class="sheet-info-l">Device Code</span><span class="sheet-info-v mono">${esc(c.device_code || '—')}</span></div>
        ${c.device_type || c.browser ? `<div class="sheet-info-r"><span class="sheet-info-l">Perangkat</span><span class="sheet-info-v">${deviceInfoHtml(c, esc)}</span></div>` : ''}
      </div>
    </div>

    <div class="cd-sec">
      <div class="cd-sec-t">Kuota Transaksi Gratis</div>
      <div class="oc-sh-stats" style="border:none;padding:0 0 10px">
        <div class="oc-sh-stat"><span class="oc-sh-sl">Pakai / Efektif</span><span class="oc-sh-sv" style="color:var(--green)">${txInfoHtml(c)}</span></div>
      </div>
      <div class="cd-btnrow">
        <button type="button" class="btn btn-outline btn-sm" onclick="adjustTxQuota('${id}', -10)">−10</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="adjustTxQuota('${id}', 10)">+10</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="adjustTxQuota('${id}', 50)">+50</button>
        <button type="button" class="btn btn-outline btn-sm" onclick="resetTxUsage('${id}')">↺ Reset Pakai</button>
        <button type="button" class="btn btn-ghost btn-sm" onclick="reassignClientUnit('${id}')">↔️ Unit</button>
      </div>
    </div>
  `;

  // Bukti transaksi → signed URL (bucket `bukti`)
  page.querySelectorAll('[data-bukti]').forEach((el) => {
    el.addEventListener('click', async () => {
      const raw = el.dataset.bukti;
      if (!raw) return;
      try {
        el.textContent = '⏳ Membuka bukti…';
        const marker = '/storage/v1/object/';
        const idx = raw.indexOf(marker);
        if (idx < 0) throw new Error('URL bukti tidak valid');
        const tail = raw.slice(idx + marker.length);
        const parts = tail.split('/').filter(Boolean);
        const visibility = parts.shift();
        const bucket = visibility === 'public' || visibility === 'sign' ? parts.shift() : visibility;
        const objectPath = parts.join('/');
        if (bucket !== 'bukti' || !objectPath || objectPath.includes('..')) throw new Error('Path bukti tidak valid');
        const signed = await supabaseStorageSign(bucket, objectPath);
        if (!signed.ok || !signed.data?.url) throw new Error('Gagal membuat link bukti');
        window.open(signed.data.url, '_blank', 'noopener');
      } catch (err) {
        console.error(err);
        showToast('Foto bukti tidak dapat dibuka', 2200, 'error');
      } finally { el.textContent = '🧾 Lihat Bukti Pembayaran'; }
    });
  });

  // Draft Pesan button — buka modal dengan data klien
  const draftBtn = page.querySelector('.cd-draft-btn');
  if (draftBtn) {
    draftBtn.addEventListener('click', () => {
      const clientId = draftBtn.dataset.clientId;
      const clientData = {
        id: clientId,
        nama_usaha: c.nama_usaha || c.nama_pemilik || c.device_code || 'Klien',
        app_type: c.app_type,
        status: c.status
      };
      openAgentDraft(clientId, clientData);
    });
  }

  restoreDetailFocus(keepFocus);
}

// ===== Kuota transaksi gratis (2026-08-29) =====
// Kuota efektif = products.tx_quota (kartu Produk) + clients.tx_adjust (bonus
// admin per pelanggan, bisa negatif). Admin bisa reset penghitung bulanan.
function txInfoHtml(c) {
  const q = Number(catalogProductFor(c.app_type)?.txQuota) || 100;
  const adj = Number(c.tx_adjust) || 0;
  const used = Number(c.tx_used) || 0;
  const eff = q + adj;
  const badge = adj ? ` <span class="badge ${adj > 0 ? 'green' : 'red'}">${adj > 0 ? '+' : ''}${adj} admin</span>` : '';
  return `${used}/${eff} trx${badge}`;
}

window.adjustTxQuota = async function (id, delta) {
  const c = clients.find((x) => x.id === id);
  if (!c) return;
  const next = (Number(c.tx_adjust) || 0) + delta;
  try {
    const res = await supabaseFetch(`/rest/v1/clients?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      data: { tx_adjust: next },
      headers: { Prefer: 'return=representation' }
    });
    if (!res.ok) throw new Error(res.text || res.status);
    c.tx_adjust = next;
    renderAll();
    refreshClientPage();
    showToast(next > 0 ? `Bonus kuota kini +${next}` : next < 0 ? `Kuota kini ${next} dari global` : 'Bonus kuota dihapus', 2000, 'success');
  } catch (err) {
    console.error(err);
    showToast('Gagal mengubah kuota', 2200, 'error');
  }
};

window.resetTxUsage = async function (id) {
  const c = clients.find((x) => x.id === id);
  if (!c) return;
  if (!confirm('Reset penghitung transaksi bulan ini ke 0 untuk klien ini?')) return;
  try {
    const res = await supabaseFetch(`/rest/v1/clients?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      data: { tx_used: 0, tx_month: null, tx_updated_at: new Date().toISOString() },
      headers: { Prefer: 'return=representation' }
    });
    if (!res.ok) throw new Error(res.text || res.status);
    c.tx_used = 0;
    renderAll();
    refreshClientPage();
    showToast('Penghitung transaksi direset — kuota segar', 2200, 'success');
  } catch (err) {
    console.error(err);
    showToast('Gagal reset penghitung', 2200, 'error');
  }
};

/** Pindah kartu ke tahap lain — dir='prev'|'next' ATAU key stage langsung */
function moveStage(id, dir) {
  const c = clients.find((x) => x.id === id);
  if (!c) return;
  let target;
  if (dir === 'next') {
    const idx = PIPELINE_STAGES.findIndex((s) => s.key === c.status);
    if (idx < 0 || idx >= PIPELINE_STAGES.length - 1) return;
    target = PIPELINE_STAGES[idx + 1].key;
  } else if (dir === 'prev') {
    const idx = PIPELINE_STAGES.findIndex((s) => s.key === c.status);
    if (idx <= 0) return;
    target = PIPELINE_STAGES[idx - 1].key;
  } else {
    // target stage key langsung (dari drag & drop)
    if (!PIPELINE_STAGES.some((s) => s.key === dir) || dir === c.status) return;
    target = dir;
  }
  updateClientStatus(id, target);
}
window.moveStage = moveStage;
/** Chip status di halaman detail — satu tap langsung pindah tahap */
window.setClientStage = function (id, status) {
  const c = clients.find((x) => x.id === id);
  if (!c || c.status === status) return;
  updateClientStatus(id, status);
};

/** Buka detail klien dari dashboard → pindah ke layar Klien + buka sheet */
window.openClientAccordion = async function (id) {
  try { window.showScreen('klien'); } catch {}
  // tunggu semua load asinkron (coalesced) selesai supaya data terbaru
  await loadClients();
  window.openClientPage(id);
};

/** Load all clients from Supabase */
async function loadClients() {
  if (loadClients._inflight) return loadClients._inflight;
  const p = (async () => {
    try {
      const res = await supabaseFetch('/rest/v1/clients?order=last_seen.desc');
      clients = res.ok ? (res.data || []) : [];
    } catch (e) {
      clients = [];
      console.error('load clients', e);
    }
    // Data HUB (akun + lisensi). Gagal tidak boleh mematikan tab Klien.
    try {
      await loadHubData();
    } catch (e) {
      console.error('load hub data', e);
    }
    renderAll();
    refreshClientPage();
    updateSidebarBadges({ clients: clients.length });
    setState('clients', clients);
  })();
  loadClients._inflight = p;
  try { return await p; } finally { loadClients._inflight = null; }
}
window.refreshClients = loadClients;

/** Analitik klien — digabung ke halaman Dashboard (chart pipeline/app/wilayah) */
export function renderAnalytics() {
  // Digabung ke halaman Dashboard (audit ui-ux 2026-09-10) — render ke #dashboardAnalytics.
  const host = document.getElementById('dashboardAnalytics');
  if (!host) return;

  const q = (document.getElementById('clientsSearch')?.value || '').toLowerCase();
  const appF = document.getElementById('clientsAppFilter')?.value || '';
  const rows = clients.filter((c) => {
    if (appF && c.app_type !== appF) return false;
    if (!q) return true;
    return [c.nama_usaha, c.nama_pemilik, c.device_code, c.no_whatsapp, c.kabkota, c.provinsi, c.unit_id]
      .some((v) => (v || '').toLowerCase().includes(q));
  });

  if (!rows.length) {
    host.innerHTML = `<div class="empty-state"><div class="empty-ic">${icon('chart', 34)}</div><div class="empty-t">Belum ada data klien</div><div class="empty-d">Data analitik muncul saat klien pertama kali terhubung.</div></div>`;
    return;
  }

  const priceForClient = (c) => Number((STATE.catalog || []).find((p) => p.appType === c.app_type)?.price) || 0;

  // Per status pipeline
  const perStatus = PIPELINE_STAGES.map((st) => {
    const list = rows.filter((c) => c.status === st.key);
    return { ...st, n: list.length, rev: list.reduce((a, c) => a + priceForClient(c), 0) };
  });
  const maxStage = Math.max(1, ...perStatus.map((s) => s.n));

  // Per aplikasi
  const perApp = Object.entries(APP_META).map(([at, m]) => ({
    ...m, key: at, n: rows.filter((c) => c.app_type === at).length
  })).filter((x) => x.n > 0);
  const appTotal = perApp.reduce((a, x) => a + x.n, 0);
  const maxApp = Math.max(1, ...perApp.map((x) => x.n));

  // Sebaran wilayah (kabkota/provinsi)
  const wil = {};
  rows.forEach((c) => {
    const w = c.kabkota || c.provinsi;
    if (w) wil[w] = (wil[w] || 0) + 1;
  });
  const topWilayah = Object.entries(wil).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxWil = Math.max(1, ...topWilayah.map(([, n]) => n));

  const barStage = perStatus.filter((s) => s.n > 0).map((s) => `
    <div class="bar-row">
      <span class="bar-label">${escapeHtml(plainLabel(s.label))}</span>
      <div class="bar-track"><div class="bar-fill tone-${s.tone}" style="width:${(s.n / maxStage) * 100}%"></div></div>
      <span class="bar-num">${s.n}</span>
    </div>`).join('') || `<div class="text-xs" style="color:var(--text2)">Belum ada klien di pipeline ini.</div>`;

  const barApp = perApp.map((x) => `
    <div class="bar-row">
      <span class="bar-label">${appIcon(x.key, 13)} ${escapeHtml(x.label)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${(x.n / maxApp) * 100}%"></div></div>
      <span class="bar-num">${x.n}</span>
    </div>`).join('');

  const barWil = topWilayah.map(([w, n]) => `
    <div class="bar-row">
      <span class="bar-label">${escapeHtml(w)}</span>
      <div class="bar-track"><div class="bar-fill tone-teal" style="width:${(n / maxWil) * 100}%"></div></div>
      <span class="bar-num">${n}</span>
    </div>`).join('') || `<div class="text-xs" style="color:var(--text2)">Belum ada data wilayah.</div>`;

  host.innerHTML = `
    <div class="an-grid">
      <div class="an-box">
        <h4 class="an-title">Pipeline per Status</h4>
        ${barStage}
      </div>
      <div class="an-box">
        <h4 class="an-title">Klien per Aplikasi</h4>
        ${barApp}
        <div class="text-xs" style="color:var(--text2);margin-top:var(--s3)">Total ${appTotal} klien</div>
      </div>
      <div class="an-box">
        <h4 class="an-title">Sebaran Wilayah</h4>
        ${barWil}
      </div>
    </div>
  `;
}
