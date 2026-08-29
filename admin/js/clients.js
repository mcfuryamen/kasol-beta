/**
 * Admin Marketing KASIRSOLO — Clients Module (CRM)
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
import { updateSidebarBadges } from './navigation.js?v=20260812i';

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

const DAYS = 30 * 24 * 60 * 60 * 1000;
const isActive = (c) => c.last_seen && (Date.now() - new Date(c.last_seen).getTime()) < DAYS;

/** Init module — pipeline tunggal dari tabel `clients` */
export async function initClients() {
  document.getElementById('clientsSearch')?.addEventListener('input', renderAll);
  document.getElementById('clientsAppFilter')?.addEventListener('change', renderAll);

  window.addEventListener('screen:change', (e) => {
    if (e.detail?.screen === 'klien') { loadClients(); }
  });

  // Harga (STATE.catalog) bisa datang SETELAH klien selesai dimuat (race saat
  // boot) — render ulang begitu katalog tiba supaya revenue tidak menampilkan Rp0.
  subscribe('catalog', () => renderAll());

  await loadClients();
}

/** View mode saat ini: 'analitik' | 'kelola' */
let clientView = 'analitik';
function switchClientView(view) {
  // Guard: skip kalau view tidak berubah — mencegah render dobel saat
  // switchClientView terpanggil dari beberapa jalur sekaligus.
  if (clientView === view) return;
  clientView = view;
  const anEl = document.getElementById('analyticsView');
  const kanEl = document.getElementById('kanbanView');
  if (anEl) anEl.hidden = view !== 'analitik';
  if (kanEl) kanEl.hidden = view !== 'kelola';
  if (view === 'kelola') renderKanban();
  else renderAnalytics();
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

/** Aksen kartu mengikuti konteks status */
function statusAccent(status) {
  return 'kb-acc-' + stageMeta(status).tone;
}

/** Baris konteks status pada kartu */
function statusCtxHtml(c, esc) {
  const sm = stageMeta(c.status);
  const on = isActive(c);
  switch (c.status) {
    case 'baru': return `<span class="kb-card-ctx">🆕 Lead baru — belum dihubungi</span>`;
    case 'dihubungi': return `<span class="kb-card-ctx">📞 Sudah dihubungi</span>`;
    case 'tertarik': return `<span class="kb-card-ctx">💡 Tertarik — siap ditawarkan</span>`;
    case 'menunggu_verifikasi':
      return c.bukti_url
        ? `<span class="kb-bukti" data-bukti="${esc(c.bukti_url)}">🧾 Lihat Bukti</span>`
        : `<span class="kb-card-ctx">⏳ Menunggu verifikasi</span>`;
    case 'aktif':
      return `<span class="kb-card-ctx ${on ? 'on' : 'off'}">${on ? '🟢 Online' : '⚪ Offline'}${c.serial ? ' · 🔑 ' + esc(String(c.serial).slice(0, 10)) + '…' : ''}</span>`;
    case 'batal': return `<span class="kb-card-ctx">❌ Batal — lisensi nonaktif</span>`;
    default: return `<span class="kb-card-ctx">${esc(sm.label)}</span>`;
  }
}

/** Tombol utama kartu, berubah sesuai konteks status */
function statusCta(c, esc) {
  const id = esc(c.id);
  // Buka akordeon kartu (detail sekarang langsung tampil tanpa sub-akordeon)
  const open = `event?.stopPropagation(); toggleCardDetail(this.closest('.kanban-card').querySelector('.kb-head'));`;
  switch (c.status) {
    case 'baru': return `<button type="button" class="btn btn-primary btn-sm" onclick="moveStage('${id}','next')">📞 Hubungi</button>`;
    case 'dihubungi': return `<button type="button" class="btn btn-primary btn-sm" onclick="moveStage('${id}','next')">💡 Tawarkan</button>`;
    case 'tertarik': return `<button type="button" class="btn btn-primary btn-sm" onclick="moveStage('${id}','next')">⏳ Minta Verifikasi</button>`;
    case 'menunggu_verifikasi': return `<button type="button" class="btn btn-primary btn-sm" onclick="${open}">🔍 Verifikasi</button>`;
    case 'aktif': return ''; // aksi lisensi ditangani tombol Cabut di header
    case 'batal': return `<button type="button" class="btn btn-outline btn-sm" onclick="${open}">↩️ Pulihkan</button>`;
    default: return `<button type="button" class="btn btn-outline btn-sm" onclick="${open}">Buka</button>`;
  }
}

/** Update status pipeline klien (prev/next tab status) */
async function updateClientStatus(id, status) {
  const prev = clients.find((c) => c.id === id);
  if (!prev) return;
  clients = clients.map((c) => c.id === id ? { ...c, status } : c);

  if (clientView === 'kelola') renderKanban(); else renderAnalytics();
  updateSidebarBadges({ clients: clients.length });

  try {
    const res = await supabaseFetch(`/rest/v1/clients?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      data: { status },
      headers: { Prefer: 'return=representation' }
    });
    if (!res.ok) throw new Error('Failed to update status');
    showToast(`Status → ${stageMeta(status).label.slice(2)}`, 1800, 'success');
  } catch (e) {
    clients = clients.map((c) => c.id === id ? prev : c);
    if (clientView === 'kelola') renderKanban(); else renderAnalytics();
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
  if (clientView === 'kelola') renderKanban(); else renderAnalytics();

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
    if (clientView === 'kelola') renderKanban(); else renderAnalytics();
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
  if (clientView === 'kelola') renderKanban(); else renderAnalytics();

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
    if (clientView === 'kelola') renderKanban(); else renderAnalytics();

    showToast(`✅ Lisensi aktif • ${prefix}-${serial.slice(-13)}`, 3000, 'success');
  } catch (e) {
    // Rollback
    clients = clients.map((x) => x.id === id ? prev : x);
    if (clientView === 'kelola') renderKanban(); else renderAnalytics();
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
  if (clientView === 'kelola') renderKanban(); else renderAnalytics();

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
    if (clientView === 'kelola') renderKanban(); else renderAnalytics();
    console.error('[reassignClientUnit]', e);
    showToast('Gagal reassign unit', 2500, 'error');
  }
}

window.revokeClientLicense = revokeClientLicense;
window.restoreClientLicense = restoreClientLicense;
window.reassignClientUnit = reassignClientUnit;

/** Render all (stats + view aktif) */
// --- Ikon helper utk info perangkat klien ---
const DEVICE_ICON = { mobile: '📱', tablet: '📟', desktop: '🖥️' };
const OS_ICON = { Android: '🤖', iOS: '🍎', Windows: '🪟', macOS: '🍏', Linux: '🐧' };
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
  if (clientView === 'kelola') renderKanban();
  else renderAnalytics();
}

/** Tab kanban aktif: 'semua' | stage key */
let kanbanTab = 'semua';

/** Render kanban Tab-per-Status (bukan board kolom) */
function renderKanban() {
  const host = document.getElementById('kanbanBoard');
  if (!host) return;
  host.hidden = false; // pastikan board tampil (bisa ke-set true oleh flow openClient)
  const q = (document.getElementById('clientsSearch')?.value || '').toLowerCase();
  const qNorm = (c) => [c.nama_usaha, c.nama_warung, c.nama_pemilik, c.device_code, c.no_whatsapp, c.email, c.kabkota, c.provinsi, c.unit_id, c.serial]
    .some((v) => (v || '').toLowerCase().includes(q));
  const appF = document.getElementById('clientsAppFilter')?.value || '';
  const rows = clients.filter((c) => {
    if (appF && c.app_type !== appF) return false;
    return q ? qNorm(c) : true;
  });

  if (!clients.length) {
    host.innerHTML = `<div class="empty-state">Belum ada klien. Data otomatis muncul di sini saat aplikasi klien pertama kali terhubung.</div>`;
    return;
  }

  const tab = (key, label, n, tone) => `
    <button type="button" class="kb-tab ${kanbanTab === key ? 'active' : ''}" data-stage="${key}" role="tab" aria-selected="${kanbanTab === key}">
      ${label} <span class="badge ${tone}">${n}</span>
    </button>`;

  const tabs = `
    <div class="kb-tabs" role="tablist">
      ${tab('semua', 'Semua', rows.length, 'gray')}
      ${PIPELINE_STAGES.map((st) => tab(st.key, st.label, rows.filter((c) => c.status === st.key).length, st.tone)).join('')}
    </div>`;

  const shown = kanbanTab === 'semua' ? rows : rows.filter((c) => c.status === kanbanTab);
  const shownMeta = kanbanTab === 'semua' ? null : stageMeta(kanbanTab);
  const productPrices = STATE.catalog || [];
  const priceForClient = (c) => Number(productPrices.find((p) => p.appType === c.app_type)?.price) || 0;
  const subtotal = shown.reduce((a, c) => a + priceForClient(c), 0);

  const cards = shown.length
    ? shown.map(kanbanCardHtml).join('')
    : `<div class="kb-drop-hint">Belum ada kartu di ${shownMeta ? shownMeta.label : 'filter ini'}. Ubah status lewat detail.</div>`;

  host.innerHTML = tabs + `
    <div class="kb-tab-panel">
      <div class="kb-tab-head">
        <span class="kb-tab-title">${shownMeta ? shownMeta.label : 'Semua Klien'}</span>
        <span class="kb-tab-total">${shown.length} kartu${subtotal ? ' · Rp ' + subtotal.toLocaleString('id-ID') : ''}</span>
      </div>
      <div class="kb-tab-list">${cards}</div>
    </div>`;

  host.querySelectorAll('.kb-tab').forEach((t) => {
    t.addEventListener('click', () => { kanbanTab = t.dataset.stage; renderKanban(); });
  });
  host.querySelectorAll('.kb-bukti').forEach((el) => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
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
  // Klik kartu = buka akordeon detail (tombol/menu/head di dalam kartu diabaikan)
  host.querySelectorAll('.kanban-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('.kb-card-menu-pop') || e.target.closest('.kb-head')) return;
      const head = card.querySelector('.kb-head');
      if (head && !card.querySelector('.kb-detail')?.classList.contains('open')) {
        toggleCardDetail(head);
      }
    });
  });
  host.querySelectorAll('.kb-menu-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); toggleKbMenu(btn); });
  });
  // one-time: tutup semua popup menu saat klik di luar
  if (!window.__kbMenuCloseBound) {
    window.__kbMenuCloseBound = true;
    document.addEventListener('click', () => {
      document.querySelectorAll('.kb-card-menu-pop.open').forEach((p) => p.classList.remove('open'));
    });
  }
    maybeOpenPending();
  }

  /** Toggle popup menu aksi kartu */
function toggleKbMenu(btn) {
  const card = btn.closest('.kanban-card');
  if (!card) return;
  const all = card.querySelectorAll('.kb-card-menu-pop');
  all.forEach((p) => p.classList.toggle('open'));
  // posisikan pop (jangan keluar viewport)
  const pop = card.querySelector('.kb-card-menu-pop');
  if (pop && pop.classList.contains('open')) {
    const r = pop.getBoundingClientRect();
    if (r.right > window.innerWidth) pop.style.right = '0'; else pop.style.right = '';
  }
}
window.toggleKbMenu = toggleKbMenu;

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
    showToast('Penghitung transaksi direset — kuota segar', 2200, 'success');
  } catch (err) {
    console.error(err);
    showToast('Gagal reset penghitung', 2200, 'error');
  }
};

function kanbanCardHtml(c) {
  const m = metaFor(c.app_type);
  const esc = escapeHtml;
  const wil = [c.desa, c.kecamatan, c.kabkota].filter(Boolean).join(', ');
  const idx = PIPELINE_STAGES.findIndex((s) => s.key === c.status);
  const isBatal = c.status === 'batal';
  const harga = Number(catalogProductFor(c.app_type)?.price) || 0;
  const lic = (c.license_status || '').toLowerCase();
  // Progress posisi di pipeline (persen dari urutan stage)
  const progressPct = idx >= 0 ? Math.round(((idx + 0.5) / PIPELINE_STAGES.length) * 100) : 0;

  // Info lisensi / verifikasi (muncul hanya bila tersedia)
  const licLine = [];
  if (lic === 'aktif' || lic === 'active') licLine.push('<span class="kb-lic on">✓ Lisensi Aktif</span>');
  else if (c.activated_at) licLine.push('<span class="kb-lic">✓ Diaktifkan ' + esc(formatDate(c.activated_at)) + '</span>');
  if (c.verified_at) licLine.push('<span class="kb-lic">🔎 Verifikasi ' + esc(formatDate(c.verified_at)) + '</span>');
  const licHtml = licLine.length ? `<div class="kb-card-lic">${licLine.join('')}</div>` : '';

  // Prefix ID unik per kartu agar input/tombol tidak bentrok antar kartu
  const u = 'kc' + Math.random().toString(36).slice(2, 8);

  return `
    <div class="kanban-card ${statusAccent(c.status)}${isBatal ? ' kb-card-batal' : ''}" data-client-id="${esc(c.id)}">
      <div class="kb-progress" style="width:${progressPct}%"></div>
      <div class="kb-head" role="button" tabindex="0" aria-expanded="false" onclick="toggleCardDetail(this)">
        <span class="client-avatar">${m.icon}</span>
        <div class="kb-title">
          <strong class="kb-card-name">${esc(c.nama_usaha || c.nama_warung || '—')}</strong>
          <span class="kb-card-sub">${esc(m.label)}${m.kodeProduk ? ' · ' + esc(m.kodeProduk) : ''}${c.device_code ? ' · ' + esc(c.device_code) : ''}</span>
          ${statusCtxHtml(c, esc)}
        </div>
        <div class="kb-head-btn">${statusCta(c, esc)}</div>
        <div class="kb-head-btn kb-lic-btn">
          <button type="button" class="btn btn-outline btn-sm" title="Reassign unit_id (pindah perangkat)" onclick="event.stopPropagation();reassignClientUnit('${esc(c.id)}')">↔️ Unit</button>
          ${c.status === 'aktif'
            ? `<button type="button" class="btn btn-danger btn-sm" onclick="event.stopPropagation();revokeClientLicense('${esc(c.id)}')">🚫 Cabut</button>`
            : `<button type="button" class="btn btn-primary btn-sm" onclick="event.stopPropagation();restoreClientLicense('${esc(c.id)}')">🟢 Aktifkan</button>`}
        </div>
        <span class="kb-chev">▾</span>
      </div>
      <div class="kb-detail">
            <div class="kb-detail-inner">
              <!-- Grid info klien: label di atas, isi di bawah -->
              <div class="kb-info">
                <div class="kb-info-r"><span class="kb-info-l">Pemilik</span><span class="kb-info-v">${esc(c.nama_pemilik || '—')}</span></div>
                <div class="kb-info-r"><span class="kb-info-l">Kontak</span><span class="kb-info-v">${esc(normalizePhone(c.no_whatsapp) || c.email || '—')}</span></div>
                <div class="kb-info-r"><span class="kb-info-l">Lokasi</span><span class="kb-info-v">${esc([c.desa, c.kecamatan, c.kabkota].filter(Boolean).join(', ') || c.kabkota || '—')}</span></div>
                ${c.unit_id !== undefined && c.unit_id !== null && c.unit_id !== '' ? `<div class="kb-info-r"><span class="kb-info-l">Unit ID</span><span class="kb-info-v mono">${esc(c.unit_id)}</span></div>` : ''}
                <div class="kb-info-r"><span class="kb-info-l">Aplikasi</span><span class="kb-info-v">${esc(m.label)}${m.kodeProduk ? ' · ' + esc(m.kodeProduk) : ''}</span></div>
                <div class="kb-info-r"><span class="kb-info-l">Device Code</span><span class="kb-info-v mono">${esc(c.device_code || '—')}</span></div>
                ${c.device_type || c.browser ? `<div class="kb-info-r"><span class="kb-info-l">Perangkat</span><span class="kb-info-v">${deviceInfoHtml(c, esc)}</span></div>` : ''}
                <div class="kb-info-r"><span class="kb-info-l">Nama Usaha</span><span class="kb-info-v">${esc(c.nama_usaha || c.nama_warung || '—')}</span></div>
                ${harga ? `<div class="kb-info-r"><span class="kb-info-l">Harga Deal</span><span class="kb-info-v">Rp ${harga.toLocaleString('id-ID')}</span></div>` : ''}
                <div class="kb-info-r"><span class="kb-info-l">Dilihat</span><span class="kb-info-v">${formatRelativeTime(c.last_seen)}</span></div>
                <div class="kb-info-r"><span class="kb-info-l">Kuota Gratis</span><span class="kb-info-v">${txInfoHtml(c)}</span></div>
              </div>

              ${licHtml}
              <div class="kb-card-lic" style="margin-top:8px;flex-wrap:wrap;gap:6px">
                <span style="font-size:12px;color:var(--text2)">🎁 Kuota:</span>
                <button type="button" class="btn btn-outline btn-sm" onclick="event.stopPropagation();adjustTxQuota('${esc(c.id)}', -10)">−10</button>
                <button type="button" class="btn btn-outline btn-sm" onclick="event.stopPropagation();adjustTxQuota('${esc(c.id)}', 10)">+10</button>
                <button type="button" class="btn btn-outline btn-sm" onclick="event.stopPropagation();adjustTxQuota('${esc(c.id)}', 50)">+50</button>
                <button type="button" class="btn btn-outline btn-sm" onclick="event.stopPropagation();resetTxUsage('${esc(c.id)}')">↺ Reset Pakai</button>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>`;
}

/** Toggle akordeon detail kartu kanban */
window.toggleCardDetail = function (headEl) {
  const card = headEl.closest('.kanban-card');
  if (!card) return;
  const detail = card.querySelector('.kb-detail');
  if (!detail) return;
  const isOpen = detail.classList.toggle('open');
  card.classList.toggle('expanded', isOpen);
  headEl.setAttribute('aria-expanded', String(isOpen));
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

/** Open client accordion dari dashboard: pindah ke view Kelola + buka akordeon kartu tsb */
let pendingOpenId = null;
window.openClientAccordion = async function (id) {
  pendingOpenId = id;
  try { if (window.showScreen) window.showScreen('klien', 'kelola'); } catch { try { window.showScreen('klien'); } catch {} }
  // tunggu semua load asinkron (coalesced) selesai supaya render final punya kartu terbaru
  await loadClients();
  // set ulang pending SETELAH render asinkron, lalu render sekali lagi agar terbuka & ter-scroll
  pendingOpenId = id;
  if (typeof renderKanban === 'function') renderKanban();
  openPendingCard();
};

/** Buka kartu pendingOpenId setelah DOM dirender (dipanggil dari renderKanban) */
function maybeOpenPending() {
  if (!pendingOpenId) return;
  const id = pendingOpenId;
  const card = document.querySelector(`.kanban-card[data-client-id="${CSS.escape(id)}"]`);
  if (!card) return; // kartu belum ada — tetap pending, akan coba lagi setelah load asinkron
  pendingOpenId = null;
  // pastikan tab "Semua" / tab berisi kartu tsb
  kanbanTab = 'semua';
  const head = card.querySelector('.kb-head');
  if (head && !card.querySelector('.kb-detail')?.classList.contains('open')) toggleCardDetail(head);
  requestAnimationFrame(() => card.scrollIntoView({ block: 'center', behavior: 'smooth' }));
}
function openPendingCard() {
  maybeOpenPending();
}

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
    updateSidebarBadges({ clients: clients.length });
    setState('clients', clients);
  })();
  loadClients._inflight = p;
  try { return await p; } finally { loadClients._inflight = null; }
}
window.refreshClients = loadClients;

/** Render dashboard analitik khusus klien (view "Analitik") */
function renderAnalytics() {
  const host = document.getElementById('analyticsBody');
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
    host.innerHTML = `<div class="empty-state"><div class="empty-ic">📊</div><div class="empty-t">Belum ada data klien</div><div class="empty-d">Data analitik muncul saat klien pertama kali terhubung.</div></div>`;
    return;
  }

  const total = rows.length;
  const active = rows.filter(isActive).length;
  const aktifDeal = rows.filter((c) => c.status === 'aktif').length;
  const priceForClient = (c) => Number((STATE.catalog || []).find((p) => p.appType === c.app_type)?.price) || 0;
  const potensi = rows.reduce((a, c) => a + priceForClient(c), 0);

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
      <span class="bar-label">${s.label}</span>
      <div class="bar-track"><div class="bar-fill tone-${s.tone}" style="width:${(s.n / maxStage) * 100}%"></div></div>
      <span class="bar-num">${s.n}</span>
    </div>`).join('') || `<div class="text-xs" style="color:var(--text2)">Belum ada klien di pipeline ini.</div>`;

  const barApp = perApp.map((x) => `
    <div class="bar-row">
      <span class="bar-label">${x.icon} ${escapeHtml(x.label)}</span>
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
    <div class="stat-grid" style="margin-bottom:var(--s5)">
      <div class="stat-card"><div class="stat-label">👥 Total Klien</div><div class="stat-value">${total}</div></div>
      <div class="stat-card"><div class="stat-label">✅ Aktif / Deal</div><div class="stat-value green">${aktifDeal}</div></div>
      <div class="stat-card"><div class="stat-label">🟢 Aktif 30 Hari</div><div class="stat-value green">${active}</div></div>
      <div class="stat-card"><div class="stat-label">💰 Potensial Revenue</div><div class="stat-value orange">Rp ${potensi.toLocaleString('id-ID')}</div></div>
    </div>

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
