/**
 * Control Center Kasir Solo — Modul CMS "Konten Website"
 * =============================================================================
 * Sumber kebenaran: Supabase public.site_content (key text PK, value jsonb).
 * Situs company (kasirsolo.com) membaca tabel ini saat build Astro
 * (company/src/data/remote.ts) dengan fallback ke portfolio.ts lokal.
 *
 * collections terstruktur (form per item):
 *   projects, testimonials, pulseEvents, services, founderSlots
 * collections JSON mentah (textarea + validasi):
 *   about, site, hardware, apps, portal, cities
 *
 * Simpan = upsert SATU baris (key) via /api/rest (service-role server-side).
 * Slug proyek TIDAK dipegang di sini — company loader men-generate dari
 * client+city (konsisten dengan portfolio.ts).
 */

import { supabaseFetch } from './api.js';
import { showToast } from './toast.js';
import { escapeHtml } from './utils.js';

const TABS = [
  { id: 'projects',     label: 'Proyek' },
  { id: 'testimonials', label: 'Testimoni' },
  { id: 'pulseEvents',  label: 'Aktivitas' },
  { id: 'services',     label: 'Jasa' },
  { id: 'founderSlots', label: 'Slot CTA' },
  { id: 'json',         label: 'Lainnya (JSON)' },
];

const SCHEMAS = {
  projects: [
    { k: 'title',    label: 'Judul Proyek', req: true },
    { k: 'client',   label: 'Nama Klien', req: true },
    { k: 'city',     label: 'Kota', req: true },
    { k: 'category', label: 'Kategori', type: 'select', options: ['PHYSICAL', 'DIGITAL'] },
    { k: 'tag',      label: 'Tag (mis. Hardware & Instalasi)' },
    { k: 'desc',     label: 'Deskripsi', type: 'textarea' },
    { k: 'image',    label: 'URL Gambar' },
    { k: 'value',    label: 'Nilai Proyek (mis. Rp 12.000.000)' },
    { k: 'duration', label: 'Durasi (mis. 3 Hari)' },
  ],
  testimonials: [
    { k: 'quote',    label: 'Kutipan', type: 'textarea', req: true },
    { k: 'name',     label: 'Nama', req: true },
    { k: 'business', label: 'Usaha + Kota' },
    { k: 'since',    label: 'Pakai sejak' },
  ],
  pulseEvents: [
    { k: 'name',     label: 'Nama', req: true },
    { k: 'item',     label: 'Aktivitas / Produk', req: true },
    { k: 'location', label: 'Lokasi' },
    { k: 'time',     label: 'Waktu (mis. "2 jam lalu")' },
  ],
  services: [
    { k: 'id',       label: 'ID (slug kecil, mis. web)' },
    { k: 'title',    label: 'Judul', req: true },
    { k: 'subtitle', label: 'Subjudul' },
    { k: 'desc',     label: 'Deskripsi', type: 'textarea' },
  ],
};

/** Pembagian seksi form per jenis item — field tidak ada di grup manapun
 *  otomatis masuk grup "Detail" di belakang. */
const SCHEMA_GROUPS = {
  projects: [
    { t: 'Identitas', keys: ['title', 'client', 'city'] },
    { t: 'Klasifikasi', keys: ['category', 'tag'] },
    { t: 'Detail', keys: ['desc', 'image', 'value', 'duration'] },
  ],
  testimonials: [
    { t: 'Testimoni', keys: ['quote'] },
    { t: 'Identitas', keys: ['name', 'business', 'since'] },
  ],
  pulseEvents: [
    { t: 'Aktivitas', keys: ['name', 'item'] },
    { t: 'Detail', keys: ['location', 'time'] },
  ],
  services: [
    { t: 'Jasa', keys: ['title', 'subtitle'] },
    { t: 'Detail', keys: ['id', 'desc'] },
  ],
};

const JSON_KEYS = [
  { key: 'about',    label: 'Halaman Tentang — founder, cerita, timeline, legalitas, markas' },
  { key: 'site',     label: 'Identitas situs — brand, tagline, WA, alamat, stats' },
  { key: 'hardware', label: 'Paket mesin kasir — harga & spesifikasi' },
  { key: 'apps',     label: 'Aplikasi — Rosok, Kaki Lima, Shop' },
  { key: 'portal',   label: 'Portal R&D — SIBOS, QALAM, Dapur SPPG' },
  { key: 'cities',   label: 'Kota jangkauan (kandang / ekspansi)' },
];

let cache = {};          // key -> value (parsed)
let activeTab = 'projects';
let loaded = false;
let itemEdit = null;     // { key, idx } — idx null = tambah baru (flip page aktif)

// ── Data layer ────────────────────────────────────────────────────────────────

async function loadAll() {
  setSyncInfo('Memuat…');
  const res = await supabaseFetch('/rest/v1/site_content?select=key,value&order=key.asc');
  if (!res.ok) {
    setSyncInfo('Gagal memuat');
    showToast('Gagal memuat konten dari Supabase', 3000, 'error');
    return;
  }
  cache = {};
  for (const row of res.data || []) cache[row.key] = row.value;
  loaded = true;
  setSyncInfo(`${Object.keys(cache).length} koleksi tersinkron`);
  render();
}

async function saveKey(key, value) {
  const res = await supabaseFetch('/rest/v1/site_content?on_conflict=key', {
    method: 'POST',
    data: [{ key, value }],
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
  });
  if (!res.ok) {
    showToast(`Gagal menyimpan ${key}`, 3000, 'error');
    return false;
  }
  cache[key] = value;
  setSyncInfo('Tersimpan ' + new Date().toLocaleTimeString('id-ID'));
  showToast(`${labelFor(key)} tersimpan — situs menariknya saat build berikutnya`, 2500, 'success');
  return true;
}

function labelFor(key) {
  const tab = TABS.find((t) => t.id === key);
  if (tab) return tab.label;
  const jk = JSON_KEYS.find((j) => j.key === key);
  return jk ? jk.label.split(' —')[0] : key;
}

// ── Render ────────────────────────────────────────────────────────────────────

function setSyncInfo(txt) {
  const el = document.getElementById('contentSyncInfo');
  if (el) el.textContent = txt;
}

export function initContent() {
  const tabsEl = document.getElementById('contentTabs');
  if (!tabsEl) return;
  tabsEl.innerHTML = TABS.map((t) =>
    `<button class="content-tab${t.id === activeTab ? ' active' : ''}" data-tab="${t.id}">${t.label}<span class="tab-n" id="ctn-${t.id}"></span></button>`
  ).join('');
  tabsEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tab]');
    if (!btn) return;
    activeTab = btn.dataset.tab;
    itemEdit = null;
    tabsEl.querySelectorAll('.content-tab').forEach((b) =>
      b.classList.toggle('active', b.dataset.tab === activeTab));
    render();
  });
  loadAll();
}

function render() {
  const body = document.getElementById('contentBody');
  if (!body) return;
  if (!loaded) { body.innerHTML = '<p class="muted">Memuat konten…</p>'; return; }

  // Hitungan per tab (koleksi array) + jumlah koleksi JSON
  TABS.forEach((t) => {
    const el = document.getElementById(`ctn-${t.id}`);
    if (!el) return;
    const v = cache[t.id];
    el.textContent = Array.isArray(v) ? v.length : '';
  });
  const jEl = document.getElementById('ctn-json');
  if (jEl) jEl.textContent = String(JSON_KEYS.length);

  // Flip page: halaman edit item menggantikan daftar
  if (itemEdit) { renderItemPage(); return; }

  if (activeTab === 'founderSlots') { body.innerHTML = renderSlots(); bindSlots(); return; }
  if (activeTab === 'json')         { body.innerHTML = renderJson();   bindJson();   return; }
  body.innerHTML = renderList(activeTab);
  bindList(activeTab);
}

// ── List editor (projects / testimonials / pulseEvents / services) ────────────
// Pola flip page: daftar = kartu read-only; klik kartu → halaman edit item.

function renderList(key) {
  const items = Array.isArray(cache[key]) ? cache[key] : [];
  const rows = items.map((item, idx) => `
    <div class="oc-row" data-idx="${idx}" role="button" tabindex="0" aria-label="${escapeHtml(listHeadline(key, item))}">
      <div class="oc-ava">${idx + 1}</div>
      <div class="oc-main">
        <div class="oc-name">${escapeHtml(listHeadline(key, item))}</div>
        <div class="oc-sub">${escapeHtml(listSub(key, item))}</div>
      </div>
      <div class="oc-side"><span class="oc-chev" aria-hidden="true">›</span></div>
    </div>`).join('');

  return `
    <p class="content-note">${escapeHtml(listHint(key))}</p>
    <div class="oc-list">${rows || '<p class="muted">Belum ada item. Tambah di bawah.</p>'}</div>
    <div class="content-actions" style="margin-top:var(--s3)">
      <button class="btn btn-primary" id="contentAdd">+ Tambah ${escapeHtml(labelFor(key))}</button>
    </div>`;
}

/** Baris kedua info ringkas per jenis item */
function listSub(key, item) {
  if (key === 'projects')     return [item.category, item.tag, item.value].filter(Boolean).join(' · ') || '—';
  if (key === 'testimonials') return item.quote ? item.quote.slice(0, 70) : '—';
  if (key === 'pulseEvents')  return [item.location, item.time].filter(Boolean).join(' · ') || '—';
  if (key === 'services')     return item.subtitle || '—';
  return '—';
}

function listHeadline(key, item) {
  if (key === 'projects')     return `${item.title || '(tanpa judul)'} — ${item.city || '?'}`;
  if (key === 'testimonials') return `${item.name || '?'} · ${item.business || ''}`;
  if (key === 'pulseEvents')  return `${item.name || '?'} — ${item.item || ''}`;
  if (key === 'services')     return item.title || '(tanpa judul)';
  return 'Item';
}

function listHint(key) {
  if (key === 'projects')     return 'Proyek portofolio tampil di /portfolio, preview beranda, dan halaman /kota. Slug URL dibuat otomatis dari Klien + Kota. ⚠️ Ganti URL gambar Unsplash dengan foto instalasi asli sebelum launch.';
  if (key === 'testimonials') return '⚠️ Data saat ini MASIH CONTOH. Ganti dengan testimoni asli (nama + usaha nyata) sebelum situs dipasarkan.';
  if (key === 'pulseEvents')  return '⚠️ Data saat ini MASIH CONTOH. Idealnya diisi otomatis dari orders/leads riil — jangan biarkan feed palsu saat launch.';
  if (key === 'services')     return 'Kartu Jasa Digital di beranda company.';
  return '';
}

function bindList(key) {
  const body = document.getElementById('contentBody');
  body.querySelectorAll('#contentBody .oc-row').forEach((card) => {
    const open = () => { itemEdit = { key, idx: Number(card.dataset.idx) }; render(); };
    card.addEventListener('click', open);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); }
    });
  });
  const addBtn = document.getElementById('contentAdd');
  if (addBtn) addBtn.addEventListener('click', () => {
    itemEdit = { key, idx: null }; // null = item baru (belum masuk cache)
    render();
  });
}

// ── Item editor (flip page) ───────────────────────────────────────────────────

function openContentItem() { render(); }

function closeContentItem() {
  itemEdit = null;
  render();
}

function renderItemPage() {
  const body = document.getElementById('contentBody');
  if (!body || !itemEdit) return;
  const { key, idx } = itemEdit;
  const isNew = idx === null;
  const items = Array.isArray(cache[key]) ? cache[key] : [];
  const item = isNew ? {} : (items[idx] || {});
  const schema = SCHEMAS[key];

  const fieldHtml = (f) => {
    const val = item[f.k] ?? '';
    const id = `fld-${f.k}`;
    let input;
    if (f.type === 'textarea') {
      input = `<textarea id="${id}" data-k="${f.k}" rows="3">${escapeHtml(val)}</textarea>`;
    } else if (f.type === 'select') {
      input = `<select id="${id}" data-k="${f.k}">${f.options.map((o) =>
        `<option${o === val ? ' selected' : ''}>${escapeHtml(o)}</option>`).join('')}</select>`;
    } else {
      input = `<input id="${id}" data-k="${f.k}" value="${escapeHtml(val)}">`;
    }
    return `<div class="field${f.type === 'textarea' ? ' field-span-2' : ''}">
      <label class="field-label" for="${id}">${escapeHtml(f.label)}${f.req ? ' *' : ''}</label>${input}</div>`;
  };

  // Bagi field ke seksi sesuai SCHEMA_GROUPS; sisanya masuk "Detail" di akhir
  const groups = SCHEMA_GROUPS[key] || [{ t: 'Konten', keys: schema.map((f) => f.k) }];
  const grouped = new Set(groups.flatMap((g) => g.keys));
  const rest = schema.filter((f) => !grouped.has(f.k));
  const allGroups = rest.length
    ? groups.concat([{ t: 'Detail', keys: rest.map((f) => f.k) }])
    : groups;

  const sections = allGroups.map((g) => {
    const fs = g.keys.map((k) => schema.find((f) => f.k === k)).filter(Boolean);
    if (!fs.length) return '';
    return `<div class="cd-sec">
      <div class="cd-sec-t">${escapeHtml(g.t)}</div>
      <div class="field-grid-2">${fs.map(fieldHtml).join('')}</div>
    </div>`;
  }).join('');

  body.innerHTML = `
    <div class="cd-head cd-head-sticky">
      <button type="button" class="btn btn-outline btn-sm" id="contentBack">← Kembali</button>
      <div class="cd-title"><h3>${isNew ? 'Tambah ' + escapeHtml(labelFor(key)) : escapeHtml(listHeadline(key, item))}</h3></div>
      <div class="cd-head-actions">
        ${isNew ? '' : '<button type="button" class="btn btn-danger btn-sm" id="contentItemDel">Hapus</button>'}
        <button type="button" class="btn btn-primary btn-sm" id="contentItemSave">${isNew ? 'Tambah' : 'Simpan'}</button>
      </div>
    </div>
    ${sections}`;

  body.querySelectorAll('#contentBack').forEach((b) =>
    b.addEventListener('click', closeContentItem));

  body.querySelector('#contentItemSave').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    const collected = {};
    body.querySelectorAll('[data-k]').forEach((el) => { collected[el.dataset.k] = el.value.trim(); });
    const missing = schema.find((f) => f.req && !String(collected[f.k] || '').trim());
    if (missing) { showToast(`Field wajib (*) belum diisi: ${missing.label}`, 2500, 'warning'); return; }
    const arr = Array.isArray(cache[key]) ? [...cache[key]] : [];
    if (isNew) arr.push(collected); else arr[idx] = collected;
    btn.disabled = true;
    const okSave = await saveKey(key, arr);
    btn.disabled = false;
    if (okSave) { itemEdit = null; render(); }
  });

  const delBtn = body.querySelector('#contentItemDel');
  if (delBtn) delBtn.addEventListener('click', async () => {
    const arr = Array.isArray(cache[key]) ? [...cache[key]] : [];
    const name = listHeadline(key, arr[idx] || {});
    if (!confirm(`Hapus "${name}" dari ${labelFor(key)}?\nTersimpan permanen ke Supabase.`)) return;
    arr.splice(idx, 1);
    delBtn.disabled = true;
    const okSave = await saveKey(key, arr);
    delBtn.disabled = false;
    if (okSave) { itemEdit = null; render(); }
  });
}

// ── founderSlots ──────────────────────────────────────────────────────────────

function renderSlots() {
  const s = cache.founderSlots || { onsite: 0, digital: 0 };
  return `
    <p class="content-hint muted">Badge scarcity di CTA akhir beranda. Setel sesuai kapasitas bulan ini; 0 = sembunyikan? (saat ini selalu tampil).</p>
    <div class="field-grid-2">
      <div class="field"><label class="field-label" for="slotOnsite">Slot On-Site</label>
        <input id="slotOnsite" type="number" min="0" value="${Number(s.onsite) || 0}"></div>
      <div class="field"><label class="field-label" for="slotDigital">Slot Proyek Digital</label>
        <input id="slotDigital" type="number" min="0" value="${Number(s.digital) || 0}"></div>
    </div>
    <div class="content-actions"><button class="btn btn-primary" id="contentSave">Simpan</button></div>`;
}

function bindSlots() {
  document.getElementById('contentSave').addEventListener('click', async (e) => {
    const btn = e.currentTarget; btn.disabled = true;
    const value = {
      onsite: Math.max(0, Number(document.getElementById('slotOnsite').value) || 0),
      digital: Math.max(0, Number(document.getElementById('slotDigital').value) || 0),
    };
    await saveKey('founderSlots', value);
    btn.disabled = false;
  });
}

// ── JSON editor (about, site, hardware, apps, portal, cities) ─────────────────

function renderJson() {
  return JSON_KEYS.map((j) => {
    const val = cache[j.key];
    const text = val === undefined ? '{}' : JSON.stringify(val, null, 2);
    return `<details class="content-json">
      <summary>${escapeHtml(j.label)}${val === undefined ? ' <span class="content-badge-warn">belum ada baris</span>' : ''}</summary>
      <textarea id="json-${j.key}" rows="12" spellcheck="false">${escapeHtml(text)}</textarea>
      <div class="content-actions">
        <button class="btn btn-outline" data-reformat="${j.key}">Rapikan JSON</button>
        <button class="btn btn-primary" data-savejson="${j.key}">Simpan ${escapeHtml(j.key)}</button>
      </div>
    </details>`;
  }).join('');
}

function bindJson() {
  const body = document.getElementById('contentBody');
  body.querySelectorAll('[data-reformat]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const ta = document.getElementById(`json-${btn.dataset.reformat}`);
      try { ta.value = JSON.stringify(JSON.parse(ta.value), null, 2); }
      catch { showToast('JSON tidak valid — periksa sintaksnya', 2500, 'error'); }
    });
  });
  body.querySelectorAll('[data-savejson]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const key = btn.dataset.savejson;
      const ta = document.getElementById(`json-${key}`);
      let parsed;
      try { parsed = JSON.parse(ta.value); }
      catch (e) { showToast(`JSON ${key} tidak valid: ${e.message}`, 3500, 'error'); return; }
      btn.disabled = true;
      await saveKey(key, parsed);
      btn.disabled = false;
    });
  });
}
