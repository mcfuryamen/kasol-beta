/**
 * Admin Console — Catalog Module
 * Supabase-backed product grid + sheet editor. IDs preserved.
 */

import { STATE, subscribe, setState } from './app-state.js';
import { formatRupiah, escapeHtml } from './utils.js';
import { showToast } from './toast.js';

let catalogGrid, catalogEmpty, addAppBtn;

const getSupabaseConfig = () => ({
  url: window.SUPABASE_URL || 'https://hhywrvedlwljawgxzpkq.supabase.co',
  key: window.SUPABASE_SERVICE_KEY || ''
});

async function fetchProductsFromSupabase() {
  try {
    const { url, key } = getSupabaseConfig();
    const r = await fetch(`${url}/rest/v1/products?order=order_index.asc`, { headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } });
    if (!r.ok) return [];
    const products = await r.json();
    return products.map(p => ({
      id: p.id, appType: p.app_type, icon: p.icon || '📦', name: p.name, desc: p.description || '',
      price: parseInt(p.price_label?.replace(/\D/g,'')||'0',10), category: getCategoryFromAppType(p.app_type),
      hot: p.order_index === 0, orderIndex: p.order_index, visible: p.visible
    }));
  } catch { return []; }
}

function getCategoryFromAppType(t){
  if (['retail','rosok','gerobak','kaki5','konveksi','bengkel'].includes(t)) return 'bisnis';
  if (['klinik','apotek'].includes(t)) return 'kesehatan';
  return 'institusi';
}

export async function initCatalog() {
  catalogGrid = document.getElementById('catalogList');
  catalogEmpty = document.getElementById('catalogEmpty');
  addAppBtn = document.querySelector('[onclick="openCatalogSheet()"]');
  if (!catalogGrid) return;
  addAppBtn?.addEventListener('click', () => openCatalogSheet());
  const products = await fetchProductsFromSupabase();
  setState('catalog', products);
  subscribe('catalog', renderCatalog);
  renderCatalog();
}

export function renderCatalog() {
  if (!catalogGrid || !catalogEmpty) return;
  const apps = STATE.catalog || [];
  if (!apps.length) { catalogGrid.innerHTML = ''; catalogEmpty.hidden = false; return; }
  catalogEmpty.hidden = true;
  const sc = document.getElementById('sideCountCatalog'); if (sc) sc.textContent = apps.length;
  catalogGrid.innerHTML = apps.map((app, idx) => `
    <article class="product-card" data-idx="${idx}" data-id="${escapeHtml(app.id)}">
      <div class="product-cover">${escapeHtml(app.icon||'📦')}</div>
      <div class="product-body">
        <div class="product-name">${escapeHtml(app.name||'Aplikasi Baru')}</div>
        <div class="product-desc">${escapeHtml(app.desc||'')}</div>
        <div class="product-foot">
          <div>
            <div class="product-price">${formatRupiah(app.price||0)}</div>
            <div class="product-tag">${getCategoryLabel(app.category)}</div>
          </div>
          ${app.hot?'<span class="hot-badge">🔥 Hot</span>':''}
        </div>
      </div>
      <div class="product-actions">
        <button class="btn btn-outline btn-sm" onclick="event.stopPropagation();openCatalogSheet(${idx})">✏️ Edit</button>
        <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();deleteCatalogApp(${idx})">🗑️ Hapus</button>
      </div>
    </article>`).join('');
  catalogGrid.querySelectorAll('.product-card').forEach(card =>
    card.addEventListener('click', () => openCatalogSheet(parseInt(card.dataset.idx))));
}

function getCategoryLabel(c){return {bisnis:'💼 Bisnis',institusi:'🏛️ Institusi',kesehatan:'🏥 Kesehatan'}[c]||c;}

window.openCatalogSheet = function(idx = null) {
  const isEdit = idx !== null;
  const app = isEdit ? (STATE.catalog||[])[idx] : { id:null, icon:'📦', name:'', desc:'', price:0, category:'bisnis', hot:false, appType:'', orderIndex:(STATE.catalog||[]).length };
  const overlay = document.getElementById('catalogSheetOverlay') || document.getElementById('catalogSheet');
  const sheet = document.getElementById('catalogSheet');
  if (!sheet) return;
  sheet.innerHTML = `
    <div class="sheet-head"><h3>${isEdit?'Edit Aplikasi':'Tambah Aplikasi'}</h3><button class="sheet-x" onclick="closeCatalogSheet()">✕</button></div>
    <div class="field-grid-2">
      <div class="field"><label class="field-label">App Type (ID)</label><input id="catAppType" value="${escapeHtml(app.appType||'')}" placeholder="rosok" ${isEdit?'readonly':''}></div>
      <div class="field"><label class="field-label">Ikon</label><input id="catIcon" value="${escapeHtml(app.icon)}" maxlength="4" placeholder="📦"></div>
      <div class="field field-span-2"><label class="field-label">Nama Aplikasi</label><input id="catName" value="${escapeHtml(app.name)}" placeholder="Kasir Solo"></div>
      <div class="field field-span-2"><label class="field-label">Deskripsi</label><textarea id="catDesc" rows="3">${escapeHtml(app.desc)}</textarea></div>
      <div class="field"><label class="field-label">Kategori</label>
        <select id="catCategory">
          <option value="bisnis" ${app.category==='bisnis'?'selected':''}>💼 Bisnis</option>
          <option value="institusi" ${app.category==='institusi'?'selected':''}>🏛️ Institusi</option>
          <option value="kesehatan" ${app.category==='kesehatan'?'selected':''}>🏥 Kesehatan</option>
        </select></div>
      <div class="field"><label class="field-label">Harga</label><input id="catPrice" type="number" value="${app.price||0}" min="0" step="10000"></div>
      <div class="field"><label class="field-label">Hot</label><input type="checkbox" id="catHot" ${app.hot?'checked':''}> Tampil badge</div>
      <div class="field"><label class="field-label">Order</label><input id="catOrderIndex" type="number" value="${app.orderIndex||0}" min="0"></div>
    </div>
    <div class="row-actions mt12">
      <button class="btn btn-outline" onclick="closeCatalogSheet()">Batal</button>
      <button class="btn btn-primary" onclick="saveCatalogApp(${idx})">${isEdit?'Simpan':'Tambah'}</button>
    </div>`;
  openOverlay('catalogSheet');
  setTimeout(() => document.getElementById('catName')?.focus(), 100);
};

window.closeCatalogSheet = function(){ closeOverlay('catalogSheet'); };

window.saveCatalogApp = async function(idx = null) {
  const appType = document.getElementById('catAppType')?.value.trim()||'';
  const icon = document.getElementById('catIcon')?.value.trim().slice(0,4)||'📦';
  const name = document.getElementById('catName')?.value.trim()||'Aplikasi Baru';
  const desc = document.getElementById('catDesc')?.value.trim()||'';
  const category = document.getElementById('catCategory')?.value||'bisnis';
  const price = parseInt(document.getElementById('catPrice')?.value)||0;
  const hot = document.getElementById('catHot')?.checked||false;
  const orderIndex = parseInt(document.getElementById('catOrderIndex')?.value)||0;
  const isEdit = idx !== null;
  if (!isEdit && !appType) { showToast('App Type wajib', 2000, 'error'); return; }
  const payload = { app_type:appType, name, tagline:`${name} - Sistem Terbaik`, description:desc, price_label:`Rp ${price.toLocaleString('id-ID')}`, features:[], icon, color:'#F5821F', order_index:orderIndex, visible:true };
  const { url, key } = getSupabaseConfig();
  try {
    const r = isEdit
      ? await fetch(`${url}/rest/v1/products?id=eq.${(STATE.catalog||[])[idx].id}`, { method:'PATCH', headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=representation'}, body:JSON.stringify(payload) })
      : await fetch(`${url}/rest/v1/products`, { method:'POST', headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',Prefer:'return=representation'}, body:JSON.stringify(payload) });
    if (r.ok) { setState('catalog', await fetchProductsFromSupabase()); showToast(isEdit?'Diperbarui':'Ditambahkan', 2000, 'success'); closeCatalogSheet(); }
    else showToast('Gagal simpan', 2000, 'error');
  } catch { showToast('Error menyimpan', 2000, 'error'); }
};

window.deleteCatalogApp = async function(idx) {
  if (!confirm('Hapus aplikasi ini?')) return;
  const app = (STATE.catalog||[])[idx];
  const { url, key } = getSupabaseConfig();
  try {
    const r = await fetch(`${url}/rest/v1/products?id=eq.${app.id}`, { method:'DELETE', headers:{apikey:key,Authorization:`Bearer ${key}`} });
    if (r.ok || r.status === 204) { setState('catalog', await fetchProductsFromSupabase()); showToast(`${app.name} dihapus`, 2000, 'success'); }
    else showToast('Gagal hapus', 2000, 'error');
  } catch { showToast('Error hapus', 2000, 'error'); }
};

// overlay helpers (shared)
function openOverlay(id){ const o=document.getElementById(id); if(o){o.classList.add('open'); document.body.style.overflow='hidden';} }
function closeOverlay(id){ const o=document.getElementById(id); if(o){o.classList.remove('open'); document.body.style.overflow='';} }
