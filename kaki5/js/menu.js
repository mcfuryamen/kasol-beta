// ==================== MENU MANAGEMENT (ESM) ====================
import { DB, getSetting, setSetting } from './db.js';
import { escapeHtml, formatRp, showToast } from './helpers.js';
import { currentPage } from './app-state.js';
import { showConfirm } from './confirm.js';
import { loadPOS } from './pos.js';
import { getOjolRows } from './pos.logic.js';
import { openModal, closeModal, isModalOpen } from './modal.js';

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
  // Null-guard: elemen statis, tapi render tidak boleh mati total kalau
  // DOM belum siap (TypeError di sini = daftar kosong tanpa pesan).
  const searchEl = document.getElementById('searchMenuList');
  const search = ((searchEl && searchEl.value) || '').toLowerCase();
  let allMenus;
  try {
    allMenus = await DB.menu.toArray();
  } catch (e) {
    // DB gagal dibaca (mis. Dexie open tertunda saat update): tampilkan
    // error state + tombol coba lagi — JANGAN biarkan daftar kosong diam.
    console.error('[MENU] Gagal memuat daftar menu:', e?.message || e);
    const errBox = document.getElementById('menuListContainer');
    if (errBox) errBox.innerHTML = '<div class="empty-state" data-action="retry-menu-list" role="button" tabindex="0" style="cursor:pointer"><div class="empty-icon">⚠️</div><div class="empty-text">Gagal memuat menu.<br>Ketuk di sini untuk coba lagi.</div></div>';
    return;
  }
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
      // Kartu menu = akordeon (auto close): ketuk baris -> aksi terbuka di panel;
      // kanan trigger = harga jual tanpa label (permintaan pemilik 2026-08-29).
      // Dim (stok habis/jeda) HANYA di baris trigger — panel tombol aksi tetap
      // terang & jelas fungsional (permintaan pemilik 2026-08-31).
      html += `<div class="acc acc-menu">
        <div class="trx-item acc-trigger${isDim ? ' dimmed' : ''}" role="button" tabindex="0" data-action="toggle-menu-acc" data-menu-id="${m.id}">
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
          <div class="menu-acc-price">${formatRp(m.hargaJual)}</div>
          <span class="acc-caret">▾</span>
        </div>
        <div class="acc-panel" id="menuAcc-${m.id}">
          <div class="acc-inner">
            <div class="menu-acc-actions">
              ${isTitipan && m.pakaiStok ? `<button class="btn-icon btn-ghost kwh44 kgreen" data-action="retur-menu" data-menu-id="${m.id}" title="Retur">↩️</button>` : ''}
              <button class="btn-icon btn-ghost kwh44" data-action="open-menu-form" data-menu-id="${m.id}" title="Edit">✏️</button>
              <button class="btn-icon btn-ghost kwh44" data-action="toggle-menu" data-menu-id="${m.id}" title="${m.aktif?'Jeda':'Aktifkan'}">${m.aktif?'⏸️':'▶️'}</button>
              <button class="btn-icon btn-ghost kwh44 kred" data-action="confirm-delete-menu" data-menu-id="${m.id}" title="Hapus">🗑️</button>
            </div>
          </div>
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

// DOM null-safe helper — setelemen properti tanpa crash bila elemen belum
// ada di DOM (mis. form modal belum ter-render / stale cache). Audit error
// console "Cannot set properties of null (setting 'checked')" (2026-08-28).
function setElemChecked(id, val) {
  const el = document.getElementById(id);
  if (el) el.checked = !!val;
}
function setElemValue(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val ?? '';
}
function setElemOnChange(id, fn) {
  const el = document.getElementById(id);
  if (el) el.onchange = fn;
}

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
      setElemValue('editMenuId', id);
      const titleEl = document.getElementById('menuModalTitle');
      if (titleEl) titleEl.textContent = '✏️ Edit Menu';
      setElemValue('menuNama', m.nama);
      setElemValue('menuKategori', m.kategori);
      setElemValue('menuHargaJual', m.hargaJual);
      setElemValue('menuHargaModal', m.hargaModal);
      // Topping list: render sebagai baris grid
      const toppings = parseToppingList(m.toppingList);
      renderToppingRows(toppings);
      // Harga ojol per-app: render sebagai baris grid (ala topping).
      // Data lama (hargaOjol angka) otomatis terbaca sebagai baris "Lainnya".
      renderOjolRows(getOjolRows(m));
      // Konsinyasi
      const suplayer = m.suplayer || 'Umum';
      setElemValue('menuSuplayerVal', suplayer);
      setElemChecked('menuPakaiStok', !!m.pakaiStok);
      setElemValue('menuStok', m.stok ?? '');
      // Setelah suplayer di-set, baru populate select + select value
      await populateSuplayerSelect(suplayer);
      await populateKategoriSelect(m.kategori);
      // Auto-on Pakai Stok saat suplayer ≠ Umum
      setElemOnChange('menuSuplayerSelect', syncPakaiStokToggle); // onchange agar tidak menumpuk listener (audit 2026-08-19)
      setElemOnChange('menuPakaiStok', syncStokVisibility);
      bindPakaiStokUserOverride();
      syncStokVisibility();
            // Toggle Harga Ojol & Topping (aktif jika punya nilai)
            setElemChecked('menuOjolToggle', !!m.hargaOjol);
            setElemChecked('menuToppingToggle', toppings.length > 0);
            setElemOnChange('menuOjolToggle', syncOjolVisibility);
            setElemOnChange('menuToppingToggle', syncToppingVisibility);
            bindOjolToppingToggles();
            syncOjolVisibility();
            syncToppingVisibility();
          } else {
      setElemValue('editMenuId', '');
      const titleEl = document.getElementById('menuModalTitle');
      if (titleEl) titleEl.textContent = '🍽️ Tambah Menu';
      setElemValue('menuNama', '');
      setElemValue('menuKategori', 'Makanan');
      setElemValue('menuHargaJual', '');
      setElemValue('menuHargaModal', '');
      renderToppingRows([]);
      renderOjolRows([]);
      setElemValue('menuSuplayerVal', 'Umum');
      setElemChecked('menuPakaiStok', false);
      setElemValue('menuStok', '');
      await populateSuplayerSelect('Umum');
      await populateKategoriSelect('Makanan');
      setElemOnChange('menuSuplayerSelect', syncPakaiStokToggle); // onchange agar tidak menumpuk listener (audit 2026-08-19)
      setElemOnChange('menuPakaiStok', syncStokVisibility);
      bindPakaiStokUserOverride();
      syncStokVisibility();
            // Toggle Harga Ojol & Topping default mati
            setElemChecked('menuOjolToggle', false);
            setElemChecked('menuToppingToggle', false);
            setElemOnChange('menuOjolToggle', syncOjolVisibility);
            setElemOnChange('menuToppingToggle', syncToppingVisibility);
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

// ── Topping Grid (2 kolom: Nama | Harga) ─────────────────────────────────────

function renderToppingRows(toppings) {
  const grid = document.getElementById('menuToppingGrid');
  if (!grid) return;
  grid.innerHTML = '';
  (toppings && toppings.length ? toppings : [{ nama: '', harga: 0 }]).forEach((t, i) => {
    addToppingRowTo(grid, t.nama, t.harga, i);
  });
}

function addToppingRowTo(grid, nama, harga, idx) {
  const row = document.createElement('div');
  row.className = 'topping-grid-row';
  row.innerHTML =
    `<input class="form-input topping-nama" type="text" placeholder="Nama topping" value="${escapeAttr(nama || '')}">` +
    `<input class="form-input topping-harga" type="number" inputmode="numeric" placeholder="Harga" value="${harga || ''}">` +
    `<button class="topping-rm-btn" type="button" data-action="remove-topping-row" title="Hapus">✕</button>`;
  grid.appendChild(row);
}

function collectToppingGrid() {
  const rows = document.querySelectorAll('#menuToppingGrid .topping-grid-row');
  const result = [];
  rows.forEach(r => {
    const nama = (r.querySelector('.topping-nama') || {}).value || '';
    const harga = parseInt((r.querySelector('.topping-harga') || {}).value) || 0;
    if (nama.trim()) result.push({ nama: nama.trim(), harga });
  });
  return result;
}

// ── Harga Ojol Grid (pola sama dgn topping: baris nama app | harga + hapus) ──

function renderOjolRows(rows) {
  const grid = document.getElementById('menuOjolGrid');
  if (!grid) return;
  grid.innerHTML = '';
  (rows && rows.length ? rows : [{ nama: '', harga: 0 }]).forEach(r => {
    addOjolRowTo(grid, r.nama, r.harga);
  });
}

function addOjolRowTo(grid, nama, harga) {
  const row = document.createElement('div');
  row.className = 'topping-grid-row'; // reuse CSS grid baris topping
  row.innerHTML =
    `<input class="form-input ojol-nama" type="text" placeholder="Nama app (mis. GoFood)" value="${escapeAttr(nama || '')}">` +
    `<input class="form-input ojol-harga" type="number" inputmode="numeric" placeholder="Harga" value="${harga || ''}">` +
    `<button class="topping-rm-btn" type="button" data-action="remove-ojol-row" title="Hapus">✕</button>`;
  grid.appendChild(row);
}

function collectOjolGrid() {
  const rows = document.querySelectorAll('#menuOjolGrid .topping-grid-row');
  const result = [];
  rows.forEach(r => {
    const nama = (r.querySelector('.ojol-nama') || {}).value || '';
    const harga = parseInt((r.querySelector('.ojol-harga') || {}).value) || 0;
    if (nama.trim()) result.push({ nama: nama.trim(), harga: Math.max(0, harga) });
  });
  return result;
}

window.addEventListener('click', e => {
  const rm = e.target.closest('[data-action="remove-topping-row"]');
  if (rm) { rm.closest('.topping-grid-row')?.remove(); return; }
  const add = e.target.closest('[data-action="add-topping-row"]');
  if (add) {
    const grid = document.getElementById('menuToppingGrid');
    if (grid) addToppingRowTo(grid, '', 0, grid.children.length);
  }
  // Harga Ojol per-app: hapus & tambah baris
  const rmo = e.target.closest('[data-action="remove-ojol-row"]');
  if (rmo) { rmo.closest('.topping-grid-row')?.remove(); return; }
  const ado = e.target.closest('[data-action="add-ojol-row"]');
  if (ado) {
    const grid = document.getElementById('menuOjolGrid');
    if (grid) addOjolRowTo(grid, '', 0);
  }
});

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

// ── Input dialog (pengganti window.prompt — tidak didukung embedded browser) ──
let _inputDialogOkHandler = null;
let _inputDialogCancelHandler = null;
let _inputDialogKeyHandler = null;
let _inputDialogCb = null;

export function showInputDialog({ icon = '✏️', title = 'Masukkan nama', placeholder = '', value = '', okText = 'Simpan', callback } = {}) {
  const field = document.getElementById('inputDialogField');
  const okBtn = document.getElementById('inputDialogOk');
  const cancelBtn = document.getElementById('inputDialogCancel');
  const titleEl = document.getElementById('inputDialogTitle');
  const iconEl = document.getElementById('inputDialogIcon');
  if (!field || !okBtn) return;

  if (iconEl) iconEl.textContent = icon;
  if (titleEl) titleEl.textContent = title;
  field.placeholder = placeholder || '';
  field.value = value || '';
  okBtn.textContent = okText || 'Simpan';
  _inputDialogCb = callback;

  // Bersihkan handler lama (modal bisa dibuka berulang)
  if (_inputDialogOkHandler) okBtn.removeEventListener('click', _inputDialogOkHandler);
  if (_inputDialogCancelHandler) cancelBtn.removeEventListener('click', _inputDialogCancelHandler);
  if (_inputDialogKeyHandler) document.removeEventListener('keydown', _inputDialogKeyHandler);

  const submit = () => {
    const val = field.value.trim();
    // Simpan callback dulu: closeInputDialog() me-null-kan _inputDialogCb
    // (sama seperti pola confirm.js), jadi baca sebelum ditutup — kalau tidak,
    // tombol Tambah tidak pernah menyimpan data (bug v122: kategori/suplayer
    // custom tidak tersimpan).
    const cb = _inputDialogCb;
    closeInputDialog();
    if (cb) cb(val);
  };
  const cancel = () => closeInputDialog();
  const keyHandler = (e) => {
    // Jangan aktif kalau modal sudah ditutup jalur lain (navbar/Escape modal.js)
    if (!isModalOpen('inputDialog')) return;
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
    else if (e.key === 'Escape') cancel();
  };
  _inputDialogOkHandler = submit;
  _inputDialogCancelHandler = cancel;
  _inputDialogKeyHandler = keyHandler;
  okBtn.addEventListener('click', submit);
  cancelBtn.addEventListener('click', cancel);
  document.addEventListener('keydown', keyHandler);

  openModal('inputDialog', { modalSelector: '.confirm-box' });
  field.focus();
}

export function closeInputDialog() {
  closeModal('inputDialog');
  const okBtn = document.getElementById('inputDialogOk');
  const cancelBtn = document.getElementById('inputDialogCancel');
  if (_inputDialogOkHandler && okBtn) okBtn.removeEventListener('click', _inputDialogOkHandler);
  if (_inputDialogCancelHandler && cancelBtn) cancelBtn.removeEventListener('click', _inputDialogCancelHandler);
  if (_inputDialogKeyHandler) document.removeEventListener('keydown', _inputDialogKeyHandler);
  _inputDialogOkHandler = _inputDialogCancelHandler = _inputDialogKeyHandler = null;
  const field = document.getElementById('inputDialogField');
  if (field) field.value = '';
  _inputDialogCb = null;
}

export function addCustomSuplayer() {
  showInputDialog({
    icon: '🏠',
    title: 'Nama suplayer baru',
    placeholder: 'mis. Toko Sumber Rejeki',
    okText: 'Tambah',
    callback: async (name) => {
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
  });
}

export function addCustomKategori() {
  showInputDialog({
    icon: '🏷️',
    title: 'Nama kategori baru',
    placeholder: 'mis. Cemilan',
    okText: 'Tambah',
    callback: async (name) => {
      if (!name) return;
      const all = [..._CAT_OPTIONS, ...((await getSetting('kategoriCustom', [])) || [])];
      if (all.includes(name)) { showToast('Kategori sudah ada!', 'error'); return; }
      const custom = (await getSetting('kategoriCustom', [])) || [];
      custom.push(name);
      await setSetting('kategoriCustom', custom);
      await populateKategoriSelect(name);
      showToast(`✅ Kategori "${name}" ditambahkan`);
    }
  });
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
  const on = cb.checked;
  wrap.style.display = on ? 'block' : 'none';
  // v170 (komentar browser 2026-09-05 #2): saklar mati ⇒ NILAINYA JADI NOL, bukan
  // cuma tersembunyi. Angka yang tertinggal di input bikin status "stok" terasa
  // masih ada padahal fiturnya dimatikan. saveMenu() juga memaksa 0 (jaring dua).
  if (!on) {
    const el = document.getElementById('menuStok');
    if (el) el.value = '';
  }
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
// v170 (komentar browser 2026-09-05 #3 #4): sama seperti Pakai Stok — saklar mati
// membuat NILAINYA HILANG (baris grid dibersihkan), bukan hanya disembunyikan.
// Tanpa ini baris lama tetap tertinggal di DOM dan ikut tersimpan saat "Simpan".
export function syncOjolVisibility() {
  const cb = document.getElementById('menuOjolToggle');
  const wrap = document.getElementById('menuOjolWrap');
  if (!cb || !wrap) return;
  const on = cb.checked;
  wrap.style.display = on ? 'block' : 'none';
  if (!on) renderOjolRows([]);
}

export function syncToppingVisibility() {
  const cb = document.getElementById('menuToppingToggle');
  const wrap = document.getElementById('menuToppingWrap');
  if (!cb || !wrap) return;
  const on = cb.checked;
  wrap.style.display = on ? 'block' : 'none';
  if (!on) renderToppingRows([]);
}

export function bindOjolToppingToggles() {
  const ojol = document.getElementById('menuOjolToggle');
  const top = document.getElementById('menuToppingToggle');
  if (ojol && !ojol.dataset.bound) { ojol.dataset.bound = '1'; ojol.addEventListener('change', syncOjolVisibility); }
  if (top && !top.dataset.bound) { top.dataset.bound = '1'; top.addEventListener('change', syncToppingVisibility); }
}


// Validasi hargaJual untuk menu biasa sama, tapi topping boleh harga 0 (gratis)
export async function saveMenu() {
  const id = document.getElementById('editMenuId').value;
  const nama = document.getElementById('menuNama').value.trim();
  let kategori = document.getElementById('menuKategori').value;
  const hargaJual = parseInt(document.getElementById('menuHargaJual').value) || 0;
  const hargaModal = parseInt(document.getElementById('menuHargaModal').value) || 0;
  // v170 (komentar browser 2026-09-05 #2 #3 #4): ketiga saklar jadi sumber kebenaran
  // di JALUR TULIS — kalau mati, nilainya nol/kosong apa pun yang tertinggal di DOM.
  // syncStokVisibility()/syncOjolVisibility()/syncToppingVisibility() sudah
  // membersihkan tampilannya saat saklar dimatikan; ini jaring pengaman keduanya.
  const pakaiOjol = document.getElementById('menuOjolToggle')?.checked ? 1 : 0;
  const pakaiTopping = document.getElementById('menuToppingToggle')?.checked ? 1 : 0;
  // Harga Ojol per-app: kumpulkan baris grid → JSON ojolPrices.
  // hargaOjol (field lama) = harga baris pertama — kompatibilitas laporan/nota lama.
  const ojolRows = pakaiOjol ? collectOjolGrid() : [];
  const ojolPrices = JSON.stringify(ojolRows);
  const hargaOjol = ojolRows.length > 0 ? ojolRows[0].harga : 0;
  const toppingList = pakaiTopping ? buildToppingListString(collectToppingGrid()) : '';
  const suplayer = document.getElementById('menuSuplayerSelect').value || 'Umum';
  const pakaiStok = document.getElementById('menuPakaiStok').checked ? 1 : 0;
  const stok = pakaiStok ? Math.max(0, parseInt(document.getElementById('menuStok').value) || 0) : 0;

  if (!nama) { showToast('Nama menu harus diisi!', 'error'); return; }
  if (hargaJual <= 0) { showToast('Harga jual harus diisi!', 'error'); return; }

  // (Audit 2026-08-19) Dihapus: auto-overwrite kategori jadi 'Titipan' menghapus pilihan user.
  // Penandaan titipan cukup dari field suplayer (lihat badge di daftar & laporan konsinyasi).

  const updateData = { nama, kategori, hargaJual, hargaModal, hargaOjol, ojolPrices, toppingList, suplayer, pakaiStok, stok };
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
  setReturMode('single');
  document.getElementById('returMenuId').value = id;
  renderReturInfo(m);
  document.getElementById('returQty').value = '';
  await openModal('returModal');
  document.getElementById('returQty').focus();
}

function renderReturInfo(m) {
  document.getElementById('returMenuInfo').innerHTML =
    `<b>${escapeHtml(m.nama)}</b> — Suplayer: ${escapeHtml(m.suplayer || 'Umum')}<br>Stok saat ini: <b>${m.stok ?? 0}</b>`;
}

function setReturMode(mode) {
  const single = document.getElementById('returSingleBody');
  const konso = document.getElementById('returKonsinyasiBody');
  if (single) single.style.display = mode === 'single' ? 'block' : 'none';
  if (konso) konso.style.display = mode === 'konsinyasi' ? 'block' : 'none';
}

// ── Retur konsinyasi (per suplayer) ─────────────────────────────────────────
// Satu suplayer = satu sesi retur: daftar SEMUA barang titipannya dengan
// urutan info nama | stok diterima (editable) | terjual | estimasi sisa,
// dan kotak isian "sisa riil" di paling kanan. Selisih riil vs estimasi
// memunculkan wajib catatan alasan.

function returRowHtml(m, terjual, isLast) {
  const stokAwal = m.stokAwal ?? Math.max(0, (m.stok || 0) + terjual); // rekonstruksi bila belum pernah diisi
  const est = Math.max(0, stokAwal - terjual);
  // Diterima/Terjual/Est. sisa = info saja (edit stok lewat form menu);
  // satu-satunya input = Sisa Riil di paling kanan (label di kirinya).
  return `<div class="retur-row" data-menu-id="${m.id}" data-terjual="${terjual}" data-awal="${stokAwal}" style="padding:9px 0;${isLast ? '' : 'border-bottom:1px solid var(--border)'}">
    <div style="display:flex;align-items:center;gap:8px">
      <div style="flex:1;min-width:0">
        <div style="font-weight:700;font-size:12.5px">${escapeHtml(m.nama)}</div>
        <div style="font-size:11px;color:var(--text3);margin-top:2px">Diterima <b style="color:var(--text2)">${stokAwal}</b> · Terjual <b style="color:var(--text2)">${terjual}</b> · Est. sisa <b class="retur-est" style="color:var(--primary)">${est}</b></div>
      </div>
      <div style="flex-shrink:0;display:flex;align-items:center;gap:6px">
        <span style="font-size:11px;color:var(--text3)">Sisa riil</span>
        <input class="form-input retur-in-riil" type="number" inputmode="numeric" min="0" value="${m.stok ?? 0}" style="width:58px;height:32px;padding:2px 6px;font-size:13px;font-weight:700;text-align:center">
      </div>
    </div>
    <div class="retur-note-wrap" style="display:none;margin-top:6px">
      <input class="form-input retur-in-catatan" type="text" maxlength="120" placeholder="Alasan selisih (wajib)" style="font-size:12px">
    </div>
  </div>`;
}

function recalcReturRow(row) {
  const awal = parseInt(row.dataset.awal) || 0;
  const terjual = parseInt(row.dataset.terjual) || 0;
  const est = Math.max(0, awal - terjual);
  const estEl = row.querySelector('.retur-est');
  if (estEl) estEl.textContent = est;
  const riilRaw = row.querySelector('.retur-in-riil')?.value ?? '';
  const riil = riilRaw === '' ? null : Math.max(0, parseInt(riilRaw) || 0);
  const noteWrap = row.querySelector('.retur-note-wrap');
  if (noteWrap) noteWrap.style.display = (riil !== null && riil !== est) ? 'block' : 'none';
}

export async function openKonsinyasiRetur(sp) {
  const menus = (await DB.menu.toArray()).filter(m => (m.suplayer || '') === sp);
  if (!menus.length) { showToast(`Tidak ada barang titipan dari "${sp}"`, 'error'); return; }
  // Keluar efektif = penjualan tercatat (lifetime) + akumulasi selisih dari
  // retur-retur sebelumnya. Est. sisa = stokAwal − keluar.
  const terjualMap = {};
  (await DB.penjualan.toArray()).filter(s => s.status !== 'held').forEach(s => { // v156: held belum terjual
    (s.items || []).forEach(i => { terjualMap[i.menuId] = (terjualMap[i.menuId] || 0) + (i.qty || 0); });
  });
  const keluarMap = {};
  menus.forEach(m => { keluarMap[m.id] = (terjualMap[m.id] || 0) + (m.selisihQty || 0); });
  const titleEl = document.getElementById('returModalTitle');
  if (titleEl) titleEl.textContent = `↩️ Retur — ${sp}`;
  setReturMode('konsinyasi');
  document.getElementById('returKonsinyasiRows').innerHTML =
    menus.map((m, i) => returRowHtml(m, keluarMap[m.id] || 0, i === menus.length - 1)).join('');
  // Recalc live saat input diterima / sisa riil berubah (delegasi di kontainer)
  const rowsWrap = document.getElementById('returKonsinyasiRows');
  if (rowsWrap && !rowsWrap.dataset.bound) {
    rowsWrap.dataset.bound = '1';
    rowsWrap.addEventListener('input', e => {
      const row = e.target.closest('.retur-row');
      if (row) recalcReturRow(row);
    });
  }
  await openModal('returModal');
}

async function confirmKonsinyasiRetur() {
  const rows = [...document.querySelectorAll('#returKonsinyasiRows .retur-row')];
  const hasil = [];
  for (const row of rows) {
    const id = parseInt(row.dataset.menuId);
    const m = await DB.menu.get(id);
    if (!m) continue;
    const awal = parseInt(row.dataset.awal) || 0;
    const terjual = parseInt(row.dataset.terjual) || 0; // keluar efektif (termasuk selisih lama)
    const est = Math.max(0, awal - terjual);
    const riilRaw = row.querySelector('.retur-in-riil')?.value ?? '';
    const riil = riilRaw === '' ? null : Math.max(0, parseInt(riilRaw) || 0);
    const catatanEl = row.querySelector('.retur-in-catatan');
    const selisih = riil !== null && riil !== est;
    if (selisih && !(catatanEl?.value || '').trim()) {
      showToast(`Isi alasan selisih untuk "${m.nama}"`, 'error');
      catatanEl?.focus();
      return;
    }
    hasil.push({ m, est, riil, selisih, catatan: selisih ? catatanEl.value.trim() : '' });
  }
  for (const { m, est, riil, selisih, catatan } of hasil) {
    const stokLama = m.stok || 0;
    // Retur = menutup sesi titipan: SEMUA sisa fisik dibalikkan ke suplayer
    // (stok jadi 0). Selisih riil vs estimasi = koreksi barang keluar:
    //   riil < est → ada barang keluar tak tercatat (utang bertambah)
    //   riil > est → ada kelebihan (utang berkurang)
    // Keluar efektif final = stokAwal − riil, tersimpan di selisihQty agar
    // perhitungan setoran di Laporan otomatis akurat.
    const patch = {
      stok: 0,
      retur: (m.retur || 0) + stokLama,
      selisihQty: (m.selisihQty || 0) + (est - (riil ?? 0)),
      catatanSelisih: catatan
    };
    await DB.menu.update(m.id, patch);
  }
  closeReturModal();
  showToast('✅ Retur dicatat — sisa dikembalikan, selisih masuk hitungan setoran');
  await renderMenuList();
  if (currentPage === 'jualan') loadPOS();
  if (currentPage === 'laporan') {
    const rep = await import('./laporan.js');
    await rep.loadReport();
  }
}

export function closeReturModal() {
  closeModal('returModal');
  setReturMode('single'); // reset ke mode default utk pemakaian berikutnya
  const titleEl = document.getElementById('returModalTitle');
  if (titleEl) titleEl.textContent = '↩️ Retur Barang';
}

export async function confirmRetur() {
  // Dua mode modal: konsinyasi (per suplayer, daftar semua barang) dan
  // single (per menu, dari kartu menu). Route sesuai mode aktif.
  if (document.getElementById('returKonsinyasiBody')?.style.display === 'block') {
    return confirmKonsinyasiRetur();
  }
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
  if (currentPage === 'laporan') {
    const rep = await import('./laporan.js');
    await rep.loadReport();
  }
}

// Export debounced version for oninput handler
export const renderMenuListDebounced = _debouncedRenderMenuList;
