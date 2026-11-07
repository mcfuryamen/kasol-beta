/**
 * Control Center — Modul Kalender Konten (posting MANUAL bulanan)
 * =============================================================================
 * Berbeda dari modul Sosmed yang PUBLIKASI otomatis lewat Graph API, modul ini
 * 100% MANUAL: owner mengatur rencana posting per tanggal, menyalin caption,
 * menerbitkannya sendiri (FB/IG/Threads/TikTok/WA), lalu menandai "sudah
 * tayang". Tidak butuh token Meta sama sekali.
 *
 * Dua tab:
 *   📅 Jadwal  → kalender bulan ini; tiap hari bisa berisi beberapa rencana.
 *                 Tombol "⚡ Isi bulan ini" menebar materi varied ke slot kosong.
 *   📚 Materi  → bank materi (seed dari marketing-kit): caption 14 hari,
 *                 brief video siap rekam, 79 variasi komentar, template balasan.
 *
 * Data:
 *   • content_materials → bank materi (tabel baru, seed via
 *     control/scripts/seed-marketing-kit.mjs)
 *   • social_posts     → berisi rencana. status='planned' = sudah dijadwalkan
 *     manual; status='posted' = sudah tayang (owner yang tandai).
 *     Rencana TIDAK PERNAH ikut post-due (post-due cuma ambil 'approved').
 * =============================================================================
 */
import { showToast } from './toast.js';
import { escapeHtml } from './utils.js';
import { supabaseFetch, controlApi } from './api.js';

let materials = [];
let plans = [];
let curYear = new Date().getFullYear();
let curMonth = new Date().getMonth(); // 0-based
let kalTab = 'jadwal';
let matFilter = 'semua';
let matQuery = '';
let inited = false;

const el = (id) => document.getElementById(id);

const PLATFORMS = [
  { v: 'facebook', label: 'Facebook Page', ico: '📘' },
  { v: 'instagram', label: 'Instagram', ico: '📸' },
  { v: 'threads', label: 'Threads', ico: '🧵' },
  { v: 'tiktok', label: 'TikTok', ico: '🎵' },
  { v: 'youtube', label: 'YouTube Shorts', ico: '▶️' },
  { v: 'whatsapp', label: 'WhatsApp Status', ico: '💬' },
  { v: 'marketplace', label: 'Marketplace', ico: '🛒' },
  { v: 'group', label: 'Grup FB', ico: '👥' },
];
const SLOTS = ['09:00', '12:30', '19:00'];
const HARI = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

// Kategori hasil variasi AI (dibuat dari materi induk, disimpan ke bank)
const KAT_AI = { caption: 'caption_ai', komentar: 'komentar_ai', brief: 'brief_ai' };
const GAYA_CAPTION = ['edukasi', 'promo', 'interaktif', 'build-in-public', 'cerita'];
const LEVEL_KOMENTAR = ['A', 'B', 'C', 'D'];
const JUMLAH_AWAL = 3;

const plat = (v) => PLATFORMS.find((p) => p.v === v) || { v, label: v, ico: '•' };
const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

// ── util tanggal (semua lokal / WIB) ─────────────────────────────────────────
function ymd(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
function hariIniYmd() { return ymd(new Date()); }
function jumlahHari(y, m) { return new Date(y, m + 1, 0).getDate(); }
/** 0 = Senin … 6 = Minggu */
function offsetSenin(d) { return (d.getDay() + 6) % 7; }

function slotDateTime(ymdStr, slot) {
  const [y, m, d] = ymdStr.split('-').map(Number);
  const [hh, mm] = String(slot || '09:00').split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0).toISOString();
}
function jamDari(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// ── data ─────────────────────────────────────────────────────────────────────
async function loadMaterials() {
  const r = await supabaseFetch('/rest/v1/content_materials?select=*&order=kategori,hari,slot&limit=500');
  materials = r?.data || [];
  return materials;
}

async function loadPlans() {
  const start = new Date(curYear, curMonth, 1);
  const end = new Date(curYear, curMonth + 1, 1);
  const gte = encodeURIComponent(start.toISOString());
  const lt = encodeURIComponent(end.toISOString());
  const r = await supabaseFetch(
    `/rest/v1/social_posts?select=*&scheduled_at=gte.${gte}&scheduled_at=lt.${lt}&order=scheduled_at.asc&limit=300`
  );
  plans = r?.data || [];
  return plans;
}

function plansOn(dateStr) {
  return plans.filter((p) => p.scheduled_at && ymd(new Date(p.scheduled_at)) === dateStr)
    .sort((a, b) => (a.scheduled_at || '').localeCompare(b.scheduled_at || ''));
}

// ── render ───────────────────────────────────────────────────────────────────
function render() {
  if (kalTab === 'jadwal') renderJadwal();
  else renderMateri();
}

function renderJadwal() {
  const host = el('kalenderBody');
  if (!host) return;

  const cells = [];
  const offset = offsetSenin(new Date(curYear, curMonth, 1));
  for (let i = 0; i < offset; i++) cells.push(null);
  const nHari = jumlahHari(curYear, curMonth);
  for (let d = 1; d <= nHari; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const stats = hitungStat();
  const bulanIni = `${BULAN[curMonth]} ${curYear}`;

  host.innerHTML = `
    <div class="kal-toolbar">
      <div class="kal-nav">
        <button class="btn btn-outline btn-sm" id="kalPrev" title="Bulan sebelumnya">◀</button>
        <b class="kal-bulan">${bulanIni}</b>
        <button class="btn btn-outline btn-sm" id="kalNext" title="Bulan berikutnya">▶</button>
        <button class="btn btn-outline btn-sm" id="kalToday">Hari ini</button>
      </div>
      <div class="kal-actions">
        <button class="btn btn-outline btn-sm" id="kalAuto">⚡ Isi bulan ini</button>
        <button class="btn btn-primary btn-sm" id="kalAdd">＋ Tambah rencana</button>
      </div>
    </div>

    <div class="kal-stat">
      <span class="kal-stat-i"><b>${stats.total}</b> rencana</span>
      <span class="kal-stat-i"><b>${stats.posted}</b> sudah tayang</span>
      <span class="kal-stat-i"><b>${stats.pending}</b> menunggu</span>
      <span class="kal-stat-i"><b>${stats.slotTerisi}</b>/${stats.slotTotal} slot terisi</span>
      ${stats.bahanSisa != null ? `<span class="kal-stat-i muted">${stats.bahanSisa} materi belum dipakai</span>` : ''}
    </div>

    <div class="kal-grid">
      ${HARI.map((h) => `<div class="kal-dow">${h}</div>`).join('')}
      ${cells.map((d) => {
        if (!d) return '<div class="kal-cell kal-cell-out"></div>';
        const ds = `${curYear}-${String(curMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const list = plansOn(ds);
        const isToday = ds === hariIniYmd();
        return `
          <div class="kal-cell ${isToday ? 'is-today' : ''}" data-day="${ds}">
            <div class="kal-cell-head"><span class="kal-daynum">${d}</span></div>
            <div class="kal-cell-items">
              ${list.slice(0, 3).map((p) => `
                <button class="kal-chip ${p.status === 'posted' ? 'is-posted' : ''}" data-plan="${p.id}"
                  title="${escapeHtml(String(p.konten || '').slice(0, 90))}">
                  <span class="kal-chip-ico">${plat(p.platform).ico}</span>
                  <span class="kal-chip-txt">${escapeHtml(jamDari(p.scheduled_at) || '—')}</span>
                  ${p.status === 'posted' ? '<span class="kal-chip-ok">✓</span>' : ''}
                </button>`).join('')}
              ${list.length > 3 ? `<span class="kal-more">+${list.length - 3}</span>` : ''}
              ${list.length === 0 ? '<span class="kal-empty">+</span>' : ''}
            </div>
          </div>`;
      }).join('')}
    </div>
    <p class="muted kal-tip">Klik tanggal → tambah rencana. Klik chip → buka detail (salin caption, tandai sudah tayang). <b>Rencana ini tidak pernah keposting otomatis</b> — statusnya <code>planned</code>.</p>`;

  el('kalPrev')?.addEventListener('click', () => geserBulan(-1));
  el('kalNext')?.addEventListener('click', () => geserBulan(1));
  el('kalToday')?.addEventListener('click', () => {
    const now = new Date();
    curYear = now.getFullYear(); curMonth = now.getMonth();
    loadPlans().then(render);
  });
  el('kalAdd')?.addEventListener('click', () => openRencanaSheet(null, hariIniYmd()));
  el('kalAuto')?.addEventListener('click', openAutoFill);

  host.querySelectorAll('.kal-cell:not(.kal-cell-out)').forEach((c) => {
    c.addEventListener('click', (e) => {
      if (e.target.closest('[data-plan]')) return; // chip punya handler sendiri
      openRencanaSheet(null, c.dataset.day);
    });
  });
  host.querySelectorAll('[data-plan]').forEach((b) => {
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      const p = plans.find((x) => x.id === b.dataset.plan);
      if (p) openRencanaSheet(p, ymd(new Date(p.scheduled_at)));
    });
  });
}

function hitungStat() {
  let posted = 0, pending = 0, slotTerisi = 0;
  for (const p of plans) {
    if (p.status === 'posted') posted++; else pending++;
  }
  const nHari = jumlahHari(curYear, curMonth);
  const slotTotal = nHari * SLOTS.length;
  // Slot terisi = pasangan (tanggal, jam) yang benar-benar ada isinya,
  // BUKAN jumlah hari x jumlah slot (yang ngakuin semua slot kepakai walau
  // cuma satu slot per hari yang dijadwalin).
  slotTerisi = new Set(
    plans.map((p) => ymd(new Date(p.scheduled_at)) + '|' + jamDari(p.scheduled_at))
  ).size;
  const dipakaiId = new Set(plans.map((p) => p.material_id).filter(Boolean));
  const captionTotal = materials.filter((m) => m.kategori === 'caption').length;
  return {
    total: plans.length,
    posted, pending, slotTerisi, slotTotal,
    bahanSisa: captionTotal ? Math.max(0, captionTotal - dipakaiId.size) : 0,
  };
}

function renderMateri() {
  const host = el('kalenderBody');
  if (!host) return;

  const cats = [
    { k: 'semua', label: 'Semua' },
    { k: 'caption', label: 'Caption' },
    { k: 'brief_video', label: 'Brief Video' },
    { k: 'variasi', label: 'Variasi Komentar' },
    { k: 'template', label: 'Template' },
    { k: 'caption_ai', label: '✨ Varian AI' },
    { k: 'komentar_ai', label: '✨ Komentar AI' },
    { k: 'brief_ai', label: '✨ Brief AI' },
  ];
  const q = matQuery.trim().toLowerCase();
  const list = materials.filter((m) => (matFilter === 'semua' || m.kategori === matFilter)
    && (!q || String(m.isi).toLowerCase().includes(q) || String(m.judul).toLowerCase().includes(q)));

  host.innerHTML = `
    <div class="kal-toolbar">
      <div class="oc-chips" id="kalMatChips">
        ${cats.map((c) => `<button type="button" class="oc-chip ${matFilter === c.k ? 'on' : ''}" data-mat="${c.k}">
          <i aria-hidden="true"></i>${c.label}<span class="n">${c.k === 'semua' ? materials.length : materials.filter((m) => m.kategori === c.k).length}</span>
        </button>`).join('')}
      </div>
      <div class="kal-actions">
        <input id="kalMatSearch" class="input" placeholder="Cari materi…" value="${escapeHtml(matQuery)}" style="max-width:220px">
      </div>
    </div>
    <div class="kal-materi-list">
      ${list.length === 0
        ? '<p class="muted">Tidak ada materi. Jalankan <code>node control/scripts/seed-marketing-kit.mjs</code> untuk mengisi bank materi dari folder marketing-kit.</p>'
        : list.map((m) => `
          <div class="kal-mat" data-mat-id="${m.id}">
            <div class="kal-mat-head">
              <span class="badge ${badgeKategori(m.kategori)}">${escapeHtml(m.kategori)}</span>
              ${m.tag ? `<span class="muted">${escapeHtml(m.tag)}</span>` : ''}
              ${m.slot ? `<span class="muted">${escapeHtml(m.slot)}</span>` : ''}
              <b>${escapeHtml(m.judul)}</b>
            </div>
            <div class="kal-mat-isi">${escapeHtml(String(m.isi).slice(0, 260))}${String(m.isi).length > 260 ? '…' : ''}</div>
            <div class="kal-mat-act">
              <button class="btn btn-outline btn-sm" data-act="salin" data-id="${m.id}">📋 Salin</button>
              <button class="btn btn-outline btn-sm" data-act="jadwal" data-id="${m.id}">📅 Jadwalkan</button>
              <button class="btn btn-outline btn-sm" data-act="variasikan" data-id="${m.id}">✨ Variasikan</button>
              ${m.kategori === 'brief_video' ? `<button class="btn btn-outline btn-sm" data-act="brief" data-id="${m.id}">🎬 Lihat brief</button>` : ''}
            </div>
          </div>`).join('')}
    </div>`;

  host.querySelectorAll('[data-mat]').forEach((b) => {
    b.addEventListener('click', () => { matFilter = b.dataset.mat; render(); });
  });
  const search = el('kalMatSearch');
  if (search) {
    let t = null;
    search.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => {
        matQuery = search.value;
        const pos = search.selectionStart;
        render();
        const s2 = el('kalMatSearch');
        if (s2) { s2.focus(); s2.setSelectionRange(pos, pos); }
      }, 260);
    });
  }
  host.querySelectorAll('[data-act]').forEach((b) => {
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      const m = materials.find((x) => x.id === b.dataset.id);
      if (!m) return;
      if (b.dataset.act === 'salin') salinTeks(m.isi);
      else if (b.dataset.act === 'jadwal') openRencanaSheet(null, hariIniYmd(), m);
      else if (b.dataset.act === 'variasikan') openVariasiSheet(m);
      else if (b.dataset.act === 'brief') openBrief(m);
    });
  });
}

function badgeKategori(k) {
  return {
    caption: 'blue', brief_video: 'teal', variasi: 'amber', template: 'gray',
    caption_ai: 'green', komentar_ai: 'green', brief_ai: 'green',
  }[k] || 'gray';
}

// ── aksi ─────────────────────────────────────────────────────────────────────
async function salinTeks(txt) {
  const text = String(txt || '');
  if (!text) return;
  let ok = false;
  try {
    await navigator.clipboard.writeText(text);
    ok = true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      ok = document.execCommand('copy'); ta.remove();
    } catch { ok = false; }
  }
  showToast(ok ? '📋 Tersalin — paste di aplikasi yang lo tuju' : 'Gagal menyalin — salin manual', ok ? 2600 : 3200, ok ? 'success' : 'warning');
}

function geserBulan(delta) {
  const d = new Date(curYear, curMonth + delta, 1);
  curYear = d.getFullYear(); curMonth = d.getMonth();
  loadPlans().then(render);
}

/**
 * Sheet rencana: tambah baru atau edit yang sudah ada.
 * @param {object|null} plan  baris social_posts (null = baru)
 * @param {string} dateStr    'YYYY-MM-DD'
 * @param {object|null} materi material yang dipilih (prefill)
 */
function openRencanaSheet(plan, dateStr, materi) {
  const host = el('kalRencanaBody');
  if (!host) return;
  const isEdit = !!plan;
  const p = plan || {};
  const tgl = dateStr || (p.scheduled_at ? ymd(new Date(p.scheduled_at)) : hariIniYmd());
  const jam = p.scheduled_at ? jamDari(p.scheduled_at) : '09:00';
  const platform = p.platform || 'facebook';
  const konten = p.konten ?? materi?.isi ?? '';
  const materialId = p.material_id ?? materi?.id ?? null;

  host.innerHTML = `
    <div class="field"><label for="krTgl">Tanggal tayang</label>
      <input type="date" id="krTgl" value="${escapeHtml(tgl)}"></div>
    <div class="field"><label for="krSlot">Slot jam</label>
      <select id="krSlot">
        ${SLOTS.map((s) => `<option value="${s}" ${s === jam ? 'selected' : ''}>${s}</option>`).join('')}
        ${!SLOTS.includes(jam) ? `<option value="${escapeHtml(jam)}" selected>${escapeHtml(jam)}</option>` : ''}
      </select></div>
    <div class="field"><label for="krPlat">Platform / kanal</label>
      <select id="krPlat">
        ${PLATFORMS.map((x) => `<option value="${x.v}" ${x.v === platform ? 'selected' : ''}>${x.ico} ${escapeHtml(x.label)}</option>`).join('')}
      </select></div>
    <div class="field"><label for="krMateri">Materi dari bank (opsional)</label>
      <select id="krMateri">
        <option value="">— tulis sendiri —</option>
        ${materials.map((m) => `<option value="${m.id}" ${m.id === materialId ? 'selected' : ''}>[${escapeHtml(m.kategori)}] ${escapeHtml(m.judul)}</option>`).join('')}
      </select></div>
    <div class="field"><label for="krKonten">Caption / naskah</label>
      <textarea id="krKonten" rows="7" placeholder="Caption yang akan lo terbitkan…">${escapeHtml(konten)}</textarea></div>
    ${isEdit ? `
      <div class="field"><label for="krLink">Link posting (opsional, buat catatan)</label>
        <input id="krLink" placeholder="https://facebook.com/…" value="${escapeHtml(p.remote_url || '')}"></div>
      <div class="muted">Status saat ini: <b>${escapeHtml(p.status)}</b>${p.last_error ? ` · error: ${escapeHtml(String(p.last_error).slice(0, 80))}` : ''}</div>
    ` : ''}
    <div class="social-btns">
      <button class="btn btn-primary btn-sm" id="krSave">💾 ${isEdit ? 'Simpan' : 'Simpan rencana'}</button>
      ${isEdit ? `<button class="btn btn-outline btn-sm" id="krTayang">✅ Sudah tayang</button>` : ''}
      ${isEdit ? `<button class="btn btn-outline btn-sm" id="krSalin">📋 Salin caption</button>` : ''}
      ${isEdit ? `<button class="btn btn-outline btn-sm" id="krHapus" style="color:#c0392b">🗑️ Hapus</button>` : ''}
      <button class="btn btn-outline btn-sm" id="krBatal">Batal</button>
    </div>`;

  openSheet('sheetKalRencana');

  el('krMateri')?.addEventListener('change', (e) => {
    const m = materials.find((x) => x.id === e.target.value);
    if (m) el('krKonten').value = m.isi;
  });
  el('krSalin')?.addEventListener('click', () => salinTeks(el('krKonten')?.value || ''));
  el('krBatal')?.addEventListener('click', () => closeSheet('sheetKalRencana'));
  el('krSave')?.addEventListener('click', async () => {
    const tgl2 = el('krTgl').value;
    const slot = el('krSlot').value;
    const platv = el('krPlat').value;
    const ket = el('krKonten').value.trim();
    const matId = el('krMateri').value || null;
    if (!tgl2) return showToast('Tanggal belum diisi', 2500, 'warning');
    if (!ket) return showToast('Caption masih kosong', 2500, 'warning');
    const body = {
      platform: platv,
      konten: ket,
      material_id: matId,
      scheduled_at: slotDateTime(tgl2, slot),
      status: isEdit ? p.status : 'planned',
    };
    if (isEdit && el('krLink')?.value.trim()) body.remote_url = el('krLink').value.trim();
    const r = await supabaseFetch(
      isEdit ? `/rest/v1/social_posts?id=eq.${encodeURIComponent(p.id)}` : '/rest/v1/social_posts',
      { method: isEdit ? 'PATCH' : 'POST', data: isEdit ? body : [body] }
    );
    if (!r.ok) return showToast('Gagal menyimpan rencana', 3000, 'error');
    if (matId) bumpDipakai(matId);
    closeSheet('sheetKalRencana');
    await loadPlans();
    render();
    showToast(isEdit ? '✓ Rencana diperbarui' : '✓ Rencana ditambahkan', 2200, 'success');
  });
  el('krTayang')?.addEventListener('click', async () => {
    const link = el('krLink')?.value.trim();
    const body = { status: 'posted', posted_at: new Date().toISOString(), last_error: null };
    if (link) body.remote_url = link;
    const r = await supabaseFetch(`/rest/v1/social_posts?id=eq.${encodeURIComponent(p.id)}`, { method: 'PATCH', data: body });
    if (!r.ok) return showToast('Gagal menandai', 3000, 'error');
    closeSheet('sheetKalRencana');
    await loadPlans();
    render();
    showToast('✅ Ditandai sudah tayang', 2200, 'success');
  });
  el('krHapus')?.addEventListener('click', async () => {
    if (!confirm('Hapus rencana ini?')) return;
    await supabaseFetch(`/rest/v1/social_posts?id=eq.${encodeURIComponent(p.id)}`, { method: 'DELETE' });
    closeSheet('sheetKalRencana');
    await loadPlans();
    render();
    showToast('Rencana dihapus', 2000, 'success');
  });
}

async function bumpDipakai(materialId) {
  const m = materials.find((x) => x.id === materialId);
  if (!m) return;
  await supabaseFetch(`/rest/v1/content_materials?id=eq.${encodeURIComponent(materialId)}`, {
    method: 'PATCH', data: { dipakai: (m.dipakai || 0) + 1 },
  });
  m.dipakai = (m.dipakai || 0) + 1;
}

/**
 * ✨ Variasikan materi pakai AI.
 * Hasil TIDAK langsung disimpan — user pilih dulu mana yang mau dipakai,
 * baru masuk ke bank materi (kategori *_ai).
 */
function openVariasiSheet(m) {
  const host = el('kalRencanaBody');
  if (!host) return;

  const defaultJenis = (m.kategori === 'variasi' || m.kategori === 'template') ? 'komentar'
    : m.kategori === 'brief_video' ? 'brief' : 'caption';
  const st = {
    jenis: defaultJenis,
    gaya: 'edukasi',
    level: 'A',
    jumlah: JUMLAH_AWAL,
    platform: m.platform === 'komentar' ? 'facebook' : (m.platform || 'facebook'),
    hasil: [],
    dipilih: new Set(),
    sibuk: false,
    info: '',
  };

  const draw = () => {
    const p = st.platform;
    host.innerHTML = `
      <h4 class="oauth-h">✨ Variasikan: ${escapeHtml(m.judul)}</h4>
      <div class="kal-var-src">${escapeHtml(String(m.isi).slice(0, 260))}${String(m.isi).length > 260 ? '…' : ''}</div>

      <div class="field"><label for="vaJenis">Jenis hasil</label>
        <select id="vaJenis">
          <option value="caption" ${st.jenis === 'caption' ? 'selected' : ''}>Caption / naskah تابعة</option>
          <option value="komentar" ${st.jenis === 'komentar' ? 'selected' : ''}>Komentar / DM</option>
          <option value="brief" ${st.jenis === 'brief' ? 'selected' : ''}>Brief video siap rekam</option>
        </select></div>

      ${st.jenis === 'caption' ? `
      <div class="field"><label for="vaGaya">Gaya</label>
        <select id="vaGaya">
          ${GAYA_CAPTION.map((g) => `<option value="${g}" ${st.gaya === g ? 'selected' : ''}>${g}</option>`).join('')}
        </select></div>` : ''}

      ${st.jenis === 'komentar' ? `
      <div class="field"><label for="vaLevel">Level (aturan kit 07)</label>
        <select id="vaLevel">
          ${LEVEL_KOMENTAR.map((l) => `<option value="${l}" ${st.level === l ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
        <div class="muted">A = umpan (tanpa jualan) · B = soft (sebut app, tanpa link) · C = pitch (boleh link) · D = DM hangat</div>
      </div>` : ''}

      <div class="field"><label for="vaPlatform">Platform</label>
        <select id="vaPlatform">
          ${PLATFORMS.map((x) => `<option value="${x.v}" ${p === x.v ? 'selected' : ''}>${x.ico} ${escapeHtml(x.label)}</option>`).join('')}
        </select></div>

      <div class="field"><label for="vaJumlah">Jumlah variasi</label>
        <select id="vaJumlah">
          ${[3, 5, 8].map((n) => `<option value="${n}" ${st.jumlah === n ? 'selected' : ''}>${n} variasi</option>`).join('')}
        </select></div>

      <div class="social-btns">
        <button class="btn btn-primary btn-sm" id="vaGo" ${st.sibuk ? 'disabled' : ''}>${st.sibuk ? '⏳ Generating…' : '✨ Generate variasi'}</button>
        <button class="btn btn-outline btn-sm" id="vaClose">Tutup</button>
      </div>
      ${st.info ? `<div class="muted" id="vaInfo">${escapeHtml(st.info)}</div>` : ''}

      ${st.hasil.length ? `
        <div class="kal-var-list">
          ${st.hasil.map((v, i) => `
            <label class="kal-var ${st.dipilih.has(i) ? 'is-pilih' : ''}" data-idx="${i}">
              <input type="checkbox" ${st.dipilih.has(i) ? 'checked' : ''} data-idx="${i}">
              <div class="kal-var-body">
                ${v.judul ? `<b>${escapeHtml(v.judul)}</b>` : ''}
                <div class="kal-var-teks">${escapeHtml(v.isi)}</div>
              </div>
            </label>`).join('')}
        </div>
        <div class="social-btns">
          <button class="btn btn-primary btn-sm" id="vaSimpan">💾 Simpan terpilih ke bank</button>
          <button class="btn btn-outline btn-sm" id="vaSalin">📋 Salin yang dipilih</button>
          <button class="btn btn-outline btn-sm" id="vaJadwal">📅 Jadwalkan yang dipilih</button>
        </div>` : ''}`;

    openSheet('sheetKalRencana');

    el('vaJenis')?.addEventListener('change', (e) => { st.jenis = e.target.value; draw(); });
    el('vaGaya')?.addEventListener('change', (e) => { st.gaya = e.target.value; });
    el('vaLevel')?.addEventListener('change', (e) => { st.level = e.target.value; });
    el('vaPlatform')?.addEventListener('change', (e) => { st.platform = e.target.value; });
    el('vaJumlah')?.addEventListener('change', (e) => { st.jumlah = Number(e.target.value); });
    el('vaClose')?.addEventListener('click', () => closeSheet('sheetKalRencana'));

    host.querySelectorAll('.kal-var input[type=checkbox]').forEach((cb) => {
      cb.addEventListener('change', () => {
        const i = Number(cb.dataset.idx);
        if (cb.checked) st.dipilih.add(i); else st.dipilih.delete(i);
        cb.closest('.kal-var')?.classList.toggle('is-pilih', cb.checked);
      });
    });

    el('vaGo')?.addEventListener('click', () => generateVariasi(m, st, draw));
    el('vaSimpan')?.addEventListener('click', () => simpanVariasi(m, st));
    el('vaSalin')?.addEventListener('click', () => {
      const picked = st.hasil.filter((_, i) => st.dipilih.has(i));
      const teks = (picked.length ? picked : st.hasil).map((v) => v.isi).join('\n\n---\n\n');
      salinTeks(teks);
    });
    el('vaJadwal')?.addEventListener('click', () => {
      const picked = st.hasil.filter((_, i) => st.dipilih.has(i));
      const v = picked[0] || st.hasil[0];
      if (!v) return;
      closeSheet('sheetKalRencana');
      openRencanaSheet(null, hariIniYmd(), { isi: v.isi, judul: `${m.judul} · ${v.judul || 'varian'}` });
    });
  };

  draw();
}

/** Panggil AI untuk bikin variasi. */
async function generateVariasi(m, st, draw) {
  if (st.sibuk) return;
  st.sibuk = true;
  st.info = '⏳ AI sedang nulis... (model free biasanya 15-40 detik)';
  draw();
  const t0 = Date.now();
  try {
    const r = await controlApi('/api/ai-variasi', {
      material_id: m.id,
      jenis: st.jenis,
      gaya: st.gaya,
      level: st.level,
      platform: st.platform,
      jumlah: st.jumlah,
    });
    const d = r?.data;
    if (!r?.ok || !d?.ok) {
      st.info = `✗ Gagal: ${d?.message || d?.error || 'tidak diketahui'}`;
      showToast('AI gagal — lihat detail di sheet', 3500, 'error');
    } else {
      st.hasil = d.variasi || [];
      st.dipilih = new Set(st.hasil.map((_, i) => i));
      const dt = Math.round((Date.now() - t0) / 1000);
      st.info = `✓ ${st.hasil.length} variasi dari ${d.model} (${dt} dtk) — centang yang mau dipakai.`;
      showToast(`✨ ${st.hasil.length} variasi siap`, 2500, 'success');
    }
  } catch (e) {
    st.info = `✗ Error: ${String(e?.message || e).slice(0, 120)}`;
  }
  st.sibuk = false;
  draw();
}

/** Simpan variasi terpilih ke bank materi (content_materials). */
async function simpanVariasi(m, st) {
  const picked = st.hasil.filter((_, i) => st.dipilih.has(i));
  if (!picked.length) return showToast('Centang dulu variasi yang mau disimpan', 2800, 'warning');
  const kat = KAT_AI[st.jenis] || 'caption_ai';
  const stamp = Date.now();
  const rows = picked.map((v, i) => ({
    source_key: `ai:${m.id}:${stamp}:${i}`,
    kategori: kat,
    judul: `${m.judul} · ${v.judul || 'varian AI'}`,
    isi: v.isi,
    platform: st.platform,
    tag: 'varian-ai',
  }));
  const r = await supabaseFetch('/rest/v1/content_materials', { method: 'POST', data: rows });
  if (!r.ok) return showToast('Gagal menyimpan ke bank materi', 3000, 'error');
  closeSheet('sheetKalRencana');
  await loadMaterials();
  render();
  showToast(`✓ ${rows.length} variasi disimpan ke bank materi`, 2800, 'success');
}

/** Brief video siap rekam — isi lengkap buat dipakai saat rekam. */
function openBrief(m) {
  const host = el('kalRencanaBody');
  if (!host) return;
  host.innerHTML = `
    <h4 class="oauth-h">${escapeHtml(m.judul)}</h4>
    <pre class="kal-brief">${escapeHtml(m.isi)}</pre>
    <div class="social-btns">
      <button class="btn btn-primary btn-sm" id="kbCopy">📋 Salin brief</button>
      <button class="btn btn-outline btn-sm" id="kbClose">Tutup</button>
    </div>`;
  openSheet('sheetKalRencana');
  el('kbCopy')?.addEventListener('click', () => salinTeks(m.isi));
  el('kbClose')?.addEventListener('click', () => closeSheet('sheetKalRencana'));
}

/**
 * Isi bulan ini otomatis: tebar materi caption ke slot yang kosong.
 * Materi dipakai bergilir (bukan selalu urutan sama) supaya varyasinya terasa.
 */
function openAutoFill() {
  const host = el('kalRencanaBody');
  if (!host) return;
  const caption = materials.filter((m) => m.kategori === 'caption');
  const nHari = jumlahHari(curYear, curMonth);
  host.innerHTML = `
    <h4 class="oauth-h">⚡ Isi bulan ${BULAN[curMonth]} ${curYear} otomatis</h4>
    <p class="muted">Slot kosong akan diisi dengan materi caption yang belum dipakai. Materi dipakai bergilir supaya varies, bukan posting 3× konten yang sama.</p>
    <div class="field"><label for="kaPerHari">Jumlah posting per hari</label>
      <select id="kaPerHari">
        <option value="1">1 / hari — santai (${nHari} posting)</option>
        <option value="2" selected>2 / hari — sedang (${nHari * 2} posting)</option>
        <option value="3">3 / hari — agresif (${nHari * 3} posting)</option>
      </select></div>
    <div class="muted">Bank caption tersedia: <b>${caption.length}</b> materi</div>
    <div class="social-btns">
      <button class="btn btn-primary btn-sm" id="kaGo">⚡ Isi sekarang</button>
      <button class="btn btn-outline btn-sm" id="kaClose">Batal</button>
    </div>`;
  openSheet('sheetKalRencana');
  el('kaClose')?.addEventListener('click', () => closeSheet('sheetKalRencana'));
  el('kaGo')?.addEventListener('click', async () => {
    const perHari = Number(el('kaPerHari').value) || 2;
    closeSheet('sheetKalRencana');
    await autoFill(perHari);
  });
}

async function autoFill(perHari) {
  const slots = perHari === 1 ? ['09:00'] : perHari === 2 ? ['09:00', '19:00'] : SLOTS;
  const nHari = jumlahHari(curYear, curMonth);

  // Slot yang sudah terisi (hari + jam) → jangan ditimpa.
  const terisi = new Set(plans.map((p) => `${ymd(new Date(p.scheduled_at))}|${jamDari(p.scheduled_at)}`));

  // Pool materi caption yang BELUM dipakai di bulan ini.
  const dipakaiId = new Set(plans.map((p) => p.material_id).filter(Boolean));
  let pool = materials.filter((m) => m.kategori === 'caption' && !dipakaiId.has(m.id));
  if (!pool.length) {
    showToast('Bank caption habis terpakai — tambah materi baru dulu', 3500, 'warning');
    return;
  }
  // Rotasi start supaya tiap bulan urutannya beda.
  const offset = Math.floor(Math.random() * pool.length);
  pool = [...pool.slice(offset), ...pool.slice(0, offset)];

  const rows = [];
  let pi = 0;
  for (let d = 1; d <= nHari; d++) {
    const ds = `${curYear}-${String(curMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    for (const slot of slots) {
      if (terisi.has(`${ds}|${slot}`)) continue;
      const m = pool[pi % pool.length];
      pi += 1;
      rows.push({
        platform: 'facebook',
        konten: m.isi,
        material_id: m.id,
        scheduled_at: slotDateTime(ds, slot),
        status: 'planned',
      });
    }
  }
  if (!rows.length) {
    showToast('Semua slot bulan ini sudah terisi', 3000, 'warning');
    return;
  }
  const r = await supabaseFetch('/rest/v1/social_posts', { method: 'POST', data: rows });
  if (!r.ok) return showToast('Gagal mengisi jadwal', 3000, 'error');
  await loadPlans();
  render();
  showToast(`⚡ ${rows.length} rencana dibuat`, 3000, 'success');
}

// ── wiring ───────────────────────────────────────────────────────────────────
// Listener di level modul (side effect) — HARUS di sini, bukan di initKalender():
// initNavigation() switch ke layar awal dari hash SEBELUM bootstrap() memanggil
// initKalender(), jadi listener yang didaftarkan belakangan nggak akan kepanggil
// untuk layar yang dibuka pertama kali.
window.addEventListener('screen:change', (e) => {
  if (e.detail?.screen !== 'kalender') return;
  loadMaterials().then(render);
  loadPlans().then(render);
});

export function initKalender() {
  if (inited) return;
  inited = true;

  el('kalTabJadwal')?.addEventListener('click', () => { kalTab = 'jadwal'; render(); });
  el('kalTabMateri')?.addEventListener('click', () => { kalTab = 'materi'; render(); });
}

// Dipakai modul lain (mis. Sosmed) untuk membuka tab kalender.
window.openKalender = function (tab = 'jadwal') {
  kalTab = tab;
  window.switchScreen?.('kalender');
};
