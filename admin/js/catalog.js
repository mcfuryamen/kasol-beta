/**
 * Admin Marketing KASIRSOLO — Catalog Module
 * CRUD for application catalog via Supabase (syncs to landing page)
 * Rosok-style: grid cards for display, sheet modal for editing
 */

import { STATE, subscribe, setState } from './app-state.js';
import { formatRupiah, escapeHtml } from './utils.js';
import { showToast } from './toast.js';
import { supabaseFetch } from './api.js';
import { updateSidebarBadges } from './navigation.js?v=20260812i';

let catalogGrid = null;
let catalogEmpty = null;

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
 * Render catalog as grid cards (Rosok-style)
 */
export function renderCatalog() {
  if (!catalogGrid || !catalogEmpty) return;

  const apps = STATE.catalog || [];

  if (apps.length === 0) {
    catalogGrid.innerHTML = '';
    catalogEmpty.hidden = false;
    return;
  }

  catalogEmpty.hidden = true;

  catalogGrid.innerHTML = apps.map((app, idx) => `
    <article class="catalog-card" data-idx="${idx}" data-id="${escapeHtml(app.id)}">
      <div class="catalog-card-cover">${escapeHtml(app.icon || '📦')}</div>
      <div class="catalog-card-title">${escapeHtml(app.name || 'Aplikasi Baru')}</div>
      <div class="catalog-card-desc">${escapeHtml(app.desc || '')}</div>
      <div class="catalog-card-meta">${escapeHtml(app.kodeProduk || app.appType || '—')} · ${formatRupiah(app.price || 0)}</div>
      ${app.txQuota ? `<div class="catalog-card-meta" style="color:#15803d;font-weight:600">🎁 Kuota gratis: ${escapeHtml(String(app.txQuota))} transaksi/bulan</div>` : ''}
      <div class="catalog-card-category">${getCategoryLabel(app.category)}</div>
            <div class="catalog-card-domain">
              ${app.storeUrl ? `<a href="${escapeHtml(app.storeUrl)}" target="_blank" rel="noopener" class="domain-chip ${statusChipClass(app)}">${statusChipLabel(app)}</a>` : statusChip(app)}
              ${app.vercelUrl && !app.storeUrl ? `<a href="${escapeHtml(app.vercelUrl)}" target="_blank" rel="noopener" class="domain-chip domain-vercel">▲ Vercel</a>` : ''}
            </div>
            ${app.hot ? '<span class="catalog-card-hot">🔥 Hot</span>' : ''}
      <div class="catalog-card-actions">
        <button class="btn btn-outline btn-sm" onclick="event.stopPropagation(); openCatalogSheet(${idx})">✏️ Edit</button>
        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation(); deleteCatalogApp(${idx})">🗑️ Hapus</button>
      </div>
    </article>
  `).join('');

  // Bind click events for editing
  catalogGrid.querySelectorAll('.catalog-card').forEach(card => {
    card.addEventListener('click', () => {
      const idx = parseInt(card.dataset.idx);
      openCatalogSheet(idx);
    });
  });
}

/**
 * Get category label
 */
function getCategoryLabel(category) {
  const labels = {
    'bisnis': '💼 Bisnis',
    'institusi': '🏛️ Institusi',
    'kesehatan': '🏥 Kesehatan'
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
    maintenance:  { cls: 'domain-maint', label: '🛠 MAINTENANCE' },
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
  const map = { live: '● LIVE', ready: '● READY', maintenance: '🛠 MAINTENANCE', development: '◆ DEVELOPMENT' };
  return map[s] || '◆ DEVELOPMENT';
}

/**
 * Open catalog sheet modal (create or edit)
 */
window.openCatalogSheet = function(idx = null) {
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

  const overlay = document.getElementById('sheetCatalog');
  const sheet = document.getElementById('catalogSheet');

  if (!overlay || !sheet) return;

  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title">
      <h3>${isEdit ? 'Edit Aplikasi' : 'Tambah Aplikasi'}</h3>
      <button class="sheet-close" onclick="closeCatalogSheet()" aria-label="Tutup">&times;</button>
    </div>
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
    <div class="btn-block-row mt12">
      <button class="btn btn-outline" onclick="closeCatalogSheet()">Batal</button>
      <button class="btn btn-primary" onclick="saveCatalogApp(${idx})">${isEdit ? 'Simpan' : 'Tambah'}</button>
    </div>
  `;

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';

  // Focus first input
  setTimeout(() => document.getElementById('catName')?.focus(), 100);
};

/**
 * Close catalog sheet
 */
window.closeCatalogSheet = function() {
  const overlay = document.getElementById('sheetCatalog');
  if (overlay) {
    overlay.classList.remove('open');
    document.body.style.overflow = '';
  }
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
        closeCatalogSheet();
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
