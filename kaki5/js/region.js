// ==================== REGION PICKER — API Wilayah Indonesia ====================
// Data: https://www.emsifa.com/api-wilayah-indonesia/ (static JSON, tanpa key).
// Menyediakan rantai dropdown Provinsi → Kota/Kabupaten → Kecamatan dengan cache
// agar hemat & cepat. Hasil pilihan disimpan lewat objek `state` (pakai referensi)
// agar caller tinggal membaca .provinsi_id/.provinsi/.kabkota_id/.kabkota/...
// Bisa dipakai offline-cache manual oleh caller jika perlu.

const BASE = 'https://www.emsifa.com/api-wilayah-indonesia';
const cache = {};

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

async function getJson(url) {
  if (cache[url]) return cache[url];
  const r = await fetch(url);
  if (!r.ok) throw new Error('region ' + r.status);
  const j = await r.json();
  cache[url] = j;
  return j;
}

export function getProvinces()  { return getJson(BASE + '/api/provinsi.json'); }
export function getKabupaten(provId) { return getJson(BASE + '/api/kabupaten/' + provId + '.json'); }
export function getKecamatan(kabId)  { return getJson(BASE + '/api/kecamatan/' + kabId + '.json'); }

function fill(sel, items, placeholder, selectedId) {
  sel.innerHTML =
    '<option value="">' + esc(placeholder) + '</option>' +
    items.map(i =>
      '<option value="' + esc(i.id) + '"' + (String(i.id) === String(selectedId) ? ' selected' : '') + '>' +
      esc(i.name) + '</option>'
    ).join('');
}

/**
 * Wiring rantai 3 dropdown.
 * @param {Object} opts
 *  - provSel/kabSel/kecSel: element ATAU id string.
 *  - state: objek referensi berisi nilai awal ({provinsi_id, provinsi, ...}),
 *    sekaligus tempat hasil dibaca setelah user memilih.
 */
export function setupRegionPicker({ provSel, kabSel, kecSel, state }) {
  const pEl = typeof provSel === 'string' ? document.getElementById(provSel) : provSel;
  const kEl = typeof kabSel  === 'string' ? document.getElementById(kabSel)  : kabSel;
  const cEl = typeof kecSel  === 'string' ? document.getElementById(kecSel)  : kecSel;
  if (!pEl || !kEl || !cEl) return;
  if (!state) state = {};

  async function loadKab(provId, selectKab) {
    try {
      const items = await getKabupaten(provId);
      fill(kEl, items, 'Pilih Kota / Kabupaten', selectKab);
      kEl.disabled = false;
      if (selectKab) await loadKec(selectKab);
    } catch (e) {
      kEl.innerHTML = '<option value="">Kota tidak tersedia</option>';
    }
  }
  async function loadKec(kabId) {
    if (!kabId) {
      cEl.innerHTML = '<option value="">Pilih Kecamatan</option>';
      cEl.disabled = true;
      return;
    }
    try {
      const items = await getKecamatan(kabId);
      fill(cEl, items, 'Pilih Kecamatan', state.kecamatan_id);
      cEl.disabled = false;
    } catch (e) {
      cEl.innerHTML = '<option value="">Kecamatan tidak tersedia</option>';
    }
  }

  // muat provinsi + prefill dari state awal
  (async () => {
    pEl.innerHTML = '<option value="">Memuat provinsi...</option>';
    try {
      const provs = await getProvinces();
      fill(pEl, provs, 'Pilih Provinsi', state.provinsi_id);
      pEl.disabled = false;
      if (state.provinsi_id) await loadKab(state.provinsi_id, state.kabkota_id);
    } catch (e) {
      pEl.innerHTML = '<option value="">Gagal memuat wilayah (cek internet)</option>';
    }
  })();

  pEl.addEventListener('change', () => {
    state.provinsi_id = pEl.value;
    const o = pEl.selectedOptions[0];
    state.provinsi = o ? o.textContent : '';
    state.kabkota_id = state.kabkota = state.kecamatan_id = state.kecamatan = '';
    if (pEl.value) loadKab(pEl.value);
    else {
      kEl.innerHTML = '<option value="">Pilih Kota / Kabupaten</option>'; kEl.disabled = true;
      cEl.innerHTML = '<option value="">Pilih Kecamatan</option>'; cEl.disabled = true;
    }
  });

  kEl.addEventListener('change', () => {
    state.kabkota_id = kEl.value;
    const o = kEl.selectedOptions[0];
    state.kabkota = o ? o.textContent : '';
    state.kecamatan_id = state.kecamatan = '';
    if (kEl.value) loadKec(kEl.value);
    else { cEl.innerHTML = '<option value="">Pilih Kecamatan</option>'; cEl.disabled = true; }
  });

  cEl.addEventListener('change', () => {
    state.kecamatan_id = cEl.value;
    const o = cEl.selectedOptions[0];
    state.kecamatan = o ? o.textContent : '';
  });

  return state;
}
