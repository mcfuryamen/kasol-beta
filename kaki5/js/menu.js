// ==================== MENU MANAGEMENT (ESM) ====================
import { DB } from './db.js';
import { escapeHtml, formatRp, showToast } from './helpers.js';
import { currentPage } from './app-state.js';
import { showConfirm } from './confirm.js';
import { loadPOS } from './pos.js';

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
          <button class="btn-icon btn-ghost" style="width:44px;height:44px;min-height:44px;font-size:16px" onclick="openMenuForm(${m.id})">✏️</button>
          <button class="btn-icon btn-ghost" style="width:44px;height:44px;min-height:44px;font-size:16px" onclick="toggleMenu(${m.id})">${m.aktif?'⏸️':'▶️'}</button>
          <button class="btn-icon btn-ghost" style="width:44px;height:44px;min-height:44px;font-size:16px;color:var(--red)" onclick="confirmDeleteMenu(${m.id})">🗑️</button>
        </div>
      </div>`;
    });
    html += '</div>';
  }
  box.innerHTML = html;
}

export async function openMenuForm(id) {
  document.getElementById('editMenuId').value = id || '';
  if (id) {
    const m = await DB.menu.get(id);
    if (!m) return;
    document.getElementById('menuModalTitle').textContent = '✏️ Edit Menu';
    document.getElementById('menuNama').value = m.nama;
    document.getElementById('menuKategori').value = m.kategori;
    document.getElementById('menuHargaJual').value = m.hargaJual;
    document.getElementById('menuHargaModal').value = m.hargaModal;
  } else {
    document.getElementById('menuModalTitle').textContent = '🍽️ Tambah Menu';
    document.getElementById('menuNama').value = '';
    document.getElementById('menuKategori').value = 'Makanan';
    document.getElementById('menuHargaJual').value = '';
    document.getElementById('menuHargaModal').value = '';
  }
  document.getElementById('menuModal').classList.add('show');
}

export function closeMenuModal() {
  document.getElementById('menuModal').classList.remove('show');
}

export async function saveMenu() {
  const id = document.getElementById('editMenuId').value;
  const nama = document.getElementById('menuNama').value.trim();
  const kategori = document.getElementById('menuKategori').value;
  const hargaJual = parseInt(document.getElementById('menuHargaJual').value) || 0;
  const hargaModal = parseInt(document.getElementById('menuHargaModal').value) || 0;

  if (!nama) { showToast('Nama menu harus diisi!', 'error'); return; }
  if (hargaJual <= 0) { showToast('Harga jual harus diisi!', 'error'); return; }

  if (id) {
    await DB.menu.update(parseInt(id), { nama, kategori, hargaJual, hargaModal });
    showToast('✅ Menu diperbarui!');
  } else {
    await DB.menu.add({ nama, kategori, hargaJual, hargaModal, aktif: 1, urutan: Date.now() });
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
