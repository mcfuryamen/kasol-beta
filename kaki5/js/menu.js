// ==================== MENU MANAGEMENT (ESM) ====================
import { DB } from './db.js';
import { escapeHtml, formatRp, showToast } from './helpers.js';
import { currentPage } from './app-state.js';
import { showConfirm } from './confirm.js';
import { loadPOS } from './pos.js';
import { openModal, closeModal } from './modal.js';

// Debounced search for menu list
function debounce(fn, delay = 300) {
  let timer = null;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

const _debouncedRenderMenuList = debounce(renderMenuList, 300);

export async function renderMenuList() {
  const search = (document.getElementById('searchMenuList').value || '').toLowerCase();
  let menus = await DB.menu.toArray();
  if (search) menus = menus.filter(m => m.nama.toLowerCase().includes(search));

  const box = document.getElementById('menuListContainer');
  if (menus.length === 0) {
    box.innerHTML = '<div class="empty-state"><div class="empty-icon">🍽️</div><div class="empty-text">Belum ada menu.<br>Ketuk tombol + untuk tambah menu baru.</div></div>';
    return;
  }

  const catEmoji = {Makanan:'🍚',Minuman:'🥤',Snack:'🍢',Lainnya:'📦'};
  // Group by kategori
  const groups = {};
  menus.forEach(m => {
    if (!groups[m.kategori]) groups[m.kategori] = [];
    groups[m.kategori].push(m);
  });

  let html = '';
  for (const [cat, items] of Object.entries(groups)) {
    html += `<div class="card">
      <div class="card-title">${escapeHtml(catEmoji[cat]||'📦')} ${escapeHtml(cat)}</div>`;
    items.forEach(m => {
      const untung = m.hargaJual - m.hargaModal;
      html += `<div class="trx-item">
        <div class="trx-icon" style="background:${m.aktif?'var(--green-bg)':'#f5f5f5'};color:${m.aktif?'var(--green)':'#bbb'};font-size:18px">${m.aktif?'✅':'⏸️'}</div>
        <div class="trx-info">
          <div class="trx-title">${escapeHtml(m.nama)}</div>
          <div class="trx-sub">Modal ${formatRp(m.hargaModal)} · Untung ${formatRp(untung)}</div>
        </div>
        <div style="display:flex;gap:4px">
          <button class="btn-icon btn-ghost kwh44" data-action="open-menu-form" data-menu-id="${m.id}">✏️</button>
          <button class="btn-icon btn-ghost kwh44" data-action="toggle-menu" data-menu-id="${m.id}">${m.aktif?'⏸️':'▶️'}</button>
          <button class="btn-icon btn-ghost kwh44 kred" data-action="confirm-delete-menu" data-menu-id="${m.id}">🗑️</button>
        </div>
      </div>`;
    });
    html += '</div>';
  }
  box.innerHTML = html;
}

// Serialize modal open: tutup dulu kalau sedang terbuka agar tidak race
// dengan async DB.menu.get() di openMenuForm (audit 2026-08-09).
let _menuFormInFlight = false;

export async function openMenuForm(id) {
  // Tunggu form sebelumnya selesai di-render sebelum mulai yang baru.
  // Loop dengan jeda pendek, max ~3 detik biar tidak hang kalau ada error.
  for (let i = 0; i < 100 && _menuFormInFlight; i++) {
    await new Promise(r => setTimeout(r, 30));
  }
  _menuFormInFlight = true;
  try {
    if (id) {
      const m = await DB.menu.get(id);
      if (!m) return;
      // Re-check: kalau ada click lagi saat kita await, abort
      if (!_menuFormInFlight) return;
      document.getElementById('editMenuId').value = id;
      document.getElementById('menuModalTitle').textContent = '✏️ Edit Menu';
      document.getElementById('menuNama').value = m.nama;
      document.getElementById('menuKategori').value = m.kategori;
      document.getElementById('menuHargaJual').value = m.hargaJual;
      document.getElementById('menuHargaModal').value = m.hargaModal;
      // Topping list: render sebagai baris terpisah "nama|harga" di textarea
      const toppings = parseToppingList(m.toppingList);
      document.getElementById('menuToppingList').value = toppings.map(t => t.nama + '|' + t.harga).join('\n');
      // Harga ojol: 0 = tidak di-set
      document.getElementById('menuHargaOjol').value = m.hargaOjol || '';
    } else {
      document.getElementById('editMenuId').value = '';
      document.getElementById('menuModalTitle').textContent = '🍽️ Tambah Menu';
      document.getElementById('menuNama').value = '';
      document.getElementById('menuKategori').value = 'Makanan';
      document.getElementById('menuHargaJual').value = '';
      document.getElementById('menuHargaModal').value = '';
      document.getElementById('menuToppingList').value = '';
      document.getElementById('menuHargaOjol').value = '';
    }
    await openModal('menuModal');
  } finally {
    _menuFormInFlight = false;
  }
}

export function closeMenuModal() {
  closeModal('menuModal');
}

// =====================================================================
// Topping helpers (opsi ringan topping + hargaOjol via field di tabel menu)
// =====================================================================

// Parse JSON string → array {nama, harga}. Kembali [] kalau invalid/kosong.
export function parseToppingList(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(t => typeof t.nama === 'string' && t.nama.trim() !== '');
  } catch { return []; }
}

// Format array {nama, harga} → JSON string untuk disimpan ke DB
export function buildToppingListString(toppings) {
  return JSON.stringify(toppings.filter(t => t.nama && t.nama.trim()));
}

// Parse textarea "Susu|1000\nExtra Gula|500" → [{nama, harga}]
export function parseToppingTextarea(raw) {
  if (!raw || !raw.trim()) return [];
  return raw.trim().split('\n').map(line => {
    const [nama, hargaRaw] = line.split('|');
    return { nama: (nama || '').trim(), harga: Math.max(0, parseInt(hargaRaw) || 0) };
  }).filter(t => t.nama !== '');
}

// Validasi hargaJual untuk menu biasa sama, tapi topping boleh harga 0 (gratis)
export async function saveMenu() {
  const id = document.getElementById('editMenuId').value;
  const nama = document.getElementById('menuNama').value.trim();
  const kategori = document.getElementById('menuKategori').value;
  const hargaJual = parseInt(document.getElementById('menuHargaJual').value) || 0;
  const hargaModal = parseInt(document.getElementById('menuHargaModal').value) || 0;
  const hargaOjol = parseInt(document.getElementById('menuHargaOjol').value) || 0;
  const toppingRaw = document.getElementById('menuToppingList').value || '';
  const toppingList = buildToppingListString(parseToppingTextarea(toppingRaw));

  if (!nama) { showToast('Nama menu harus diisi!', 'error'); return; }
  if (hargaJual <= 0) { showToast('Harga jual harus diisi!', 'error'); return; }

  const updateData = { nama, kategori, hargaJual, hargaModal, hargaOjol, toppingList };
  if (id) {
    await DB.menu.update(parseInt(id), updateData);
    showToast('✅ Menu diperbarui!');
  } else {
    await DB.menu.add({ ...updateData, aktif: 1, urutan: Date.now() });
    showToast('✅ Menu ditambahkan!');
  }
  closeMenuModal();
  renderMenuList();
  if (currentPage === 'jualan') loadPOS();
}

export async function toggleMenu(id) {
  const m = await DB.menu.get(id);
  if (!m) return;
  await DB.menu.update(id, { aktif: m.aktif ? 0 : 1 });
  await renderMenuList();
  showToast(m.aktif ? '⏸️ Menu dinonaktifkan' : '▶️ Menu diaktifkan');
}

export function confirmDeleteMenu(id) {
  showConfirm('🗑️', 'Yakin mau hapus menu ini?', 'Ya, Hapus', async () => {
    await DB.menu.delete(id);
    await renderMenuList();
    showToast('Menu dihapus');
  });
}

// Export debounced version for oninput handler
export const renderMenuListDebounced = _debouncedRenderMenuList;
