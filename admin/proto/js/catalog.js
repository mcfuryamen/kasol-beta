/**
 * Admin Marketing KASIRSOLO — Catalog Module
 * Manage application catalog displayed on landing page
 */

import { getState, setState, subscribe } from './app-state.js';
import { getAll, put, getByKey, del } from './storage.js';
import { showToast } from './toast.js';
import { escapeHtml } from './utils.js';

export async function initCatalog() {
  await renderCatalog();
  window.addEventListener('screen:change', (e) => {
    if (e.detail?.screen === 'catalog') renderCatalog();
  });
}

async function renderCatalog() {
  const listHost = document.getElementById('catalogList');
  const emptyHost = document.getElementById('catalogEmpty');
  const products = await getAll('products');

  if (products.length === 0) {
    listHost.innerHTML = '';
    emptyHost.hidden = false;
    return;
  }

  emptyHost.hidden = true;
  listHost.innerHTML = products.map(p => `
    <article class="catalog-card" data-id="${p.id}">
      <div class="catalog-card-cover">${p.icon}</div>
      <div class="catalog-card-body">
        <h3 class="catalog-card-title">${escapeHtml(p.name)}</h3>
        <p class="catalog-card-meta">${escapeHtml(p.description)}</p>
        <div class="catalog-card-meta">
          <span class="badge ${p.active ? 'badge-aktif' : 'badge-expired'}">${p.active ? 'Aktif' : 'Nonaktif'}</span>
          <span>Bisnis · Rp${p.price.toLocaleString('id-ID')}/bln</span>
        </div>
      </div>
      <div class="catalog-card-actions">
        <button class="btn btn-sm" onclick="editCatalog('${p.id}')">Edit</button>
        <button class="btn btn-sm btn-danger" onclick="deleteCatalog('${p.id}')">Hapus</button>
      </div>
    </article>
  `).join('');
}

window.openCatalogSheet = function() {
  const sheet = document.getElementById('catalogSheetBody');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title"><span>📦 Tambah Aplikasi Baru</span><span class="sheet-close" role="button" aria-label="Tutup" onclick="closeSheet('sheetCatalog')">✕</span></div>
    <div class="field-grid">
      <div class="field"><label class="field-label">App Type (id)</label><input type="text" id="catAppType" placeholder="contoh: kaki5, rosok, custom" maxlength="20"></div>
      <div class="field"><label class="field-label">Nama Produk</label><input type="text" id="catName" placeholder="Nama tampilan produk"></div>
      <div class="field"><label class="field-label">Ikon</label><input type="text" id="catIcon" placeholder="🛵" maxlength="4"></div>
      <div class="field"><label class="field-label">Prefix Serial</label><input type="text" id="catPrefix" placeholder="KK5" maxlength="5" class="input-mono uppercase"></div>
      <div class="field"><label class="field-label">Harga (Rp/bln)</label><input type="number" id="catPrice" value="0" min="0"></div>
      <div class="field"><label class="field-label">Deskripsi</label><textarea id="catDesc" rows="3" placeholder="Deskripsi produk untuk katalog"></textarea></div>
    </div>
    <div class="btn-block-row mt16">
      <button class="btn btn-outline" onclick="closeSheet('sheetCatalog')">Tutup</button>
      <button class="btn btn-primary" onclick="createCatalog()">💾 Buat Aplikasi</button>
    </div>
  `;
  document.getElementById('sheetCatalog').classList.add('open');
};

window.createCatalog = async function() {
  const appType = document.getElementById('catAppType').value.trim().toLowerCase();
  if (!appType) { showToast('App Type wajib diisi', 2000, 'error'); return; }

  const products = await getAll('products');
  if (products.some(p => p.id === appType)) { showToast('App Type sudah ada', 2000, 'error'); return; }

  const newProduct = {
    id: appType,
    app_type: appType,
    name: document.getElementById('catName').value.trim() || appType,
    icon: document.getElementById('catIcon').value.trim() || '📦',
    prefix: document.getElementById('catPrefix').value.trim().toUpperCase() || appType.toUpperCase().slice(0,3),
    price: parseInt(document.getElementById('catPrice').value) || 0,
    description: document.getElementById('catDesc').value.trim(),
    active: true
  };

  await put('products', newProduct);
  showToast('✅ Aplikasi dibuat', 2000, 'success');
  closeSheet('sheetCatalog');
  renderCatalog();
};

window.editCatalog = async function(appType) {
  const products = await getAll('products');
  const product = products.find(p => p.id === appType);
  if (!product) return;

  const sheet = document.getElementById('catalogSheetBody');
  sheet.innerHTML = `
    <div class="sheet-handle"></div>
    <div class="sheet-title"><span>📦 Edit: ${product.icon} ${product.name}</span><span class="sheet-close" role="button" aria-label="Tutup" onclick="closeSheet('sheetCatalog')">✕</span></div>
    <div class="field-grid">
      <div class="field"><label class="field-label">App Type</label><input type="text" value="${product.id}" readonly class="input-readonly"></div>
      <div class="field"><label class="field-label">Nama Produk</label><input type="text" id="catName" value="${escapeHtml(product.name)}"></div>
      <div class="field"><label class="field-label">Ikon</label><input type="text" id="catIcon" value="${product.icon}" maxlength="4"></div>
      <div class="field"><label class="field-label">Prefix Serial</label><input type="text" id="catPrefix" value="${product.prefix}" maxlength="5" class="input-mono uppercase"></div>
      <div class="field"><label class="field-label">Harga (Rp/bln)</label><input type="number" id="catPrice" value="${product.price}" min="0"></div>
      <div class="field"><label class="field-label">Deskripsi</label><textarea id="catDesc" rows="3">${escapeHtml(product.description)}</textarea></div>
      <div class="field field-span-2">
        <label class="field-label">Status</label>
        <select id="catActive">
          <option value="true" ${product.active ? 'selected' : ''}>Aktif</option>
          <option value="false" ${!product.active ? 'selected' : ''}>Nonaktif</option>
        </select>
      </div>
    </div>
    <div class="btn-block-row mt16">
      <button class="btn btn-outline" onclick="closeSheet('sheetCatalog')">Tutup</button>
      <button class="btn btn-danger" onclick="deleteCatalog('${product.id}')">🗑️ Hapus</button>
      <button class="btn btn-primary" onclick="saveCatalog('${product.id}')">💾 Simpan</button>
    </div>
  `;
  document.getElementById('sheetCatalog').classList.add('open');
};

window.saveCatalog = async function(appType) {
  const products = await getAll('products');
  const product = products.find(p => p.id === appType);
  if (!product) return;

  const updated = {
    ...product,
    name: document.getElementById('catName').value.trim(),
    icon: document.getElementById('catIcon').value.trim() || '📦',
    prefix: document.getElementById('catPrefix').value.trim().toUpperCase(),
    price: parseInt(document.getElementById('catPrice').value) || 0,
    description: document.getElementById('catDesc').value.trim(),
    active: document.getElementById('catActive').value === 'true'
  };

  await put('products', updated);
  showToast('✅ Aplikasi diperbarui', 2000, 'success');
  closeSheet('sheetCatalog');
  renderCatalog();
};

window.deleteCatalog = async function(appType) {
  if (!confirm(`Hapus aplikasi ${appType}? Tindakan ini tidak bisa dibatalkan.`)) return;
  await del('products', appType);
  showToast('Aplikasi dihapus', 2000, 'success');
  renderCatalog();
};