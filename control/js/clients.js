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
import { updateSidebarBadges } from './navigation.js?v=20260911c';
import { icon, appIcon, plainLabel } from './icons.js';

// app_type → produk (HANYA metadata: prefix/ikon/label).
// SECURITY (Fix C1): HMAC salt TIDAK lagi di client — generate/verify lisensi
// dipindah ke Vercel Serverless /api/license yang memegang salt server-side.
export const APP_META = {
  kaki5:  { prefix: 'KK5', icon: '🛵', label: 'Kaki Lima' },
  rosok:  { prefix: 'KSR', icon: '♻️', label: 'Rosok' },
  gerobak:{ prefix: 'GBK', icon: '🛒', label: 'Gerobak' },
  retail: { prefix: 'RTL', icon: '🏪', label: 'Retail' }
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

/** Init module — pipeline tunggal dari tabel `clients` */
export async function initClients() {
  document.getElementById('clientsSearch')?.addEventListener('input', renderAll);
  document.getElementById('clientsAppFilter')?.addEventListener('change', renderAll);
  document.getElementById('clientsStatusFilter')?.addEventListener('change', renderAll);

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
  const danger = confirm('Revoke lisensi untuk "' + (c.nama_usaha || c.nama_warung || c.device_code || 'klien ini') + '"?\n\nLisensi akan dicabut, perangkat akan terkunci, dan klien tidak bisa memakai aplikasi sampai dipulihkan. Lanjutkan?');
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
    'Reassign unit untuk "' + (row.nama_usaha || row.nama_warung || curDevice || 'klien ini') + '".\n\n'
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
    showToast('Unit ID ' + unit + ' sudah dipakai klien aktif: ' + (conflict.nama_usaha || conflict.nama_warung || conflict.device_code || 'lainnya'), 3500, 'error');
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
  const title = c.user_agent ? `title="${esc(c.user_agent)}"` : '';
  return `<span ${title}>${full || '—'}</span>`;
}

function renderAll() {
  renderClients();
  renderAnalytics();
}

/** Render daftar klien: TABEL padat di desktop, KARTU di mobile (pola katalog) */
function renderClients() {
  const tbody = document.getElementById('clientsTableBody');
  const grid = document.getElementById('clientsCardList');
  const empty = document.getElementById('clientsEmpty');
  if (!tbody || !grid || !empty) return;

  const q = (document.getElementById('clientsSearch')?.value || '').toLowerCase();
  const qNorm = (c) => [c.nama_usaha, c.nama_warung, c.nama_pemilik, c.device_code, c.no_whatsapp, c.email, c.kabkota, c.provinsi, c.unit_id, c.serial]
    .some((v) => (v || '').toLowerCase().includes(q));
  const appF = document.getElementById('clientsAppFilter')?.value || '';
  const stF = document.getElementById('clientsStatusFilter')?.value || '';
  const rows = clients.filter((c) => {
    if (appF && c.app_type !== appF) return false;
    if (stF && c.status !== stF) return false;
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
  tbody.innerHTML = rows.map((c) => {
    const m = metaFor(c.app_type);
    const nama = c.nama_usaha || c.nama_warung || '—';
    const kontak = normalizePhone(c.no_whatsapp) || c.email || '';
    return `
      <tr data-id="${escapeHtml(c.id)}">
        <td><div class="ct-icon">${appIcon(c.app_type, 16)}</div></td>
        <td>
          <div class="ct-name">${escapeHtml(nama)}</div>
          <div class="ct-kode">${escapeHtml(c.nama_pemilik || '—')}${kontak ? ' · ' + escapeHtml(kontak) : ''}</div>
        </td>
        <td>
          <div class="ct-name" style="font-weight:600">${escapeHtml(m.label)}</div>
          <div class="ct-kode">${escapeHtml(m.kodeProduk || c.device_code || '—')}</div>
        </td>
        <td>${statusBadgeHtml(c)}</td>
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
    tr.addEventListener('click', () => openClientPage(tr.dataset.id));
  });

  // ── Kartu (mobile) ──
  grid.innerHTML = rows.map((c) => {
    const m = metaFor(c.app_type);
    const nama = c.nama_usaha || c.nama_warung || '—';
    const kontak = normalizePhone(c.no_whatsapp) || c.email || '';
    return `
      <article class="catalog-card" data-id="${escapeHtml(c.id)}">
        <div class="catalog-card-cover">${appIcon(c.app_type, 30)}</div>
        <div class="catalog-card-title">${escapeHtml(nama)}</div>
        <div class="catalog-card-desc">${escapeHtml([c.nama_pemilik, kontak].filter(Boolean).join(' · ') || '—')}</div>
        <div class="catalog-card-meta">${escapeHtml(m.label)}${c.kabkota ? ' · ' + escapeHtml(c.kabkota) : ''}</div>
        <div class="catalog-card-meta" style="color:var(--green);font-weight:600">${txInfoHtml(c)}</div>
        <div class="catalog-card-category">${statusBadgeHtml(c)}</div>
        <div class="catalog-card-actions">
          <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); openClientPage('${escapeHtml(c.id)}')">Detail</button>
        </div>
      </article>`;
  }).join('');
  grid.querySelectorAll('.catalog-card').forEach((card) => {
    card.addEventListener('click', () => openClientPage(card.dataset.id));
  });
}

/* ============ Halaman detail klien (flip page — daftar diganti detail) ============ */

let pageClientId = null;

window.openClientPage = function (id) {
  const c = clients.find((x) => x.id === id);
  if (!c) return;
  pageClientId = id;
  renderClientPage();
  const list = document.getElementById('clientsList');
  const page = document.getElementById('clientDetailPage');
  if (list) list.hidden = true;
  if (page) {
    page.hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
};

window.closeClientPage = function () {
  pageClientId = null;
  const list = document.getElementById('clientsList');
  const page = document.getElementById('clientDetailPage');
  if (page) page.hidden = true;
  if (list) {
    list.hidden = false;
    renderClients();
  }
};

/** Re-render halaman detail bila sedang terbuka (setelah mutasi / reload data) */
function refreshClientPage() {
  if (!pageClientId) return;
  if (!clients.some((x) => x.id === pageClientId)) { closeClientPage(); return; }
  renderClientPage();
}

function renderClientPage() {
  const page = document.getElementById('clientDetailPage');
  if (!page || !pageClientId) return;
  const c = clients.find((x) => x.id === pageClientId);
  if (!c) { closeClientPage(); return; }
  const m = metaFor(c.app_type);
  const esc = escapeHtml;

  const nama = c.nama_usaha || c.nama_warung || 'Klien';
  const harga = Number(catalogProductFor(c.app_type)?.price) || 0;

  // Chip lisensi/aktivasi
  const lic = (c.license_status || '').toLowerCase();
  const licChips = [];
  if (lic === 'aktif' || lic === 'active') licChips.push('<span class="lic-chip on">✓ Lisensi Aktif</span>');
  else if (c.activated_at) licChips.push(`<span class="lic-chip">✓ Diaktifkan ${esc(formatDate(c.activated_at))}</span>`);
  if (c.verified_at) licChips.push(`<span class="lic-chip">🔎 Verifikasi ${esc(formatDate(c.verified_at))}</span>`);

  // Bukti pembayaran (hanya saat menunggu verifikasi)
  const buktiBtn = (c.status === 'menunggu_verifikasi' && c.bukti_url)
    ? `<button type="button" class="btn btn-outline" data-bukti="${esc(c.bukti_url)}">🧾 Lihat Bukti</button>` : '';

  page.innerHTML = `
    <div class="cd-head">
      <button type="button" class="btn btn-outline btn-sm" onclick="closeClientPage()">← Kembali</button>
      <div class="cd-title">
        <h3>${esc(nama)}</h3>
        <div class="cd-badges">
          ${statusBadgeHtml(c)}
          ${licChips.join('')}
          <span class="lic-chip">👁 ${esc(formatRelativeTime(c.last_seen))}</span>
        </div>
      </div>
    </div>
    <div class="cd-grid">
      <div class="panel">
        <div class="panel-head"><h3 class="panel-t">Profil Klien</h3></div>
        <div class="panel-body">
          <div class="sheet-info">
            <div class="sheet-info-r"><span class="sheet-info-l">Pemilik</span><span class="sheet-info-v">${esc(c.nama_pemilik || '—')}</span></div>
            <div class="sheet-info-r"><span class="sheet-info-l">Kontak</span><span class="sheet-info-v">${esc(normalizePhone(c.no_whatsapp) || c.email || '—')}</span></div>
            <div class="sheet-info-r"><span class="sheet-info-l">Lokasi</span><span class="sheet-info-v">${esc([c.desa, c.kecamatan, c.kabkota].filter(Boolean).join(', ') || '—')}</span></div>
            <div class="sheet-info-r"><span class="sheet-info-l">Aplikasi</span><span class="sheet-info-v">${esc(m.label)}${m.kodeProduk ? ' · ' + esc(m.kodeProduk) : ''}</span></div>
            ${c.unit_id ? `<div class="sheet-info-r"><span class="sheet-info-l">Unit ID</span><span class="sheet-info-v mono">${esc(c.unit_id)}</span></div>` : ''}
            <div class="sheet-info-r"><span class="sheet-info-l">Device Code</span><span class="sheet-info-v mono">${esc(c.device_code || '—')}</span></div>
            ${c.device_type || c.browser ? `<div class="sheet-info-r"><span class="sheet-info-l">Perangkat</span><span class="sheet-info-v">${deviceInfoHtml(c, esc)}</span></div>` : ''}
            ${harga ? `<div class="sheet-info-r"><span class="sheet-info-l">Harga Deal</span><span class="sheet-info-v">Rp ${harga.toLocaleString('id-ID')}</span></div>` : ''}
            <div class="sheet-info-r"><span class="sheet-info-l">Kuota Gratis</span><span class="sheet-info-v">${txInfoHtml(c)}</span></div>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-head"><h3 class="panel-t">Kelola</h3></div>
        <div class="panel-body">
          <div class="field">
            <label class="field-label">Status Pipeline</label>
            <select id="clientStatusSel" onchange="moveStage('${esc(c.id)}', this.value)">
              ${PIPELINE_STAGES.map((s) => `<option value="${s.key}" ${c.status === s.key ? 'selected' : ''}>${esc(plainLabel(s.label))}</option>`).join('')}
            </select>
          </div>
          <div class="field">
            <label class="field-label">🎁 Kuota Transaksi — adjust per pelanggan</label>
            <div class="cd-btnrow">
              <button type="button" class="btn btn-outline btn-sm" onclick="adjustTxQuota('${esc(c.id)}', -10)">−10</button>
              <button type="button" class="btn btn-outline btn-sm" onclick="adjustTxQuota('${esc(c.id)}', 10)">+10</button>
              <button type="button" class="btn btn-outline btn-sm" onclick="adjustTxQuota('${esc(c.id)}', 50)">+50</button>
              <button type="button" class="btn btn-outline btn-sm" onclick="resetTxUsage('${esc(c.id)}')">↺ Reset Pakai</button>
            </div>
          </div>
          ${buktiBtn ? `<div class="cd-btnrow">${buktiBtn}</div>` : ''}
        </div>
        <div class="cd-actions">
          ${sheetCtaHtml(c)}
          <button type="button" class="btn btn-outline" onclick="reassignClientUnit('${esc(c.id)}')">↔️ Unit</button>
          ${c.status === 'aktif'
            ? `<button type="button" class="btn btn-danger" onclick="revokeClientLicense('${esc(c.id)}')">🚫 Cabut Lisensi</button>`
            : `<button type="button" class="btn btn-primary" onclick="restoreClientLicense('${esc(c.id)}')">🟢 Aktifkan Lisensi</button>`}
        </div>
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
      } finally { el.textContent = '🧾 Lihat Bukti'; }
    });
  });
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
    return [c.nama_usaha, c.nama_warung, c.nama_pemilik, c.device_code, c.no_whatsapp, c.kabkota, c.provinsi]
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
