// ==================== REGION PICKER — API Wilayah Indonesia ====================
// Data: https://github.com/emsifa/api-wilayah-indonesia (static JSON, tanpa key).
// Struktur rantai: Provinsi → Kabupaten → Kecamatan → Desa
// Path (dicoba berurutan ke tiap BASE):
//   /provinces.json                 (semua provinsi)
//   /regencies/{provinsiId}.json    (kabupaten per provinsi)
//   /districts/{kabupatenId}.json   (kecamatan per kabupaten)
//   /villages/{kecamatanId}.json    (desa per kecamatan)
//
// FIX v172: repo emsifa direstrukturisasi upstream (2026-09-05, PR #43) — path lama
// `master/static/api` hilang (404) sehingga kabupaten/kecamatan/desa mati total.
// Kini multi-BASE: utama = domain resmi baru www.emsifa.com (200 JSON, CORS terbuka),
// cadangan = raw cabang gh-pages. Fetch ber-timeout agar UI tak menggantung, dan
// hasil fetch DIPERSIST ke localStorage agar picker alamat tetap jalan offline
// setelah sekali online (dulu hanya provinsi yang ber-fallback lokal).
// LOCAL FALLBACK: provinces.json tersimpan di assets/region/provinces.json
//
// BUG FIX: loadDesa() sekarang dipanggil saat inisialisasi prefill modal,
//          sehingga desa terpilih otomatis ter-load saat modal dibuka.
import { escapeHtml } from './helpers.js';

const BASES = [
  'https://www.emsifa.com/api-wilayah-indonesia/api',
  'https://raw.githubusercontent.com/emsifa/api-wilayah-indonesia/gh-pages/api'
];
const LOCAL_BASE = './assets/region';
const cache = {};
const CACHE_KEY = 'kaki5-region-cache-v1';
const FETCH_TIMEOUT_MS = 12000;

// Muat cache persisten dari sesi sebelumnya (cache korup / tanpa localStorage = abaikan).
try {
  const _raw = localStorage.getItem(CACHE_KEY);
  if (_raw) Object.assign(cache, JSON.parse(_raw));
} catch (e) { /* lanjut dengan cache memori saja */ }

function persistCache() {
  try {
    // Batasi 60 entri terakhir (villages terbesar; data wilayah statis, aman dipangkas).
    const keys = Object.keys(cache);
    const trimmed = {};
    for (const k of keys.slice(-60)) trimmed[k] = cache[k];
    localStorage.setItem(CACHE_KEY, JSON.stringify(trimmed));
  } catch (e) { /* kuota penuh: cukup cache memori */ }
}

function fetchWithTimeout(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(t));
}

// M5 (audit 2026-09-05): peta penggantian di bawah salah — karakter dimapping
// ke dirinya sendiri (& → &, < → <…) sehingga esc() tidak mengganti apa pun.
// Pakai escapeHtml dari helpers.js (satu implementasi, tidak duplikasi).
function esc(s) {
  return escapeHtml(String(s == null ? '' : s));
}

async function getJson(path) {
  const key = 'kaki5-region:' + path;
  if (cache[key]) return cache[key];

  // Provinsi: fallback lokal dulu (satu-satunya level yang dibundel — offline-safe).
  if (path === '/provinces.json') {
    try {
      const r = await fetchWithTimeout(LOCAL_BASE + path);
      if (r.ok) {
        const j = await r.json();
        cache[key] = j;
        persistCache();
        return j;
      }
    } catch (e) {
      console.warn('[REGION] Fallback lokal provinsi gagal, coba remote');
    }
  }

  // Coba tiap BASE berurutan (www.emsifa.com → raw gh-pages) sampai ada yang sukses.
  let lastErr = null;
  for (const base of BASES) {
    try {
      const r = await fetchWithTimeout(base + path);
      if (r.ok) {
        const j = await r.json();
        cache[key] = j;
        persistCache();
        return j;
      }
      lastErr = new Error('region ' + r.status);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error('region: semua sumber wilayah gagal');
}

export function getProvinces()   { return getJson('/provinces.json'); }
export function getKabupaten(provId) { return getJson('/regencies/' + provId + '.json'); }
export function getKecamatan(kabId)  { return getJson('/districts/' + kabId + '.json'); }
export function getDesa(kecId)       { return getJson('/villages/' + kecId + '.json'); }

function fill(sel, items, placeholder, selectedId) {
  sel.innerHTML =
    '<option value="">' + esc(placeholder) + '</option>' +
    items.map(i =>
      '<option value="' + esc(i.id) + '"' + (String(i.id) === String(selectedId) ? ' selected' : '') + '>' +
      esc(i.name) + '</option>'
    ).join('');
}

/**
 * Wiring rantai 4 dropdown.
 * @param {Object} opts
 *  - provSel/kabSel/kecSel/desaSel: element ATAU id string.
 *  - state: objek referensi berisi nilai awal ({provinsi_id, provinsi, ...}),
 *    sekaligus tempat hasil dibaca setelah user memilih.
 */
export function setupRegionPicker({ provSel, kabSel, kecSel, desaSel, state }) {
  const pEl = typeof provSel === 'string' ? document.getElementById(provSel) : provSel;
  const kEl = typeof kabSel  === 'string' ? document.getElementById(kabSel)  : kabSel;
  const cEl = typeof kecSel  === 'string' ? document.getElementById(kecSel)  : kecSel;
  const dEl = typeof desaSel === 'string' ? document.getElementById(desaSel) : desaSel;
  if (!pEl || !kEl || !cEl) return;
  if (!state) state = {};

  // ── Loaders ────────────────────────────────────────────────────────────────

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

  async function loadKec(kabId, selectKec) {
    if (!kabId) {
      cEl.innerHTML = '<option value="">Pilih Kecamatan</option>';
      cEl.disabled = true;
      if (dEl) { dEl.innerHTML = '<option value="">Pilih Desa / Kelurahan</option>'; dEl.disabled = true; }
      return;
    }
    try {
      const items = await getKecamatan(kabId);
      fill(cEl, items, 'Pilih Kecamatan', selectKec);
      cEl.disabled = false;
      if (selectKec && dEl) await loadDesa(selectKec);
    } catch (e) {
      cEl.innerHTML = '<option value="">Kecamatan tidak tersedia</option>';
    }
  }

  async function loadDesa(kecId) {
    if (!kecId || !dEl) {
      if (dEl) { dEl.innerHTML = '<option value="">Pilih Desa / Kelurahan</option>'; dEl.disabled = true; }
      return;
    }
    try {
      const items = await getDesa(kecId);
      fill(dEl, items, 'Pilih Desa / Kelurahan', state.desa_id);
      dEl.disabled = false;
    } catch (e) {
      dEl.innerHTML = '<option value="">Desa tidak tersedia</option>';
    }
  }

  // ── Inisialisasi: prefill semua level dari state yang tersimpan ────────────
  (async () => {
    pEl.innerHTML = '<option value="">Memuat provinsi...</option>';
    try {
      const provs = await getProvinces();
      fill(pEl, provs, 'Pilih Provinsi', state.provinsi_id);
      pEl.disabled = false;

      // chain: provinsi → kabupaten → kecamatan → desa
      if (state.provinsi_id) {
        await loadKab(state.provinsi_id, state.kabkota_id);
        // loadDesa dipanggil dari dalam loadKec() setelah kecamatan prefill selesai
      }
    } catch (e) {
      pEl.innerHTML = '<option value="">Gagal memuat wilayah (cek internet)</option>';
    }
  })();

  // ── Event listeners ────────────────────────────────────────────────────────

  // Guard idempoten: jangan pasang listener berulang bila setupRegionPicker dipanggil
  // lagi pada elemen yang sama (kebocoran listener; pola rosok v66).
  if (pEl.dataset.regionWired !== '1') {
    pEl.dataset.regionWired = '1';
    pEl.addEventListener('change', () => {
      state.provinsi_id = pEl.value;
      const o = pEl.selectedOptions[0];
      state.provinsi = o ? o.textContent : '';
      state.kabkota_id = state.kabkota = state.kecamatan_id = state.kecamatan = state.desa_id = state.desa = '';
      if (pEl.value) loadKab(pEl.value);
      else {
        kEl.innerHTML = '<option value="">Pilih Kota / Kabupaten</option>'; kEl.disabled = true;
        cEl.innerHTML = '<option value="">Pilih Kecamatan</option>'; cEl.disabled = true;
        if (dEl) { dEl.innerHTML = '<option value="">Pilih Desa / Kelurahan</option>'; dEl.disabled = true; }
      }
    });
  }

  if (kEl.dataset.regionWired !== '1') {
    kEl.dataset.regionWired = '1';
    kEl.addEventListener('change', () => {
      state.kabkota_id = kEl.value;
      const o = kEl.selectedOptions[0];
      state.kabkota = o ? o.textContent : '';
      state.kecamatan_id = state.kecamatan = state.desa_id = state.desa = '';
      if (kEl.value) loadKec(kEl.value);
      else {
        cEl.innerHTML = '<option value="">Pilih Kecamatan</option>'; cEl.disabled = true;
        if (dEl) { dEl.innerHTML = '<option value="">Pilih Desa / Kelurahan</option>'; dEl.disabled = true; }
      }
    });
  }

  if (cEl.dataset.regionWired !== '1') {
    cEl.dataset.regionWired = '1';
    cEl.addEventListener('change', () => {
      state.kecamatan_id = cEl.value;
      const o = cEl.selectedOptions[0];
      state.kecamatan = o ? o.textContent : '';
      state.desa_id = state.desa = '';
      if (cEl.value && dEl) loadDesa(cEl.value);
      else if (dEl) { dEl.innerHTML = '<option value="">Pilih Desa / Kelurahan</option>'; dEl.disabled = true; }
    });
  }

  if (dEl && dEl.dataset.regionWired !== '1') {
    dEl.dataset.regionWired = '1';
    dEl.addEventListener('change', () => {
      state.desa_id = dEl.value;
      const o = dEl.selectedOptions[0];
      state.desa = o ? o.textContent : '';
    });
  }

  return state;
}
