/**
 * Control Center Kasir Solo — Catalog Module
 * CRUD for application catalog via Supabase (syncs to landing page)
 * Rosok-style: grid cards + flip page editor (daftar diganti halaman edit)
 */

import { STATE, subscribe, setState } from './app-state.js';
import { formatRupiah, escapeHtml } from './utils.js';
import { showToast } from './toast.js';
import { supabaseFetch } from './api.js';
import { updateSidebarBadges } from './navigation.js?v=20260911c';
import { icon, appIcon } from './icons.js';

let catalogGrid = null;
let catalogEmpty = null;
let catalogTableBody = null;

/**
 * Fetch products from Supabase
 */
async function fetchProductsFromSupabase() {
  try {
    const res = await supabaseFetch('/rest/v1/products?select=id,kode_produk,app_type,icon,name,description,price_label,price_before_label,order_index,visible,status,store_url,vercel_url,tx_quota&order=order_index.asc');
    if (!res.ok) {
      console.error('Supabase fetch failed:', res.status, res.text);
      return [];
    }

    const products = res.data || [];

    // Transform Supabase products → admin catalog format
    return products.map(p => ({
      id: p.id,
      appType: p.app_type,
      kodeProduk: p.kode_produk || '',
      icon: p.icon || '📦',
      name: p.name,
      desc: p.description || '',
      price: parseInt(p.price_label?.replace(/\D/g, '') || '0', 10),
      priceBefore: parseInt(p.price_before_label?.replace(/\D/g, '') || '0', 10),
      category: getCategoryFromAppType(p.app_type),
      hot: p.order_index === 0,
      orderIndex: p.order_index,
          visible: p.visible,
          status: p.status || '',
          storeUrl: p.store_url || '',
          vercelUrl: p.vercel_url || '',
          txQuota: p.tx_quota || null
        }));
  } catch (error) {
    console.error('Error fetching products from Supabase:', error);
    return [];
  }
}

/**
 * Map app_type to category (heuristic)
 */
function getCategoryFromAppType(appType) {
  const businessTypes = ['retail', 'rosok', 'gerobak', 'kaki5', 'konveksi', 'bengkel'];
  const healthTypes = ['klinik', 'apotek'];
  if (businessTypes.includes(appType)) return 'bisnis';
  if (healthTypes.includes(appType)) return 'kesehatan';
  return 'institusi';
}

/**
 * Initialize catalog module
 */
export async function initCatalog() {
  catalogGrid = document.getElementById('catalogList');
  catalogEmpty = document.getElementById('catalogEmpty');
  catalogTableBody = document.getElementById('catalogTableBody');

  if (!catalogGrid) return;

  // Load catalog from Supabase
  const products = await fetchProductsFromSupabase();
  setState('catalog', products);

    // Update sidebar badge count
    updateSidebarBadges({ catalog: products.length });

  // Subscribe to catalog changes
  subscribe('catalog', renderCatalog);

  // Initial render
  renderCatalog();

  // Tab katalog: software | hardware | layanan
  document.querySelectorAll('#catalogTabs .content-tab').forEach((btn) => {
    btn.addEventListener('click', () => switchCatalogTab(btn.dataset.ctab));
  });

  // Hardware & layanan dimuat paralel (koleksi site_content — Supabase)
  await Promise.all([loadHw(), loadSvc()]);

  console.log('✅ Catalog loaded from Supabase:', products.length, 'products');
}

window.refreshCatalog = async function () {
  const products = await fetchProductsFromSupabase();
  if (!catalogGrid) return;
  setState('catalog', products);
  updateSidebarBadges({ catalog: products.length });
  showToast('Katalog diperbarui', 2000, 'success');
};

/**
 * Render katalog: TABEL padat di desktop, KARTU di mobile (dua DOM, CSS yang pilih).
 */
export function renderCatalog() {
  if (!catalogGrid || !catalogEmpty) return;

  const apps = STATE.catalog || [];

  if (apps.length === 0) {
    catalogGrid.innerHTML = '';
    if (catalogTableBody) catalogTableBody.innerHTML = '';
    catalogEmpty.hidden = false;
    return;
  }

  catalogEmpty.hidden = true;

  // ── Tabel (desktop) ──
  if (catalogTableBody) {
    catalogTableBody.innerHTML = apps.map((app, idx) => `
      <tr data-idx="${idx}" data-id="${escapeHtml(app.id)}">
        <td><div class="ct-icon">${appIcon(app.appType, 16)}</div></td>
        <td>
          <div class="ct-name">${escapeHtml(app.name || 'Aplikasi Baru')}${app.hot ? ' <span class="hot-badge" style="font-size:9px;padding:2px 6px;vertical-align:2px">HOT</span>' : ''}</div>
          <div class="ct-kode">${escapeHtml(app.kodeProduk || app.appType || '—')}</div>
        </td>
        <td><span class="tag-pill">${getCategoryLabel(app.category)}</span></td>
        <td class="ct-price">${app.priceBefore > app.price ? `<s>${formatRupiah(app.priceBefore)}</s>` : ''}${formatRupiah(app.price || 0)}</td>
        <td class="ct-quota">${app.txQuota ? `${icon('gift', 12)} ${escapeHtml(String(app.txQuota))}/bln` : '—'}</td>
        <td>${statusChip(app)}</td>
        <td>${domainCell(app)}</td>
        <td class="ct-actions">
          <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); openCatalogPage(${idx})" aria-label="Edit ${escapeHtml(app.name || '')}" title="Edit">${icon('pencil', 14)}</button>
          <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteCatalogApp(${idx})" aria-label="Hapus ${escapeHtml(app.name || '')}" title="Hapus">${icon('trash', 14)}</button>
        </td>
      </tr>`).join('');
    catalogTableBody.querySelectorAll('tr').forEach(tr => {
      tr.style.cursor = 'pointer';
      tr.addEventListener('click', () => openCatalogPage(parseInt(tr.dataset.idx)));
    });
  }

  // ── Kartu (mobile) ──
  catalogGrid.innerHTML = apps.map((app, idx) => `
    <article class="catalog-card" data-idx="${idx}" data-id="${escapeHtml(app.id)}">
      <div class="catalog-card-cover">${appIcon(app.appType, 30)}</div>
      <div class="catalog-card-title">${escapeHtml(app.name || 'Aplikasi Baru')}</div>
      <div class="catalog-card-desc">${escapeHtml(app.desc || '')}</div>
      <div class="catalog-card-meta">${escapeHtml(app.kodeProduk || app.appType || '—')} · ${formatRupiah(app.price || 0)}</div>
      ${app.txQuota ? `<div class="catalog-card-meta" style="color:#15803d;font-weight:600">Kuota gratis: ${escapeHtml(String(app.txQuota))} transaksi/bulan</div>` : ''}
      <div class="catalog-card-category">${getCategoryLabel(app.category)}</div>
      <div class="catalog-card-domain">
        ${app.storeUrl ? `<a href="${escapeHtml(app.storeUrl)}" target="_blank" rel="noopener" class="domain-chip ${statusChipClass(app)}">${statusChipLabel(app)}</a>` : statusChip(app)}
        ${app.vercelUrl && !app.storeUrl ? `<a href="${escapeHtml(app.vercelUrl)}" target="_blank" rel="noopener" class="domain-chip domain-vercel">▲ Vercel</a>` : ''}
      </div>
      ${app.hot ? '<span class="catalog-card-hot">HOT</span>' : ''}
      <div class="catalog-card-actions">
        <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); openCatalogPage(${idx})">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteCatalogApp(${idx})">Hapus</button>
      </div>
    </article>
  `).join('');

  // Bind click events for editing
  catalogGrid.querySelectorAll('.catalog-card').forEach(card => {
    card.addEventListener('click', () => {
      const idx = parseInt(card.dataset.idx);
      openCatalogPage(idx);
    });
  });
}

/** Sel domain di tabel: chip status + link vercel (hemat ruang) */
function domainCell(app) {
  const bits = [];
  if (app.storeUrl) bits.push(`<a href="${escapeHtml(app.storeUrl)}" target="_blank" rel="noopener" class="domain-chip ${statusChipClass(app)}" title="${escapeHtml(app.storeUrl)}">store ↗</a>`);
  if (app.vercelUrl) bits.push(`<a href="${escapeHtml(app.vercelUrl)}" target="_blank" rel="noopener" class="domain-chip domain-vercel" title="${escapeHtml(app.vercelUrl)}">vercel ↗</a>`);
  return bits.join(' ') || '<span class="cell-sub">—</span>';
}

/**
 * Get category label (tanpa emoji — audit ui-ux)
 */
function getCategoryLabel(category) {
  const labels = {
    'bisnis': 'Bisnis',
    'institusi': 'Institusi',
    'kesehatan': 'Kesehatan'
  };
  return labels[category] || category;
}

/**
 * Resolve status final dari kartu produk. Logika saling terhubung:
 *  - Semua link (live & vercel) kosong → development (fallback otomatis)
 *  - Status 'live' / auto-derive       → live jika store_url ada, ready bila cuma vercel
 *  - Status 'ready' / 'maintenance'    → dipertahankan selama ada link
 */
function resolveProductStatus(app) {
  const hasLive = !!app.storeUrl;
  const hasVer = !!app.vercelUrl;
  if (!hasLive && !hasVer) return 'development';
  const s = (app.status || '').toLowerCase();
  if (s === 'maintenance') return 'maintenance';
  if (s === 'development') return 'development';
  if (s === 'ready') return 'ready';
  return hasLive ? 'live' : 'ready';
}

function statusChip(app) {
  const s = resolveProductStatus(app);
  const map = {
    live:         { cls: 'domain-live',  label: '● LIVE' },
    ready:        { cls: 'domain-ready', label: '● READY' },
    maintenance:  { cls: 'domain-maint', label: 'MAINTENANCE' },
    development:  { cls: 'domain-none',  label: '◆ DEVELOPMENT' }
  };
  const b = map[s] || map.development;
  return `<span class="domain-chip ${b.cls}">${b.label}</span>`;
}

/** Return CSS class untuk status chip (untuk dipakai di <a>) */
function statusChipClass(app) {
  const s = resolveProductStatus(app);
  const map = { live: 'domain-live', ready: 'domain-ready', maintenance: 'domain-maint', development: 'domain-none' };
  return map[s] || 'domain-none';
}

/** Return label untuk status chip (untuk dipakai di <a>) */
function statusChipLabel(app) {
  const s = resolveProductStatus(app);
  const map = { live: '● LIVE', ready: '● READY', maintenance: 'MAINTENANCE', development: '◆ DEVELOPMENT' };
  return map[s] || '◆ DEVELOPMENT';
}

/* ---- Flip page edit katalog: daftar+tab diganti halaman form ---- */

function flipCatalogEdit(on) {
  const page = document.getElementById('catalogEditPage');
  const tabs = document.getElementById('catalogTabs');
  if (on) {
    ['catViewSoftware', 'catViewHardware', 'catViewLayanan'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.hidden = true;
    });
    if (tabs) tabs.hidden = true;
    if (page) page.hidden = false;
  } else {
    if (page) page.hidden = true;
    if (tabs) tabs.hidden = false;
    // Restore HANYA view tab aktif — kalau ketiganya dibuka sekaligus,
    // FAB tiap tab (position:fixed) jadi bertumpuk di titik yang sama.
    switchCatalogTab(catTab);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/**
 * Halaman edit/tambah aplikasi (flip page — menggantikan daftar)
 */
window.openCatalogPage = function(idx = null) {
  const isEdit = idx !== null;
  const app = isEdit ? (STATE.catalog || [])[idx] : {
    id: null,
    icon: '📦',
    name: '',
    desc: '',
    price: 0,
    priceBefore: 0,
    category: 'bisnis',
    hot: false,
    appType: '',
    kodeProduk: '',
    status: 'development',
    storeUrl: '',
    vercelUrl: '',
    txQuota: '',
    orderIndex: (STATE.catalog || []).length
  };

  const page = document.getElementById('catalogEditPage');
  if (!page) return;

  page.innerHTML = `
    <div class="cd-head">
      <button type="button" class="btn btn-outline btn-sm" onclick="closeCatalogPage()">← Kembali</button>
      <div class="cd-title"><h3>${isEdit ? 'Edit Aplikasi' : 'Tambah Aplikasi'}</h3></div>
    </div>
    <div class="panel">
      <div class="panel-body">
    <div class="field-grid">
      <div class="field">
        <label class="field-label">App Type (ID)</label>
        <input type="text" id="catAppType" value="${escapeHtml(app.appType || '')}" placeholder="rosok" ${isEdit ? 'readonly' : ''}>
      </div>
      <div class="field">
        <label class="field-label">Kode Produk</label>
        <input type="text" id="catKodeProduk" value="${escapeHtml(app.kodeProduk || '')}" placeholder="KSR">
      </div>
      <div class="field">
        <label class="field-label">Ikon Emoji</label>
        <div class="emoji-picker">
          <input type="text" id="catIcon" value="${escapeHtml(app.icon)}" maxlength="4" placeholder="📦" onfocus="showEmojiPicker(this)">
          <div class="emoji-picker-grid" id="emojiPickerGrid" role="listbox" aria-label="Pilih emoji"></div>
        </div>
      </div>
      <div class="field field-span-2">
        <label class="field-label">Nama Aplikasi</label>
        <input type="text" id="catName" value="${escapeHtml(app.name)}" placeholder="Contoh: Kasir Solo">
      </div>
      <div class="field field-span-2">
        <label class="field-label">Deskripsi</label>
        <textarea id="catDesc" rows="3" placeholder="Deskripsi singkat untuk landing page">${escapeHtml(app.desc)}</textarea>
      </div>
      <div class="field">
        <label class="field-label">Kategori</label>
        <select id="catCategory">
          <option value="bisnis" ${app.category === 'bisnis' ? 'selected' : ''}>💼 Bisnis</option>
          <option value="institusi" ${app.category === 'institusi' ? 'selected' : ''}>🏛️ Institusi</option>
          <option value="kesehatan" ${app.category === 'kesehatan' ? 'selected' : ''}>🏥 Kesehatan</option>
        </select>
      </div>
      <div class="field">
        <label class="field-label">Harga</label>
        <input type="number" id="catPrice" value="${app.price || 0}" min="0" step="10000" placeholder="0">
      </div>
      <div class="field">
        <label class="field-label">Harga Coret (opsional — tampil tercoret di aplikasi)</label>
        <input type="number" id="catPriceBefore" value="${app.priceBefore || 0}" min="0" step="10000" placeholder="Harga sebelum diskon">
      </div>
      <div class="field">
        <label class="field-label">
          <input type="checkbox" id="catHot" ${app.hot ? 'checked' : ''}> Hot (tampilkan badge di landing)
        </label>
      </div>
      <div class="field">
        <label class="field-label">Order Index</label>
        <input type="number" id="catOrderIndex" value="${app.orderIndex || 0}" min="0" step="1">
      </div>
            <div class="field field-span-2">
              <label class="field-label">Status Aplikasi</label>
              <select id="catStatus">
                <option value="live" ${app.status === 'live' ? 'selected' : ''}>● Live — rilis resmi</option>
                <option value="ready" ${app.status === 'ready' ? 'selected' : ''}>● Ready — siap dibuka</option>
                <option value="maintenance" ${app.status === 'maintenance' ? 'selected' : ''}>🛠 Maintenance — sedang perbaikan</option>
                <option value="development" ${app.status === 'development' ? 'selected' : ''}>◆ Development — belum rilis</option>
              </select>
              <small class="field-hint">Otomatis jadi "Development" jika Live & Vercel kosong. Pilih "Live" tapi kosong → pakai Vercel (status jadi Ready).</small>
            </div>
            <div class="field field-span-2">
              <label class="field-label">Domain Live (store_url)</label>
              <input type="url" id="catStoreUrl" value="${escapeHtml(app.storeUrl || '')}" placeholder="https://retail.kasirsolo.com">
              <small class="field-hint">Domain resmi aplikasi. Jika kosong → landing menampilkan status "DEVELOPMENT".</small>
            </div>
            <div class="field field-span-2">
              <label class="field-label">Domain Vercel (vercel_url)</label>
              <input type="url" id="catVercelUrl" value="${escapeHtml(app.vercelUrl || '')}" placeholder="https://kasirsolo-retail.vercel.app">
              <small class="field-hint">Domain preview/vercel aplikasi (opsional, untuk akses staging).</small>
            </div>
            <div class="field field-span-2">
              <label class="field-label">🎁 Kuota Transaksi Gratis /bulan (tier gratis POS)</label>
              <input type="number" id="catTxQuota" value="${escapeHtml(app.txQuota ?? '')}" min="0" step="10" placeholder="mis. 100">
              <small class="field-hint">Tier gratis = N transaksi selesai per bulan kalender, tanpa batas waktu. Kosong → default app (100). Diadjust per pelanggan lewat kartu Klien (bonus/reset).</small>
            </div>
          </div>
      </div>
      <div class="cd-actions">
        <button class="btn btn-outline" onclick="closeCatalogPage()">Batal</button>
        <button class="btn btn-primary" onclick="saveCatalogApp(${idx})">${isEdit ? 'Simpan' : 'Tambah'}</button>
      </div>
    </div>
  `;

  flipCatalogEdit(true);

  // Focus first input
  setTimeout(() => document.getElementById('catName')?.focus(), 100);
};

/**
 * Kembali ke daftar katalog
 */
window.closeCatalogPage = function() {
  flipCatalogEdit(false);
};

/**
 * Save catalog app (create or update) → Supabase
 */
window.saveCatalogApp = async function(idx = null) {
  const appType = document.getElementById('catAppType')?.value.trim() || '';
  const kodeProduk = (document.getElementById('catKodeProduk')?.value.trim() || appType).toUpperCase();
  const icon = document.getElementById('catIcon')?.value.trim().slice(0, 4) || '📦';
  const name = document.getElementById('catName')?.value.trim() || 'Aplikasi Baru';
  const desc = document.getElementById('catDesc')?.value.trim() || '';
  const category = document.getElementById('catCategory')?.value || 'bisnis';
  const price = parseInt(document.getElementById('catPrice')?.value) || 0;
  const priceBefore = parseInt(document.getElementById('catPriceBefore')?.value) || 0;
  const hot = document.getElementById('catHot')?.checked || false;
  const orderIndex = parseInt(document.getElementById('catOrderIndex')?.value) || 0;
  const status = document.getElementById('catStatus')?.value || 'development';
  const storeUrl = document.getElementById('catStoreUrl')?.value.trim() || '';
  const vercelUrl = document.getElementById('catVercelUrl')?.value.trim() || '';
  const txQuotaRaw = document.getElementById('catTxQuota')?.value.trim() || '';
  const txQuota = txQuotaRaw ? Math.max(0, parseInt(txQuotaRaw, 10) || 0) : null;

  const isEdit = idx !== null;

  if (!isEdit && !appType) {
    showToast('App Type wajib diisi untuk produk baru', 2000, 'error');
    return;
  }

  const payload = {
    app_type: appType,
    kode_produk: kodeProduk || null,
    name: name,
    tagline: `${name} - Sistem Terbaik`,
    description: desc,
    price_label: `Rp ${price.toLocaleString('id-ID')}`,
    price_before_label: priceBefore > price ? `Rp ${priceBefore.toLocaleString('id-ID')}` : null,
    features: [],
    icon: icon,
    color: '#F5821F',
    order_index: orderIndex,
    visible: true,
    status: status,
    store_url: storeUrl || null,
    vercel_url: vercelUrl || null,
    tx_quota: txQuota
  };

  try {
      let res;
      if (isEdit) {
        // UPDATE
        const app = (STATE.catalog || [])[idx];
        if (!app || !app.id) {
          showToast('Produk tidak ditemukan', 2000, 'error');
          return;
        }

        res = await supabaseFetch(`/rest/v1/products?id=eq.${app.id}`, {
          method: 'PATCH',
          data: payload,
          headers: { 'Prefer': 'return=representation' }
        });
      } else {
        // CREATE
        res = await supabaseFetch('/rest/v1/products', {
          method: 'POST',
          data: payload,
          headers: { 'Prefer': 'return=representation' }
        });
      }

      if (res.ok) {
        // Refresh catalog from Supabase
        const products = await fetchProductsFromSupabase();
        setState('catalog', products);
        showToast(isEdit ? 'Aplikasi diperbarui' : 'Aplikasi ditambahkan', 2000, 'success');
        closeCatalogPage();
      } else {
        console.error('Supabase save failed:', res.status, res.text);
        showToast('Gagal menyimpan ke Supabase', 2000, 'error');
      }
  } catch (error) {
    console.error('Error saving to Supabase:', error);
    showToast('Error: ' + error.message, 2000, 'error');
  }
};

/**
 * Delete catalog app → Supabase
 */
window.deleteCatalogApp = async function(idx) {
  if (!confirm('Hapus aplikasi ini dari katalog?')) return;

  const apps = STATE.catalog || [];
  if (!apps[idx]) return;

  const app = apps[idx];
  const name = app.name;

  try {
      const res = await supabaseFetch(`/rest/v1/products?id=eq.${app.id}`, { method: 'DELETE' });

      if (res.ok || res.status === 204) {
        // Refresh catalog from Supabase
        const products = await fetchProductsFromSupabase();
        setState('catalog', products);
        showToast(`${name} dihapus`, 2000, 'success');
      } else {
        console.error('Supabase delete failed:', res.status, res.text);
        showToast('Gagal menghapus dari Supabase', 2000, 'error');
    }
  } catch (error) {
    console.error('Error deleting from Supabase:', error);
    showToast('Error: ' + error.message, 2000, 'error');
  }
};

/* ==================== TAB: HARDWARE & LAYANAN (site_content) ====================
 * Katalog terpusat di Supabase:
 *  - Software → tabel `products` (CRUD di atas, sinkron landing/shop)
 *  - Hardware → site_content key `hardware` (array) — dikonsumsi halaman /hardware company
 *  - Layanan  → site_content key `services` (array) — dikonsumsi section Jasa Digital company
 * Edit = baca array → ubah → tulis balik satu baris (PATCH/POST key=eq.<key>).
 */

const HW_CATS = [
  { key: 'ANDROID', label: 'POS Android' },
  { key: 'PC', label: 'Desktop PC' },
  { key: 'PERIPHERALS', label: 'Aksesoris' },
];
const hwCatLabel = (k) => (HW_CATS.find((c) => c.key === k) || {}).label || k || '—';

let catTab = 'software';
let hwItems = [];
let svcItems = [];

function switchCatalogTab(tab) {
  catTab = tab;
  document.querySelectorAll('#catalogTabs .content-tab').forEach((b) => {
    const on = b.dataset.ctab === tab;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
  });
  const vSw = document.getElementById('catViewSoftware');
  const vHw = document.getElementById('catViewHardware');
  const vSvc = document.getElementById('catViewLayanan');
  if (vSw) vSw.hidden = tab !== 'software';
  if (vHw) vHw.hidden = tab !== 'hardware';
  if (vSvc) vSvc.hidden = tab !== 'layanan';
  if (tab === 'hardware') renderHw();
  if (tab === 'layanan') renderSvc();
}
window.switchCatalogTab = switchCatalogTab;

/* ---- Helper site_content: baca & tulis satu koleksi ---- */
async function fetchCollection(key) {
  const res = await supabaseFetch(`/rest/v1/site_content?select=key,value&key=eq.${key}`);
  if (!res.ok) throw new Error(`Gagal memuat ${key} (HTTP ${res.status})`);
  return (res.data || [])[0]?.value ?? null;
}

async function writeCollection(key, value) {
  const check = await supabaseFetch(`/rest/v1/site_content?select=key&key=eq.${key}`);
  if (!check.ok) throw new Error(`Gagal cek baris ${key} (HTTP ${check.status})`);
  if ((check.data || []).length) {
    const up = await supabaseFetch(`/rest/v1/site_content?key=eq.${key}`, {
      method: 'PATCH',
      data: { value },
      headers: { Prefer: 'return=representation' }
    });
    if (!up.ok) throw new Error(`Gagal menyimpan ${key} (HTTP ${up.status})`);
  } else {
    const ins = await supabaseFetch('/rest/v1/site_content', {
      method: 'POST',
      data: { key, value },
      headers: { Prefer: 'return=representation' }
    });
    if (!ins.ok) throw new Error(`Gagal membuat baris ${key} (HTTP ${ins.status})`);
  }
}

/* ==================== TAB HARDWARE ==================== */

async function loadHw() {
  try {
    const v = await fetchCollection('hardware');
    hwItems = Array.isArray(v) ? v : [];
  } catch (e) {
    console.error(e);
    hwItems = [];
    showToast('Gagal memuat hardware dari Supabase', 2500, 'error');
  }
  if (catTab === 'hardware') renderHw();
}
window.refreshHw = loadHw;

function renderHw() {
  const tbody = document.getElementById('hwTableBody');
  const grid = document.getElementById('hwCardList');
  const empty = document.getElementById('hwEmpty');
  if (!tbody || !grid || !empty) return;

  if (!hwItems.length) {
    tbody.innerHTML = '';
    grid.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  // ── Tabel (desktop) ──
  tbody.innerHTML = hwItems.map((p, i) => `
    <tr data-idx="${i}" data-id="${escapeHtml(String(p.id))}">
      <td><img class="hw-admin-thumb" src="${escapeHtml(p.image || '')}" alt="" loading="lazy" onerror="this.style.opacity=.15"></td>
      <td>
        <div class="ct-name">${escapeHtml(p.name || '—')}</div>
        <div class="ct-kode">${escapeHtml(p.weight || '—')}${p.dimensions ? ' · ' + escapeHtml(p.dimensions) : ''}</div>
      </td>
      <td><span class="tag-pill">${escapeHtml(hwCatLabel(p.category))}</span></td>
      <td class="ct-price">${formatRupiah(p.price || 0)}</td>
      <td>${p.tag ? `<span class="hot-badge">${escapeHtml(p.tag)}</span>` : '<span class="cell-sub">—</span>'}</td>
      <td class="ct-actions">
        <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); openHwPage(${i})" aria-label="Edit ${escapeHtml(p.name || '')}" title="Edit">${icon('pencil', 14)}</button>
        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteHw(${i})" aria-label="Hapus ${escapeHtml(p.name || '')}" title="Hapus">${icon('trash', 14)}</button>
      </td>
    </tr>`).join('');
  tbody.querySelectorAll('tr').forEach((tr) => {
    tr.style.cursor = 'pointer';
    tr.addEventListener('click', () => openHwPage(parseInt(tr.dataset.idx)));
  });

  // ── Kartu (mobile) ──
  grid.innerHTML = hwItems.map((p, i) => `
    <article class="catalog-card" data-idx="${i}">
      <div class="catalog-card-cover">${p.image ? `<img src="${escapeHtml(p.image)}" alt="" loading="lazy">` : '📦'}</div>
      <div class="catalog-card-title">${escapeHtml(p.name || '—')}</div>
      <div class="catalog-card-desc">${escapeHtml(p.desc || '')}</div>
      <div class="catalog-card-meta">${escapeHtml(hwCatLabel(p.category))} · ${formatRupiah(p.price || 0)}</div>
      ${p.tag ? `<div class="catalog-card-category"><span class="hot-badge">${escapeHtml(p.tag)}</span></div>` : ''}
      <div class="catalog-card-actions">
        <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); openHwPage(${i})">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteHw(${i})">Hapus</button>
      </div>
    </article>`).join('');
  grid.querySelectorAll('.catalog-card').forEach((card) => {
    card.addEventListener('click', () => openHwPage(parseInt(card.dataset.idx)));
  });
}

const linesToList = (s) => String(s || '').split('\n').map((x) => x.trim()).filter(Boolean);

window.openHwPage = function (idx = null) {
  const isEdit = idx !== null;
  const p = isEdit ? hwItems[idx] : null;
  const nextId = isEdit ? p.id : Math.max(0, ...hwItems.map((x) => Number(x.id) || 0)) + 1;
  const page = document.getElementById('catalogEditPage');
  if (!page) return;

  page.innerHTML = `
    <div class="cd-head">
      <button type="button" class="btn btn-outline btn-sm" onclick="closeHwPage()">← Kembali</button>
      <div class="cd-title"><h3>${isEdit ? 'Edit Hardware' : 'Tambah Hardware'}</h3></div>
    </div>
    <div class="panel">
      <div class="panel-body">
    <div class="field-grid">
      <div class="field">
        <label class="field-label">ID</label>
        <input type="number" id="hwId" value="${Number(nextId)}" readonly>
      </div>
      <div class="field">
        <label class="field-label">Kategori</label>
        <select id="hwCat">
          ${HW_CATS.map((c) => `<option value="${c.key}" ${p?.category === c.key ? 'selected' : ''}>${c.label}</option>`).join('')}
        </select>
      </div>
      <div class="field field-span-2">
        <label class="field-label">Nama Produk</label>
        <input id="hwName" value="${escapeHtml(p?.name || '')}" placeholder="MKS Fighter V1">
      </div>
      <div class="field">
        <label class="field-label">Harga (Rp)</label>
        <input type="number" id="hwPrice" value="${p?.price ?? 0}" min="0" step="50000" placeholder="3500000">
      </div>
      <div class="field">
        <label class="field-label">Tag (opsional)</label>
        <input id="hwTag" value="${escapeHtml(p?.tag || '')}" placeholder="BEST SELLER">
      </div>
      <div class="field field-span-2">
        <label class="field-label">Deskripsi singkat</label>
        <textarea id="hwDesc" rows="2" placeholder="Satu-dua kalimat untuk kartu produk">${escapeHtml(p?.desc || '')}</textarea>
      </div>
      <div class="field field-span-2">
        <label class="field-label">Review — "Kenapa Worth It?"</label>
        <textarea id="hwReview" rows="4" placeholder="Narasi jujur untuk halaman detail">${escapeHtml(p?.review || '')}</textarea>
      </div>
      <div class="field field-span-2">
        <label class="field-label">Foto Utama (URL)</label>
        <input type="url" id="hwImage" value="${escapeHtml(p?.image || '')}" placeholder="https://images.unsplash.com/...">
      </div>
      <div class="field field-span-2">
        <label class="field-label">Galeri (satu URL per baris)</label>
        <textarea id="hwGallery" rows="3">${escapeHtml((p?.gallery || []).join('\n'))}</textarea>
      </div>
      <div class="field field-span-2">
        <label class="field-label">Spesifikasi (satu per baris)</label>
        <textarea id="hwSpecs" rows="4" placeholder="Layar 10.1 Inch IPS">${escapeHtml((p?.specs || []).join('\n'))}</textarea>
      </div>
      <div class="field field-span-2">
        <label class="field-label">Isi Paket (satu per baris)</label>
        <textarea id="hwInBox" rows="3" placeholder="Unit Utama, Adaptor, ...">${escapeHtml((p?.inBox || []).join('\n'))}</textarea>
      </div>
      <div class="field">
        <label class="field-label">Berat</label>
        <input id="hwWeight" value="${escapeHtml(p?.weight || '')}" placeholder="2.5 Kg">
      </div>
      <div class="field">
        <label class="field-label">Dimensi</label>
        <input id="hwDim" value="${escapeHtml(p?.dimensions || '')}" placeholder="30 x 25 x 15 cm">
      </div>
    </div>
      </div>
      <div class="cd-actions">
        <button class="btn btn-outline" onclick="closeHwPage()">Batal</button>
        <button class="btn btn-primary" onclick="saveHw(${idx})">${isEdit ? 'Simpan' : 'Tambah'}</button>
      </div>
    </div>`;

  flipCatalogEdit(true);
  setTimeout(() => document.getElementById('hwName')?.focus(), 100);
};

window.closeHwPage = function () {
  flipCatalogEdit(false);
};

window.saveHw = async function (idx = null) {
  const val = (id) => document.getElementById(id)?.value.trim() || '';
  const item = {
    id: Number(document.getElementById('hwId')?.value) || 0,
    name: val('hwName'),
    price: Math.max(0, parseInt(val('hwPrice'), 10) || 0),
    category: document.getElementById('hwCat')?.value || 'ANDROID',
    tag: val('hwTag') || null,
    desc: val('hwDesc'),
    review: val('hwReview'),
    image: val('hwImage'),
    gallery: linesToList(val('hwGallery')),
    specs: linesToList(val('hwSpecs')),
    inBox: linesToList(val('hwInBox')),
    weight: val('hwWeight'),
    dimensions: val('hwDim'),
  };
  if (!item.name) { showToast('Nama produk wajib diisi', 2000, 'error'); return; }
  if (!item.image) { showToast('URL foto utama wajib diisi', 2000, 'error'); return; }

  const isEdit = idx !== null;
  const snapshot = [...hwItems];
  if (isEdit) hwItems[idx] = item; else hwItems.push(item);
  renderHw();

  try {
    await writeCollection('hardware', hwItems);
    showToast(isEdit ? 'Hardware diperbarui' : 'Hardware ditambahkan', 2000, 'success');
    closeHwPage();
  } catch (e) {
    console.error(e);
    hwItems = snapshot;
    renderHw();
    showToast(e.message, 3000, 'error');
  }
};

window.deleteHw = async function (idx) {
  const p = hwItems[idx];
  if (!p) return;
  if (!confirm(`Hapus produk hardware "${p.name}"? Halaman /hardware akan berubah setelah deploy ulang.`)) return;
  const snapshot = [...hwItems];
  hwItems.splice(idx, 1);
  renderHw();
  try {
    await writeCollection('hardware', hwItems);
    showToast(`${p.name} dihapus`, 2000, 'success');
  } catch (e) {
    console.error(e);
    hwItems = snapshot;
    renderHw();
    showToast(e.message, 3000, 'error');
  }
};

/* ==================== TAB LAYANAN ==================== */

async function loadSvc() {
  try {
    const v = await fetchCollection('services');
    svcItems = Array.isArray(v) ? v : [];
  } catch (e) {
    console.error(e);
    svcItems = [];
    showToast('Gagal memuat layanan dari Supabase', 2500, 'error');
  }
  if (catTab === 'layanan') renderSvc();
}
window.refreshSvc = loadSvc;

function renderSvc() {
  const tbody = document.getElementById('svcTableBody');
  const grid = document.getElementById('svcCardList');
  const empty = document.getElementById('svcEmpty');
  if (!tbody || !grid || !empty) return;

  if (!svcItems.length) {
    tbody.innerHTML = '';
    grid.innerHTML = '';
    empty.hidden = false;
    return;
  }
  empty.hidden = true;

  // ── Tabel (desktop) ──
  tbody.innerHTML = svcItems.map((s, i) => `
    <tr data-idx="${i}" data-id="${escapeHtml(s.id || '')}">
      <td><span class="tag-pill">${escapeHtml(s.id || '—')}</span></td>
      <td>
        <div class="ct-name">${escapeHtml(s.title || '—')}</div>
        <div class="ct-kode">${escapeHtml((s.desc || '').slice(0, 70))}${(s.desc || '').length > 70 ? '…' : ''}</div>
      </td>
      <td><span class="cell-sub">${escapeHtml(s.subtitle || '—')}</span></td>
      <td class="ct-actions">
        <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); openSvcPage(${i})" aria-label="Edit ${escapeHtml(s.title || '')}" title="Edit">${icon('pencil', 14)}</button>
        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteSvc(${i})" aria-label="Hapus ${escapeHtml(s.title || '')}" title="Hapus">${icon('trash', 14)}</button>
      </td>
    </tr>`).join('');
  tbody.querySelectorAll('tr').forEach((tr) => {
    tr.style.cursor = 'pointer';
    tr.addEventListener('click', () => openSvcPage(parseInt(tr.dataset.idx)));
  });

  // ── Kartu (mobile) ──
  grid.innerHTML = svcItems.map((s, i) => `
    <article class="catalog-card" data-idx="${i}">
      <div class="catalog-card-cover">🛠️</div>
      <div class="catalog-card-title">${escapeHtml(s.title || '—')}</div>
      <div class="catalog-card-desc">${escapeHtml(s.desc || '')}</div>
      <div class="catalog-card-meta">${escapeHtml(s.subtitle || '')}</div>
      <div class="catalog-card-actions">
        <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); openSvcPage(${i})">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteSvc(${i})">Hapus</button>
      </div>
    </article>`).join('');
  grid.querySelectorAll('.catalog-card').forEach((card) => {
    card.addEventListener('click', () => openSvcPage(parseInt(card.dataset.idx)));
  });
}

window.openSvcPage = function (idx = null) {
  const isEdit = idx !== null;
  const s = isEdit ? svcItems[idx] : null;
  const page = document.getElementById('catalogEditPage');
  if (!page) return;

  page.innerHTML = `
    <div class="cd-head">
      <button type="button" class="btn btn-outline btn-sm" onclick="closeSvcPage()">← Kembali</button>
      <div class="cd-title"><h3>${isEdit ? 'Edit Layanan' : 'Tambah Layanan'}</h3></div>
    </div>
    <div class="panel">
      <div class="panel-body">
    <div class="field-grid">
      <div class="field">
        <label class="field-label">ID (slug, unik)</label>
        <input id="svcId" value="${escapeHtml(s?.id || '')}" placeholder="web" ${isEdit ? 'readonly' : ''}>
      </div>
      <div class="field">
        <label class="field-label">Subtitle</label>
        <input id="svcSubtitle" value="${escapeHtml(s?.subtitle || '')}" placeholder="Landing Page / Company Profile">
      </div>
      <div class="field field-span-2">
        <label class="field-label">Judul</label>
        <input id="svcTitle" value="${escapeHtml(s?.title || '')}" placeholder="Web Konversi Tinggi">
      </div>
      <div class="field field-span-2">
        <label class="field-label">Deskripsi</label>
        <textarea id="svcDesc" rows="4" placeholder="Narasi layanan untuk halaman utama">${escapeHtml(s?.desc || '')}</textarea>
      </div>
    </div>
      </div>
      <div class="cd-actions">
        <button class="btn btn-outline" onclick="closeSvcPage()">Batal</button>
        <button class="btn btn-primary" onclick="saveSvc(${idx})">${isEdit ? 'Simpan' : 'Tambah'}</button>
      </div>
    </div>`;

  flipCatalogEdit(true);
  setTimeout(() => document.getElementById('svcTitle')?.focus(), 100);
};

window.closeSvcPage = function () {
  flipCatalogEdit(false);
};

window.saveSvc = async function (idx = null) {
  const val = (id) => document.getElementById(id)?.value.trim() || '';
  const slugifyId = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const isEdit = idx !== null;
  const item = {
    id: isEdit ? svcItems[idx].id : (slugifyId(val('svcId')) || slugifyId(val('svcTitle'))),
    title: val('svcTitle'),
    subtitle: val('svcSubtitle'),
    desc: val('svcDesc'),
  };
  if (!item.title) { showToast('Judul layanan wajib diisi', 2000, 'error'); return; }
  if (!item.id) { showToast('ID layanan wajib diisi', 2000, 'error'); return; }
  if (!isEdit && svcItems.some((x) => x.id === item.id)) {
    showToast(`ID "${item.id}" sudah dipakai`, 2500, 'error');
    return;
  }

  const snapshot = [...svcItems];
  if (isEdit) svcItems[idx] = item; else svcItems.push(item);
  renderSvc();

  try {
    await writeCollection('services', svcItems);
    showToast(isEdit ? 'Layanan diperbarui' : 'Layanan ditambahkan', 2000, 'success');
    closeSvcPage();
  } catch (e) {
    console.error(e);
    svcItems = snapshot;
    renderSvc();
    showToast(e.message, 3000, 'error');
  }
};

window.deleteSvc = async function (idx) {
  const s = svcItems[idx];
  if (!s) return;
  if (!confirm(`Hapus layanan "${s.title}"? Section Jasa Digital akan berubah setelah deploy ulang.`)) return;
  const snapshot = [...svcItems];
  svcItems.splice(idx, 1);
  renderSvc();
  try {
    await writeCollection('services', svcItems);
    showToast(`${s.title} dihapus`, 2000, 'success');
  } catch (e) {
    console.error(e);
    svcItems = snapshot;
    renderSvc();
    showToast(e.message, 3000, 'error');
  }
};
