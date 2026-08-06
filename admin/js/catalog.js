/**
 * Admin Marketing KASIRSOLO — Catalog Module
 * CRUD for application catalog (syncs to landing page)
 * Rosok-style: grid cards for display, sheet modal for editing
 */

import { STATE, subscribe, setState } from './app-state.js';
import { storage } from './storage.js';
import { formatRupiah, escapeHtml, generateId } from './utils.js';
import { showToast } from './toast.js';

let catalogGrid = null;
let catalogEmpty = null;
let addAppBtn = null;

/**
 * Initialize catalog module
 */
export function initCatalog() {
  catalogGrid = document.getElementById('catalogList');
  catalogEmpty = document.getElementById('catalogEmpty');
  addAppBtn = document.querySelector('[onclick="openCatalogForm()"]');

  if (!catalogGrid) return;

  addAppBtn?.addEventListener('click', () => openCatalogSheet());

  // Subscribe to catalog changes
  subscribe('catalog', renderCatalog);

  // Initial render
  renderCatalog();
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
    <article class="catalog-card" data-idx="${idx}">
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
    id: generateId('app'),
    icon: '📦',
    name: '',
    desc: '',
    price: 0,
    category: 'bisnis',
    hot: false
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
        <label class="field-label">Ikon Emoji</label>
        <input type="text" id="catIcon" value="${escapeHtml(app.icon)}" maxlength="4" placeholder="📦">
      </div>
      <div class="field">
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
 * Save catalog app (create or update)
 */
window.saveCatalogApp = async function(idx = null) {
  const icon = document.getElementById('catIcon')?.value.trim().slice(0, 4) || '📦';
  const name = document.getElementById('catName')?.value.trim() || 'Aplikasi Baru';
  const desc = document.getElementById('catDesc')?.value.trim() || '';
  const category = document.getElementById('catCategory')?.value || 'bisnis';
  const price = parseInt(document.getElementById('catPrice')?.value) || 0;
  const hot = document.getElementById('catHot')?.checked || false;

  const isEdit = idx !== null;

  if (isEdit) {
    const apps = STATE.catalog || [];
    if (apps[idx]) {
      apps[idx] = { ...apps[idx], icon, name, desc, category, price, hot };
    }
  } else {
    const newApp = { id: generateId('app'), icon, name, desc, category, price, hot };
    STATE.catalog = [...(STATE.catalog || []), newApp];
  }

  const success = await storage.set('catalog', STATE.catalog);
  if (success) {
    setState('catalog', STATE.catalog);
    showToast(isEdit ? 'Aplikasi diperbarui' : 'Aplikasi ditambahkan', 2000, 'success');
    closeCatalogSheet();
  } else {
    showToast('Gagal menyimpan', 2000, 'error');
  }
};

/**
 * Delete catalog app
 */
window.deleteCatalogApp = async function(idx) {
  if (!confirm('Hapus aplikasi ini dari katalog?')) return;

  const apps = STATE.catalog || [];
  if (!apps[idx]) return;

  const name = apps[idx].name;
  apps.splice(idx, 1);

  const success = await storage.set('catalog', apps);
  if (success) {
    setState('catalog', apps);
    showToast(`${name} dihapus`, 2000, 'success');
  } else {
    showToast('Gagal menghapus', 2000, 'error');
  }
};