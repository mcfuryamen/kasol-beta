// ==================== MENU MANAGEMENT (ESM) ====================
import { DB, getSetting, setSetting } from './db.js';
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

// ── Filter kategori halaman Menu (accordion, ala halaman Jualan) ────────────
let _menuCat = 'Semua';
const _CAT_EMOJI = {Makanan:'🍚',Minuman:'🥤',Snack:'🍢',Lainnya:'📦'};
function catEmoji(cat) { return _CAT_EMOJI[cat] || '📦'; }
function catLabel(cat) { return cat === 'Semua' ? '📋 Semua' : catEmoji(cat) + ' ' + cat; }

// Render tombol kategori di #menuCatAccordionInner (dipanggil dari
// renderMenuList agar selalu sinkron). Klik kategori → pilih & render ulang;
// accordion tetap terbuka (ditutup manual via tombol 📂 Kategori) —
// perilaku sama dengan halaman Jualan.
function renderMenuCatAccordion(allMenus) {
  const box = document.getElementById('menuCatAccordionInner');
  if (!box) return;
  const cats = ['Semua', ...new Set(allMenus.map(m => m.kategori))];
  box.innerHTML = cats.map(c =>
    `<button class="btn btn-sm ${_menuCat === c ? 'btn-primary' : 'btn-ghost'}"
            data-cat="${escapeHtml(c)}">${escapeHtml(catLabel(c))}</button>`
  ).join('');
  box.onclick = (e) => {
    const btn = e.target.closest('button[data-cat]');
    if (!btn) return;
    selectMenuCat(btn.dataset.cat);
  };
}

export function selectMenuCat(cat) {
  _menuCat = cat || 'Semua';
  renderMenuList();
}

export async function renderMenuList() {
  const search = (document.getElementById('searchMenuList').value || '').toLowerCase();
  const allMenus = await DB.menu.toArray();
  renderMenuCatAccordion(allMenus);
  let menus = allMenus;
  if (_menuCat !== 'Semua') menus = menus.filter(m => m.kategori === _menuCat);
  if (search) menus = menus.filter(m => m.nama.toLowerCase().includes(search));

  const box = document.getElementById('menuListContainer');
  if (menus.length === 0) {
    box.innerHTML = '<div class="empty-state"><div class="empty-icon">🍽️</div><div class="empty-text">Belum ada menu.<br>Ketuk tombol + untuk tambah menu baru.</div></div>';
    return;
  }

  // Group by kategori
  const groups = {};
  menus.forEach(m => {
    if (!groups[m.kategori]) groups[m.kategori] = [];
    groups[m.kategori].push(m);
  });

  let html = '';
  for (const [cat, items] of Object.entries(groups)) {
    html += `<div class="card">
      <div class="card-title">${escapeHtml(catEmoji(cat))} ${escapeHtml(cat)}</div>`;
    items.forEach(m => {
      const untung = m.hargaJual - m.hargaModal;
      const isTitipan = m.suplayer && m.suplayer !== 'Umum';
      const isStokHabis = m.pakaiStok && m.stok <= 0;
      const isDim = isStokHabis || !m.aktif;
      html += `<div class="trx-item" style="${isDim ? 'opacity:0.45' : ''}">
        <div class="trx-icon" style="background:${m.aktif?'var(--green-bg)':'#f5f5f5'};color:${m.aktif?'var(--green)':'#bbb'};font-size:18px">${m.aktif?'✅':'⏸️'}</div>
        <div class="trx-info">
          <div class="trx-title">${escapeHtml(m.nama)}` +
            (isTitipan ? '<span class="badge-titipan">Titipan</span>' : '') +
            (m.pakaiStok ? `<span class="badge-stok${isStokHabis?' badge-stok-habis':''}">📦 ${m.stok}</span>` : '') +
          `</div>
          <div class="trx-sub">Modal ${formatRp(m.hargaModal)} · Untung ${formatRp(untung)}` +
            (isTitipan ? ` · 🧾 ${escapeHtml(m.suplayer)}` : '') +
          `</div>
        </div>
        <div style="display:flex;gap:4px">
          ${isTitipan && m.pakaiStok ? `<button class="btn-icon btn-ghost kwh44 kgreen" data-action="retur-menu" data-menu-id="${m.id}" title="Retur">↩️</button>` : ''}
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
      // Konsinyasi
      const suplayer = m.suplayer || 'Umum';
      document.getElementById('menuSuplayerVal').value = suplayer;
      document.getElementById('menuPakaiStok').checked = !!m.pakaiStok;
      document.getElementById('menuStok').value = m.stok ?? '';
      // Setelah suplayer di-set, baru populate select + select value
      await populateSuplayerSelect(suplayer);
      await populateKategoriSelect(m.kategori);
      // Auto-on Pakai Stok saat suplayer ≠ Umum
      document.getElementById('menuSuplayerSelect').onchange = syncPakaiStokToggle; // onchange agar tidak menumpuk listener (audit 2026-08-19)
      document.getElementById('menuPakaiStok').onchange = syncStokVisibility;
      bindPakaiStokUserOverride();
      syncStokVisibility();
            // Toggle Harga Ojol & Topping (aktif jika punya nilai)
            document.getElementById('menuOjolToggle').checked = !!m.hargaOjol;
            document.getElementById('menuToppingToggle').checked = !!(m.toppingList || '');
            document.getElementById('menuOjolToggle').onchange = syncOjolVisibility;
            document.getElementById('menuToppingToggle').onchange = syncToppingVisibility;
            bindOjolToppingToggles();
            syncOjolVisibility();
            syncToppingVisibility();
          } else {
      document.getElementById('editMenuId').value = '';
      document.getElementById('menuModalTitle').textContent = '🍽️ Tambah Menu';
      document.getElementById('menuNama').value = '';
      document.getElementById('menuKategori').value = 'Makanan';
      document.getElementById('menuHargaJual').value = '';
      document.getElementById('menuHargaModal').value = '';
      document.getElementById('menuToppingList').value = '';
      document.getElementById('menuHargaOjol').value = '';
      document.getElementById('menuSuplayerVal').value = 'Umum';
      document.getElementById('menuPakaiStok').checked = false;
      document.getElementById('menuStok').value = '';
      await populateSuplayerSelect('Umum');
      await populateKategoriSelect('Makanan');
      document.getElementById('menuSuplayerSelect').onchange = syncPakaiStokToggle; // onchange agar tidak menumpuk listener (audit 2026-08-19)
      document.getElementById('menuPakaiStok').onchange = syncStokVisibility;
      bindPakaiStokUserOverride();
      syncStokVisibility();
            // Toggle Harga Ojol & Topping default mati
            document.getElementById('menuOjolToggle').checked = false;
            document.getElementById('menuToppingToggle').checked = false;
            document.getElementById('menuOjolToggle').onchange = syncOjolVisibility;
            document.getElementById('menuToppingToggle').onchange = syncToppingVisibility;
            bindOjolToppingToggles();
            syncOjolVisibility();
            syncToppingVisibility();
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

// ── Konsinyasi helpers ───────────────────────────────────────────────────────

const _CAT_OPTIONS = ['Makanan','Minuman','Snack','Lainnya','Titipan'];

export function escapeAttr(v) {
  return String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function populateSuplayerSelect(selected) {
  const sel = document.getElementById('menuSuplayerSelect');
  const custom = (await getSetting('suplayerCustom', [])) || [];
  sel.innerHTML = '<option value="Umum">🏠 Umum</option>' +
    custom.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
  sel.value = selected || 'Umum';
  await renderSuplayerAcc();
}

async function populateKategoriSelect(selected) {
  const sel = document.getElementById('menuKategori');
  const custom = (await getSetting('kategoriCustom', [])) || [];
  sel.innerHTML = _CAT_OPTIONS.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(catLabel(c))}</option>`).join('') +
    custom.map(c => `<option value="${escapeHtml(c)}">📦 ${escapeHtml(c)}</option>`).join('');
  sel.value = selected || 'Makanan';
  await renderKategoriOptions();
}

// ── Accordion Kategori & Suplayer di form menu ───────────────────────────────
// Opsi dirender sebagai tombol chip; mengkliknya memilih nilai & mencatatnya
// ke select tersembunyi (agar saveMenu/syncPakaiStokToggle tetap bekerja).

async function renderKategoriOptions(selectedVal) {
  const box = document.getElementById('menuKategoriOptions');
  const sel = document.getElementById('menuKategori');
  if (!box || !sel) return;
  const custom = (await getSetting('kategoriCustom', [])) || [];
  const opts = [..._CAT_OPTIONS, ...custom];
  box.innerHTML = opts.map(v => {
    const label = custom.includes(v) ? '📦 ' + v : catLabel(v);
    return `<button type="button" class="acc-opt${v === sel.value ? ' selected' : ''}" data-action="pick-kategori" data-value="${escapeAttr(v)}">${escapeHtml(label)}</button>`;
  }).join('') || '<span class="acc-empty">Belum ada kategori</span>';
  box.insertAdjacentHTML('beforeend',
    `<button type="button" class="acc-add" data-action="add-kategori-custom">＋ Tambah Kategori</button>`);
  updateTrigger('menuKategoriTriggerVal', catLabel(sel.value));
}

async function renderSuplayerAcc(selVal) {
  const box = document.getElementById('menuSuplayerOptions');
  const sel = document.getElementById('menuSuplayerSelect');
  if (!box || !sel) return;
  const custom = (await getSetting('suplayerCustom', [])) || [];
  const opts = ['Umum', ...custom];
  box.innerHTML = opts.map(v => {
    const label = v === 'Umum' ? '🏠 Umum' : v;
    return `<button type="button" class="acc-opt${v === sel.value ? ' selected' : ''}" data-action="pick-suplayer" data-value="${escapeAttr(v)}">${escapeHtml(label)}</button>`;
  }).join('');
  box.insertAdjacentHTML('beforeend',
    `<button type="button" class="acc-add" data-action="add-suplayer-custom">＋ Tambah Suplayer</button>`);
  updateTrigger('menuSuplayerTriggerVal', sel.value === 'Umum' ? '🏠 Umum' : sel.value);
}

function updateTrigger(elId, labelText) {
  const el = document.getElementById(elId);
  if (el) el.textContent = labelText;
}

// Fungsi publik: pilih opsi kategori dari accordion
export async function pickKategori(value) {
  const sel = document.getElementById('menuKategori');
  if (!sel) return;
  sel.value = value;
  await renderKategoriOptions(value);
  const acc = document.getElementById('menuKategoriAcc');
  acc?.closest('.acc')?.classList.remove('open');
}

// Fungsi publik: pilih opsi suplayer dari accordion
export async function pickSuplayer(value) {
  const sel = document.getElementById('menuSuplayerSelect');
  if (!sel) return;
  sel.value = value;
  await renderSuplayerAcc(value);
  const acc = document.getElementById('menuSuplayerAcc');
  acc?.closest('.acc')?.classList.remove('open');
  if (window.syncPakaiStokToggle) syncPakaiStokToggle();
}

export async function addCustomSuplayer() {
  const name = prompt('Nama suplayer baru:').trim();
  if (!name || name === 'Umum') {
    if (name === 'Umum') showToast('Nama "Umum" sudah ada!', 'error');
    return;
  }
  const custom = (await getSetting('suplayerCustom', [])) || [];
  if (custom.includes(name)) { showToast('Suplayer sudah ada!', 'error'); return; }
  custom.push(name);
  await setSetting('suplayerCustom', custom);
  await populateSuplayerSelect(name);
  showToast(`✅ Suplayer "${name}" ditambahkan`);
}

export async function addCustomKategori() {
  const name = prompt('Nama kategori baru:').trim();
  if (!name) return;
  const all = [..._CAT_OPTIONS, ...((await getSetting('kategoriCustom', [])) || [])];
  if (all.includes(name)) { showToast('Kategori sudah ada!', 'error'); return; }
  const custom = (await getSetting('kategoriCustom', [])) || [];
  custom.push(name);
  await setSetting('kategoriCustom', custom);
  await populateKategoriSelect(name);
  showToast(`✅ Kategori "${name}" ditambahkan`);
}

// ── Stok toggle: auto-on saat suplayer ≠ Umum, hormati override user ──────
export function syncPakaiStokToggle() {
  const sel = document.getElementById('menuSuplayerSelect');
  const cb = document.getElementById('menuPakaiStok');
  if (!sel || !cb) return;
  // Pakai Stok boleh auto-on saat ganti suplayer ke non-Umum,
  // tapi hormati pilihan user jika user pernah mengaktifkan/menonaktifkan secara manual.
  if (sel.value && sel.value !== 'Umum') {
    if (cb.dataset.userSet !== '1') {
      cb.checked = true;
    }
  } else {
    // Suplayer kembali ke Umum → jika user belum pernah override, matikan juga.
    if (cb.dataset.userSet !== '1') {
      cb.checked = false;
    }
  }
  syncStokVisibility();
}

export function syncStokVisibility() {
  const cb = document.getElementById('menuPakaiStok');
  const wrap = document.getElementById('menuStokWrap');
  if (!cb || !wrap) return;
  wrap.style.display = cb.checked ? 'block' : 'none';
}

// Tandai bahwa user pernah meng-toggle Pakai Stok secara manual.
// Dipasang sekali saat form dibuka (lihat openMenuForm/openMenuFormBaru) agar
// auto-on di syncPakaiStokToggle tidak memaksa menyalakan checkbox.
export function bindPakaiStokUserOverride() {
  const cb = document.getElementById('menuPakaiStok');
  if (!cb || cb.dataset.bound === '1') return;
  cb.dataset.bound = '1';
  const onUser = () => { cb.dataset.userSet = cb.checked ? '1' : '0'; };
  cb.addEventListener('change', onUser);
  // Inisialisasi userSet sesuai kondisi awal checkbox (mode edit)
  cb.dataset.userSet = cb.checked ? '1' : '0';
}

// ── Toggle Harga Ojol & Topping (pola sama dgn Pakai Stok) ──────────────────
export function syncOjolVisibility() {
  const cb = document.getElementById('menuOjolToggle');
  const wrap = document.getElementById('menuOjolWrap');
  if (!cb || !wrap) return;
  wrap.style.display = cb.checked ? 'block' : 'none';
}

export function syncToppingVisibility() {
  const cb = document.getElementById('menuToppingToggle');
  const wrap = document.getElementById('menuToppingWrap');
  if (!cb || !wrap) return;
  wrap.style.display = cb.checked ? 'block' : 'none';
}

export function bindOjolToppingToggles() {
  const ojol = document.getElementById('menuOjolToggle');
  const top = document.getElementById('menuToppingToggle');
  if (ojol && !ojol.dataset.bound) { ojol.dataset.bound = '1'; ojol.addEventListener('change', syncOjolVisibility); }
  if (top && !top.dataset.bound) { top.dataset.bound = '1'; top.addEventListener('change', syncToppingVisibility); }
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
  let kategori = document.getElementById('menuKategori').value;
  const hargaJual = parseInt(document.getElementById('menuHargaJual').value) || 0;
  const hargaModal = parseInt(document.getElementById('menuHargaModal').value) || 0;
  const hargaOjol = parseInt(document.getElementById('menuHargaOjol').value) || 0;
  const toppingRaw = document.getElementById('menuToppingList').value || '';
  const toppingList = buildToppingListString(parseToppingTextarea(toppingRaw));
  const suplayer = document.getElementById('menuSuplayerSelect').value || 'Umum';
  const pakaiStok = document.getElementById('menuPakaiStok').checked ? 1 : 0;
  const stok = pakaiStok ? Math.max(0, parseInt(document.getElementById('menuStok').value) || 0) : 0;

  if (!nama) { showToast('Nama menu harus diisi!', 'error'); return; }
  if (hargaJual <= 0) { showToast('Harga jual harus diisi!', 'error'); return; }

  // (Audit 2026-08-19) Dihapus: auto-overwrite kategori jadi 'Titipan' menghapus pilihan user.
  // Penandaan titipan cukup dari field suplayer (lihat badge di daftar & laporan konsinyasi).

  const updateData = { nama, kategori, hargaJual, hargaModal, hargaOjol, toppingList, suplayer, pakaiStok, stok };
  if (id) {
    // Pertahankan retur yang sudah ada; jangan overwrite
    const existing = await DB.menu.get(parseInt(id));
    if (existing) updateData.retur = existing.retur || 0;
    await DB.menu.update(parseInt(id), updateData);
    showToast('✅ Menu diperbarui!');
  } else {
    await DB.menu.add({ ...updateData, aktif: 1, urutan: Date.now(), retur: 0 });
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

// ── Retur Barang ─────────────────────────────────────────────────────────────

export async function openReturModal(id) {
  const m = await DB.menu.get(id);
  if (!m) return;
  document.getElementById('returMenuId').value = id;
  document.getElementById('returMenuInfo').innerHTML =
    `<b>${escapeHtml(m.nama)}</b> — Suplayer: ${escapeHtml(m.suplayer || 'Umum')}<br>Stok saat ini: <b>${m.stok ?? 0}</b>`;
  document.getElementById('returQty').value = '';
  await openModal('returModal');
  document.getElementById('returQty').focus();
}

export function closeReturModal() {
  closeModal('returModal');
}

export async function confirmRetur() {
  const id = parseInt(document.getElementById('returMenuId').value);
  const qty = parseInt(document.getElementById('returQty').value) || 0;
  if (qty <= 0) { showToast('Jumlah retur harus > 0', 'error'); return; }
  const m = await DB.menu.get(id);
  if (!m) return;
  if (qty > (m.stok || 0)) { showToast('Jumlah retur melebihi stok!', 'error'); return; }
  const newStok = Math.max(0, (m.stok || 0) - qty);
  const newRetur = (m.retur || 0) + qty;
  await DB.menu.update(id, { stok: newStok, retur: newRetur });
  closeReturModal();
  showToast(`✅ Retur ${qty}x "${m.nama}" dicatat`);
  await renderMenuList();
  if (currentPage === 'jualan') loadPOS();
}

// Export debounced version for oninput handler
export const renderMenuListDebounced = _debouncedRenderMenuList;
