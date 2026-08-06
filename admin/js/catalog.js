/**
 * Admin Marketing KASIRSOLO — Catalog Module
 * CRUD for application catalog via Supabase (syncs to landing page)
 * Rosok-style: grid cards for display, sheet modal for editing
 */

import { STATE, subscribe, setState } from './app-state.js';
import { storage } from './storage.js';
import { formatRupiah, escapeHtml, generateId } from './utils.js';
import { showToast } from './toast.js';

let catalogGrid = null;
let catalogEmpty = null;
let addAppBtn = null;

// Supabase config — read from window at fetch time (not module eval time)
const getSupabaseConfig = () => ({
  url: window.SUPABASE_URL || 'https://hhywrvedlwljawgxzpkq.supabase.co',
  key: window.SUPABASE_SERVICE_KEY || ''
});

/**
 * Fetch products from Supabase
 */
async function fetchProductsFromSupabase() {
  try {
    const { url, key } = getSupabaseConfig();
    const response = await fetch(`${url}/rest/v1/products?order=order_index.asc`, {
      method: 'GET',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Supabase fetch failed:', response.status);
      return [];
    }

    const products = await response.json();
    
    // Transform Supabase products → admin catalog format
    return products.map(p => ({
      id: p.id,
      appType: p.app_type,
      icon: p.icon || '📦',
      name: p.name,
      desc: p.description || '',
      price: parseInt(p.price_label?.replace(/\D/g, '') || '0', 10),
      category: getCategoryFromAppType(p.app_type),
      hot: p.order_index === 0,
      orderIndex: p.order_index,
      visible: p.visible
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
  addAppBtn = document.querySelector('[onclick="openCatalogForm()"]');

  if (!catalogGrid) return;

  addAppBtn?.addEventListener('click', () => openCatalogSheet());

  // Load catalog from Supabase
  const products = await fetchProductsFromSupabase();
  setState('catalog', products);

  // Subscribe to catalog changes
  subscribe('catalog', renderCatalog);

  // Initial render
  renderCatalog();
  
  console.log('✅ Catalog loaded from Supabase:', products.length, 'products');
}

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
      <div class="catalog-card-meta">${formatRupiah(app.price || 0)}</div>
      <div class="catalog-card-category">${getCategoryLabel(app.category)}</div>
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
    category: 'bisnis',
    hot: false,
    appType: '',
    orderIndex: (STATE.catalog || []).length
  };

  const overlay = document.getElementById('catalogSheetOverlay');
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
        <label class="field-label">
          <input type="checkbox" id="catHot" ${app.hot ? 'checked' : ''}> Hot (tampilkan badge di landing)
        </label>
      </div>
      <div class="field">
        <label class="field-label">Order Index</label>
        <input type="number" id="catOrderIndex" value="${app.orderIndex || 0}" min="0" step="1">
      </div>
    </div>
    <div class="btn-block-row mt12">
      <button class="btn btn-outline" onclick="closeCatalogSheet()">Batal</button>
      <button class="btn btn-primary" onclick="saveCatalogApp(${idx})">${isEdit ? 'Simpan Perubahan' : 'Tambah Aplikasi'}</button>
    </div>
  `;

  overlay.classList.add('show');
  document.body.style.overflow = 'hidden';

  // Focus first input
  setTimeout(() => document.getElementById('catName')?.focus(), 100);
};

/**
 * Close catalog sheet
 */
window.closeCatalogSheet = function() {
  const overlay = document.getElementById('catalogSheetOverlay');
  if (overlay) {
    overlay.classList.remove('show');
    document.body.style.overflow = '';
  }
};

/**
 * Save catalog app (create or update) → Supabase
 */
window.saveCatalogApp = async function(idx = null) {
  const appType = document.getElementById('catAppType')?.value.trim() || '';
  const icon = document.getElementById('catIcon')?.value.trim().slice(0, 4) || '📦';
  const name = document.getElementById('catName')?.value.trim() || 'Aplikasi Baru';
  const desc = document.getElementById('catDesc')?.value.trim() || '';
  const category = document.getElementById('catCategory')?.value || 'bisnis';
  const price = parseInt(document.getElementById('catPrice')?.value) || 0;
  const hot = document.getElementById('catHot')?.checked || false;
  const orderIndex = parseInt(document.getElementById('catOrderIndex')?.value) || 0;

  const isEdit = idx !== null;

  if (!isEdit && !appType) {
    showToast('App Type wajib diisi untuk produk baru', 2000, 'error');
    return;
  }

  const payload = {
    app_type: appType,
    name: name,
    tagline: `${name} - Sistem Terbaik`,
    description: desc,
    price_label: `Rp ${price.toLocaleString('id-ID')}`,
    features: [],
    icon: icon,
    color: '#F5821F',
    order_index: orderIndex,
    visible: true
  };

  try {
    const { url, key } = getSupabaseConfig();
    let response;
    if (isEdit) {
      // UPDATE
      const app = (STATE.catalog || [])[idx];
      if (!app || !app.id) {
        showToast('Produk tidak ditemukan', 2000, 'error');
        return;
      }

      response = await fetch(`${url}/rest/v1/products?id=eq.${app.id}`, {
        method: 'PATCH',
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(payload)
      });
    } else {
      // CREATE
      response = await fetch(`${url}/rest/v1/products`, {
        method: 'POST',
        headers: {
          'apikey': key,
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(payload)
      });
    }

    if (response.ok) {
      // Refresh catalog from Supabase
      const products = await fetchProductsFromSupabase();
      setState('catalog', products);
      showToast(isEdit ? 'Aplikasi diperbarui' : 'Aplikasi ditambahkan', 2000, 'success');
      closeCatalogSheet();
    } else {
      const error = await response.text();
      console.error('Supabase save failed:', error);
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
    const { url, key } = getSupabaseConfig();
    const response = await fetch(`${url}/rest/v1/products?id=eq.${app.id}`, {
      method: 'DELETE',
      headers: {
        'apikey': key,
        'Authorization': `Bearer ${key}`
      }
    });

    if (response.ok || response.status === 204) {
      // Refresh catalog from Supabase
      const products = await fetchProductsFromSupabase();
      setState('catalog', products);
      showToast(`${name} dihapus`, 2000, 'success');
    } else {
      const error = await response.text();
      console.error('Supabase delete failed:', error);
      showToast('Gagal menghapus dari Supabase', 2000, 'error');
    }
  } catch (error) {
    console.error('Error deleting from Supabase:', error);
    showToast('Error: ' + error.message, 2000, 'error');
  }
};
