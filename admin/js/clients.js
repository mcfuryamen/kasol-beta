/**
 * Admin Marketing KASIRSOLO — Clients Module (CRM)
 * Menampilkan & mengelola profil klien yang tersinkron dari app klien (kaki5 dll)
 * ke tabel Supabase `clients`. Kartu klien bisa langsung GENERATE lisensi
 * (tanpa pindah ke menu Lisensi) + kirim serial ke WhatsApp merchant.
 * Analitik: total outlet, aktif 30 hari, per app, sebaran wilayah.
 *
 * Akses: semua data lewat supabaseFetch() → Vercel Serverless /api/rest
 * (service_role key hanya server-side, tidak pernah di browser).
 */

import { showToast } from './toast.js';
import { escapeHtml, formatRelativeTime, formatDate, normalizePhone, debounce } from './utils.js';
import { STATE, setState } from './app-state.js';
import { supabaseFetch, supabaseStorageSign, licenseApi } from './api.js';
import { updateSidebarBadges } from './navigation.js?v=20260812i';
import { formatExpiry } from './license-core.js';

// app_type → produk (HANYA metadata: prefix/ikon/label).
// SECURITY (Fix C1): HMAC salt TIDAK lagi di client — generate/verify lisensi
// dipindah ke Vercel Serverless /api/license yang memegang salt server-side.
export const APP_META = {
  kaki5:  { prefix: 'KK5', icon: '🛵', label: 'Kaki Lima' },
  rosok:  { prefix: 'KSR', icon: '♻️', label: 'Rosok' },
  gerobak:{ prefix: 'GBK', icon: '🛒', label: 'Gerobak' },
  retail: { prefix: 'RTL', icon: '🏪', label: 'Retail' }
};
const catalogProductFor = (at) => (STATE.catalog || []).find((p) => p.appType === at) || null;
const metaFor = (at) => {
  const product = catalogProductFor(at);
  const fallback = APP_META[at] || { prefix: '', icon: '📦', label: (at || 'Lain') };
  return {
    ...fallback,
    icon: product?.icon || fallback.icon,
    label: product?.name || fallback.label,
    kodeProduk: product?.kodeProduk || fallback.prefix || ''
  };
};

let clients = [];

const DAYS = 30 * 24 * 60 * 60 * 1000;
const isActive = (c) => c.last_seen && (Date.now() - new Date(c.last_seen).getTime()) < DAYS;

/** Init module — pipeline tunggal dari tabel `clients` */
export async function initClients() {
  document.getElementById('clientsSearch')?.addEventListener('input', renderAll);
  document.getElementById('clientsAppFilter')?.addEventListener('change', renderAll);

  window.addEventListener('screen:change', (e) => {
    if (e.detail?.screen === 'klien') { loadClients(); }
  });
  await loadClients();
}

/** View mode saat ini: 'analitik' | 'kelola' */
let clientView = 'analitik';
function switchClientView(view) {
  clientView = view;
  document.querySelectorAll('.client-view-btn[data-view]').forEach((btn) => {
    const on = btn.dataset.view === view;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', String(on));
  });
  const anEl = document.getElementById('analyticsView');
  const kanEl = document.getElementById('kanbanView');
  if (anEl) anEl.hidden = view !== 'analitik';
  if (kanEl) kanEl.hidden = view !== 'kelola';
  if (view === 'kelola') renderKanban();
  else renderAnalytics();
}
window.switchClientView = switchClientView;

/** Pipeline stages — satu tabel `clients` */
const PIPELINE_STAGES = [
  { key: 'baru', label: '🆕 Baru', tone: 'blue' },
  { key: 'dihubungi', label: '📞 Dihubungi', tone: 'orange' },
  { key: 'tertarik', label: '💡 Tertarik', tone: 'amber' },
  { key: 'menunggu_verifikasi', label: '⏳ Verifikasi', tone: 'teal' },
  { key: 'aktif', label: '✅ Aktif', tone: 'green' },
  { key: 'batal', label: '❌ Batal', tone: 'red' },
];

function stageMeta(status) {
  return PIPELINE_STAGES.find((s) => s.key === status) || { key: status, label: status || 'Tanpa status', tone: 'gray' };
}

/** Aksen kartu mengikuti konteks status */
function statusAccent(status) {
  return 'kb-acc-' + stageMeta(status).tone;
}

/** Baris konteks status pada kartu */
function statusCtxHtml(c, esc) {
  const sm = stageMeta(c.status);
  const on = isActive(c);
  switch (c.status) {
    case 'baru': return `<span class="kb-card-ctx">🆕 Lead baru — belum dihubungi</span>`;
    case 'dihubungi': return `<span class="kb-card-ctx">📞 Sudah dihubungi</span>`;
    case 'tertarik': return `<span class="kb-card-ctx">💡 Tertarik — siap ditawarkan</span>`;
    case 'menunggu_verifikasi':
      return c.bukti_url
        ? `<span class="kb-bukti" data-bukti="${esc(c.bukti_url)}">🧾 Lihat Bukti</span>`
        : `<span class="kb-card-ctx">⏳ Menunggu verifikasi</span>`;
    case 'aktif':
      return `<span class="kb-card-ctx ${on ? 'on' : 'off'}">${on ? '🟢 Online' : '⚪ Offline'}${c.serial ? ' · 🔑 ' + esc(String(c.serial).slice(0, 10)) + '…' : ''}</span>`;
    case 'batal': return `<span class="kb-card-ctx">❌ Batal — lisensi nonaktif</span>`;
    default: return `<span class="kb-card-ctx">${esc(sm.label)}</span>`;
  }
}

/** Tombol utama kartu, berubah sesuai konteks status */
function statusCta(c, esc) {
  const id = esc(c.id);
  // Buka akordeon kartu + sekaligus sub-akordeon "Kelola Klien"
  const open = `toggleCardDetail(this.closest('.kanban-card').querySelector('.kb-head'));` +
               `toggleKbManage(this.closest('.kanban-card').querySelector('.kb-manage-t'));`;
  switch (c.status) {
    case 'baru': return `<button type="button" class="btn btn-primary btn-sm" onclick="moveStage('${id}','next')">📞 Hubungi</button>`;
    case 'dihubungi': return `<button type="button" class="btn btn-primary btn-sm" onclick="moveStage('${id}','next')">💡 Tawarkan</button>`;
    case 'tertarik': return `<button type="button" class="btn btn-primary btn-sm" onclick="moveStage('${id}','next')">⏳ Minta Verifikasi</button>`;
    case 'menunggu_verifikasi': return `<button type="button" class="btn btn-primary btn-sm" onclick="${open}">🔍 Verifikasi</button>`;
    case 'aktif': return `<button type="button" class="btn btn-primary btn-sm" onclick="${open}">⚙️ Kelola</button>`;
    case 'batal': return `<button type="button" class="btn btn-outline btn-sm" onclick="${open}">↩️ Pulihkan</button>`;
    default: return `<button type="button" class="btn btn-outline btn-sm" onclick="${open}">Buka</button>`;
  }
}

/** Update status pipeline klien (prev/next tab status) */
async function updateClientStatus(id, status) {
  const prev = clients.find((c) => c.id === id);
  if (!prev) return;
  clients = clients.map((c) => c.id === id ? { ...c, status } : c);

  if (clientView === 'kelola') renderKanban(); else renderAnalytics();
  updateSidebarBadges({ clients: clients.length });

  try {
    const res = await supabaseFetch(`/rest/v1/clients?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      data: { status },
      headers: { Prefer: 'return=representation' }
    });
    if (!res.ok) throw new Error('Failed to update status');
    showToast(`Status → ${stageMeta(status).label.slice(2)}`, 1800, 'success');
  } catch (e) {
    clients = clients.map((c) => c.id === id ? prev : c);
    if (clientView === 'kelola') renderKanban(); else renderAnalytics();
    console.error(e);
    showToast('Gagal update status', 2000, 'error');
  }
}

/** Render all (stats + view aktif) */
function renderAll() {
  if (clientView === 'kelola') renderKanban();
  else renderAnalytics();
}

/** Tab kanban aktif: 'semua' | stage key */
let kanbanTab = 'semua';

/** Render kanban Tab-per-Status (bukan board kolom) */
function renderKanban() {
  const host = document.getElementById('kanbanBoard');
  if (!host) return;
  host.hidden = false; // pastikan board tampil (bisa ke-set true oleh flow openClient)
  const q = (document.getElementById('clientsSearch')?.value || '').toLowerCase();
  const qNorm = (c) => [c.nama_warung, c.nama_pemilik, c.device_code, c.no_whatsapp, c.email, c.kabkota, c.provinsi, c.unit_id, c.serial]
    .some((v) => (v || '').toLowerCase().includes(q));
  const appF = document.getElementById('clientsAppFilter')?.value || '';
  const rows = clients.filter((c) => {
    if (appF && c.app_type !== appF) return false;
    return q ? qNorm(c) : true;
  });

  if (!clients.length) {
    host.innerHTML = `<div class="empty-state">Belum ada klien. Data otomatis muncul di sini saat aplikasi klien pertama kali terhubung.</div>`;
    return;
  }

  const tab = (key, label, n, tone) => `
    <button type="button" class="kb-tab ${kanbanTab === key ? 'active' : ''}" data-stage="${key}" role="tab" aria-selected="${kanbanTab === key}">
      ${label} <span class="badge ${tone}">${n}</span>
    </button>`;

  const tabs = `
    <div class="kb-tabs" role="tablist">
      ${tab('semua', 'Semua', rows.length, 'gray')}
      ${PIPELINE_STAGES.map((st) => tab(st.key, st.label, rows.filter((c) => c.status === st.key).length, st.tone)).join('')}
    </div>`;

  const shown = kanbanTab === 'semua' ? rows : rows.filter((c) => c.status === kanbanTab);
  const shownMeta = kanbanTab === 'semua' ? null : stageMeta(kanbanTab);
  const productPrices = STATE.catalog || [];
  const priceForClient = (c) => Number(productPrices.find((p) => p.appType === c.app_type)?.price) || 0;
  const subtotal = shown.reduce((a, c) => a + priceForClient(c), 0);

  const cards = shown.length
    ? shown.map(kanbanCardHtml).join('')
    : `<div class="kb-drop-hint">Belum ada kartu di ${shownMeta ? shownMeta.label : 'filter ini'}. Ubah status lewat detail.</div>`;

  host.innerHTML = tabs + `
    <div class="kb-tab-panel">
      <div class="kb-tab-head">
        <span class="kb-tab-title">${shownMeta ? shownMeta.label : 'Semua Klien'}</span>
        <span class="kb-tab-total">${shown.length} kartu${subtotal ? ' · Rp ' + subtotal.toLocaleString('id-ID') : ''}</span>
      </div>
      <div class="kb-tab-list">${cards}</div>
    </div>`;

  host.querySelectorAll('.kb-tab').forEach((t) => {
    t.addEventListener('click', () => { kanbanTab = t.dataset.stage; renderKanban(); });
  });
  host.querySelectorAll('.kb-bukti').forEach((el) => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      const raw = el.dataset.bukti;
      if (!raw) return;
      try {
        el.textContent = '⏳ Membuka bukti…';
        const marker = '/storage/v1/object/';
        const idx = raw.indexOf(marker);
        if (idx < 0) throw new Error('URL bukti tidak valid');
        const tail = raw.slice(idx + marker.length);
        const parts = tail.split('/').filter(Boolean);
        const visibility = parts.shift();
        const bucket = visibility === 'public' || visibility === 'sign' ? parts.shift() : visibility;
        const objectPath = parts.join('/');
        if (bucket !== 'bukti' || !objectPath || objectPath.includes('..')) throw new Error('Path bukti tidak valid');
        const signed = await supabaseStorageSign(bucket, objectPath);
        if (!signed.ok || !signed.data?.url) throw new Error('Gagal membuat link bukti');
        window.open(signed.data.url, '_blank', 'noopener');
      } catch (err) {
        console.error(err);
        showToast('Foto bukti tidak dapat dibuka', 2200, 'error');
      } finally { el.textContent = '🧾 Lihat Bukti'; }
    });
  });
  // Klik kartu = buka akordeon detail (tombol/menu/head di dalam kartu diabaikan)
  host.querySelectorAll('.kanban-card').forEach((card) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('button') || e.target.closest('.kb-card-menu-pop') || e.target.closest('.kb-head')) return;
      const head = card.querySelector('.kb-head');
      if (head && !card.querySelector('.kb-detail')?.classList.contains('open')) {
        toggleCardDetail(head);
      }
    });
  });
  host.querySelectorAll('.kb-menu-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); toggleKbMenu(btn); });
  });
  // one-time: tutup semua popup menu saat klik di luar
  if (!window.__kbMenuCloseBound) {
    window.__kbMenuCloseBound = true;
    document.addEventListener('click', () => {
      document.querySelectorAll('.kb-card-menu-pop.open').forEach((p) => p.classList.remove('open'));
    });
  }
    maybeOpenPending();
  }

  /** Toggle popup menu aksi kartu */
function toggleKbMenu(btn) {
  const card = btn.closest('.kanban-card');
  if (!card) return;
  const all = card.querySelectorAll('.kb-card-menu-pop');
  all.forEach((p) => p.classList.toggle('open'));
  // posisikan pop (jangan keluar viewport)
  const pop = card.querySelector('.kb-card-menu-pop');
  if (pop && pop.classList.contains('open')) {
    const r = pop.getBoundingClientRect();
    if (r.right > window.innerWidth) pop.style.right = '0'; else pop.style.right = '';
  }
}
window.toggleKbMenu = toggleKbMenu;

function kanbanCardHtml(c) {
  const m = metaFor(c.app_type);
  const sm = stageMeta(c.status);
  const esc = escapeHtml;
  const wil = [c.desa, c.kecamatan, c.kabkota].filter(Boolean).join(', ');
  const idx = PIPELINE_STAGES.findIndex((s) => s.key === c.status);
  const isBatal = c.status === 'batal';
  const harga = Number(catalogProductFor(c.app_type)?.price) || 0;
  const serial = c.serial ? String(c.serial) : '';
  const lic = (c.license_status || '').toLowerCase();
  // Progress posisi di pipeline (persen dari urutan stage)
  const progressPct = idx >= 0 ? Math.round(((idx + 0.5) / PIPELINE_STAGES.length) * 100) : 0;
  const contact = c.no_whatsapp
    ? `<span>💬${esc(c.no_whatsapp)}</span>`
    : (c.email ? `<span>✉️${esc(c.email)}</span>` : '');

  // Info lisensi / verifikasi (muncul hanya bila tersedia)
  const licLine = [];
  if (lic === 'aktif' || lic === 'active') licLine.push('<span class="kb-lic on">✓ Lisensi Aktif</span>');
  else if (c.activated_at) licLine.push('<span class="kb-lic">✓ Diaktifkan ' + esc(formatDate(c.activated_at)) + '</span>');
  if (c.verified_at) licLine.push('<span class="kb-lic">🔎 Verifikasi ' + esc(formatDate(c.verified_at)) + '</span>');
  const licHtml = licLine.length ? `<div class="kb-card-lic">${licLine.join('')}</div>` : '';

  // Fakta kunci (label + nilai) — tampil hanya bila tersedia
  const facts = [];
  if (c.nama_pemilik) facts.push(`<div class="kb-fact"><span class="kb-fact-l">Pemilik</span><span class="kb-fact-v">${esc(c.nama_pemilik)}</span></div>`);
  if (contact) facts.push(`<div class="kb-fact"><span class="kb-fact-l">Kontak</span><span class="kb-fact-v">${contact}</span></div>`);
  if (wil) facts.push(`<div class="kb-fact kb-fact-wide"><span class="kb-fact-l">Lokasi</span><span class="kb-fact-v">${esc(wil)}</span></div>`);

  // Prefix ID unik per kartu agar input/tombol tidak bentrok antar kartu
  const u = 'kc' + Math.random().toString(36).slice(2, 8);

  return `
    <div class="kanban-card ${statusAccent(c.status)}${isBatal ? ' kb-card-batal' : ''}" data-client-id="${esc(c.id)}">
      <div class="kb-progress" style="width:${progressPct}%"></div>
      <div class="kb-head" role="button" tabindex="0" aria-expanded="false" onclick="toggleCardDetail(this)">
        <span class="client-avatar">${m.icon}</span>
        <div class="kb-title">
          <strong class="kb-card-name">${esc(c.nama_warung || '—')}</strong>
          <span class="kb-card-sub">${esc(m.label)}${m.kodeProduk ? ' · ' + esc(m.kodeProduk) : ''}${c.device_code ? ' · ' + esc(c.device_code) : ''}</span>
        </div>
        <span class="kb-status ${sm.tone}">${sm.label}</span>
        <span class="kb-chev">▾</span>
      </div>
      ${c.source ? `<div class="kb-src">${esc(c.source)}</div>` : ''}
      <div class="kb-ctx">${statusCtxHtml(c, esc)}</div>
            <div class="kb-cta kb-cta-card">${statusCta(c, esc)}</div>
            <div class="kb-detail">
              <div class="kb-detail-inner">
                <div class="kb-cta kb-cta-open">${statusCta(c, esc)}</div>
                ${facts.length ? `<div class="kb-facts">${facts.join('')}</div>` : ''}
          <div class="kb-deal">
            <span class="kb-price">${harga ? 'Rp ' + harga.toLocaleString('id-ID') : 'Harga —'}</span>
            <span class="kb-deal-side">${serial ? `<span class="kb-serial">🔑 ${esc(serial.slice(0, 12))}…</span>` : `<span class="kb-age">🕑 ${formatLeadAge(c.first_seen)}</span>`}</span>
          </div>
          ${licHtml}

          <!-- Kelola Klien: info baca doang + aksi lisensi (scoped per kartu) -->
          <div class="kb-manage">
            <button type="button" class="kb-manage-t" aria-expanded="false" onclick="toggleKbManage(this)">
              <span>⚙️ Detail & Aksi</span><span class="kb-chev">▾</span>
            </button>
            <div class="kb-manage-b">

              <!-- Info baca doang (tanpa kotak isian) -->
              <div class="section-label">📋 Data Klien</div>
              <div class="kb-info">
                ${c.unit_id !== undefined && c.unit_id !== null && c.unit_id !== '' ? `<div class="kb-info-r"><span class="kb-info-l">Unit ID</span><span class="kb-info-v mono">${esc(c.unit_id)}</span></div>` : ''}
                <div class="kb-info-r"><span class="kb-info-l">Aplikasi</span><span class="kb-info-v">${m.icon} ${esc(m.label)}${m.kodeProduk ? ' · ' + esc(m.kodeProduk) : ''}</span></div>
                <div class="kb-info-r"><span class="kb-info-l">Device Code</span><span class="kb-info-v mono">${esc(c.device_code || '—')}</span></div>
                <div class="kb-info-r"><span class="kb-info-l">Nama Usaha</span><span class="kb-info-v">${esc(c.nama_warung || '—')}</span></div>
                <div class="kb-info-r"><span class="kb-info-l">Nama Pemilik</span><span class="kb-info-v">${esc(c.nama_pemilik || '—')}</span></div>
                <div class="kb-info-r"><span class="kb-info-l">Kontak</span><span class="kb-info-v">${c.no_whatsapp ? '💬' + esc(c.no_whatsapp) : (c.email ? '✉️' + esc(c.email) : '—')}</span></div>
                ${c.alamat_detail ? `<div class="kb-info-r"><span class="kb-info-l">Alamat</span><span class="kb-info-v">${esc(c.alamat_detail)}${wil ? ' · ' + esc(wil) : ''}</span></div>` : (wil ? `<div class="kb-info-r"><span class="kb-info-l">Wilayah</span><span class="kb-info-v">${esc(wil)}</span></div>` : '')}
                ${harga ? `<div class="kb-info-r"><span class="kb-info-l">Harga Deal</span><span class="kb-info-v">Rp ${harga.toLocaleString('id-ID')}</span></div>` : ''}
                <div class="kb-info-r"><span class="kb-info-l">Dilihat</span><span class="kb-info-v">🕒 ${formatRelativeTime(c.last_seen)}</span></div>
              </div>

              <div class="section-label mt16">⚡ Generate Lisensi</div>
              <div class="field-grid mt8">
                <div class="field"><label class="field-label">Masa Aktif</label>
                  <select data-kf="days">
                    <option value="30">1 Bulan</option>
                    <option value="90">3 Bulan</option>
                    <option value="180">6 Bulan</option>
                    <option value="365" selected>1 Tahun</option>
                    <option value="730">2 Tahun</option>
                    <option value="99">Seumur Hidup</option>
                  </select>
                </div>
                <div class="field field-span-2"><label class="field-label">Hasil Serial</label>
                  <textarea data-kf="serialOut" readonly rows="2" class="input-mono" placeholder="Serial muncul di sini"></textarea>
                  <div class="btn-block-row mt8">
                    <button type="button" class="btn btn-primary" onclick="genCardSerial(this)">🔑 Generate</button>
                    <button type="button" class="btn btn-outline" onclick="copyCardSerial(this)">📋 Copy</button>
                    <button type="button" class="btn btn-outline" onclick="sendCardSerialWA(this)">💬 Kirim WA</button>
                  </div>
                </div>
              </div>

              <div class="section-label mt16">🔎 Verifikasi Serial</div>
              <div class="field-grid mt8">
                <div class="field field-span-2"><label class="field-label">Serial Number</label>
                  <input type="text" data-kf="ver" class="input-mono" placeholder="Serial yang akan dicek" value="${esc(serial || '')}">
                </div>
                <div class="field field-span-2">
                  <button type="button" class="btn btn-outline" onclick="verifyCardSerial(this)">✅ Verifikasi</button>
                  <div class="verify-box mt8" data-kf="verRes" hidden></div>
                </div>
              </div>

            </div>
          </div>

          <div class="kb-foot">
            <span class="kb-time">🕒 ${formatRelativeTime(c.last_seen)}</span>
            <div class="kb-actions">
              <div class="kb-card-menu">
                <button type="button" class="btn btn-ghost btn-sm kb-menu-btn" title="Aksi lain" aria-label="Menu aksi">⋯</button>
                <div class="kb-card-menu-pop">
                  <button type="button" data-act="manage" onclick="toggleKbManage(this.closest('.kanban-card').querySelector('.kb-manage-t'))">⚙️ Kelola Klien</button>
                  <button type="button" data-act="prev" ${idx <= 0 ? 'disabled' : ''} onclick="moveStage('${esc(c.id)}','prev')">⬅️ Status sebelumnya</button>
                  <button type="button" data-act="next" ${idx < 0 || idx >= PIPELINE_STAGES.length - 1 ? 'disabled' : ''} onclick="moveStage('${esc(c.id)}','next')">➡️ Status berikutnya</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

/** Toggle sub-akordeon "Kelola Klien" pada kartu */
window.toggleKbManage = function (btn) {
  const mb = btn && btn.nextElementSibling;
  if (!mb) return;
  const isOpen = mb.classList.toggle('kb-manage-open');
  btn.setAttribute('aria-expanded', String(isOpen));
  if (isOpen && mb.scrollIntoView) mb.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
};

/** Ambil kartu + data klien dari sebuah tombol/elemen di dalam kartu */
function kbPer(btn) {
  const card = btn.closest('.kanban-card');
  const id = card && card.getAttribute('data-client-id');
  const c = clients.find((x) => x.id === id) || null;
  return { card, c };
}
function kbVal(card, key) {
  const el = card && card.querySelector(`[data-kf="${key}"]`);
  return el ? el.value.trim() : '';
}
function kbSet(card, key, value) {
  const el = card && card.querySelector(`[data-kf="${key}"]`);
  if (el) el.value = value;
}

/** Generate serial untuk klien di kartu ini */
window.genCardSerial = async function (btn) {
  const { card, c } = kbPer(btn);
  if (!c) return;
  const m = metaFor(c.app_type);
  if (!m.prefix) { showToast('Produk klien belum dikenal / belum ada prefix', 2000, 'warning'); return; }
  const rawDevice = c.device_code || '';
  if (!rawDevice) { showToast('Device Code kosong', 2000, 'warning'); return; }
  const days = parseInt(kbVal(card, 'days') || '365', 10);
  let expCode = '99';
  if (days <= 30) expCode = '01';
  else if (days <= 90) expCode = '03';
  else if (days <= 180) expCode = '06';
  else if (days <= 365) expCode = '12';
  else if (days <= 730) expCode = '24';
  else if (days <= 1095) expCode = '36';
  else if (days <= 1825) expCode = '60';
  const res = await licenseApi('generate', { prefix: m.prefix, deviceCode: rawDevice, expCode });
  if (!res.ok) {
    const msg = res.data?.error || `Gagal generate (${res.status})`;
    showToast('Gagal membuat serial: ' + msg, 3000, 'error');
    return;
  }
  kbSet(card, 'serialOut', res.data.serial);
  showToast('✅ Serial berhasil dibuat!', 2000, 'success');
};

/** Copy serial dari kartu ini */
window.copyCardSerial = async function (btn) {
  const { card } = kbPer(btn);
  const v = kbVal(card, 'serialOut');
  if (!v) { showToast('Generate dulu', 2000, 'warning'); return; }
  try {
    await navigator.clipboard.writeText(v);
    showToast('Serial disalin', 2000, 'success');
  } catch { showToast('Gagal menyalin', 2000, 'error'); }
};

/** Verifikasi serial klien di kartu ini (server-side HMAC) */
window.verifyCardSerial = async function (btn) {
  const { card, c } = kbPer(btn);
  if (!c) return;
  const m = metaFor(c.app_type);
  if (!m.prefix) { showToast('Produk klien belum dikenal / belum ada prefix', 2000, 'warning'); return; }
  const serial = kbVal(card, 'ver');
  if (!serial) { showToast('Masukkan serial yang ingin diverifikasi', 2000, 'warning'); return; }
  const deviceCode = c.device_code || '';
  if (!deviceCode) { showToast('Device Code kosong', 2000, 'warning'); return; }
  const res = await licenseApi('verify', { prefix: m.prefix, serial, deviceCode });
  const box = card.querySelector('[data-kf="verRes"]');
  const verMsg = (cls, html) => {
    if (box) { box.innerHTML = html; box.className = 'verify-box mt8 ' + cls; box.hidden = false; }
  };
  if (!res.ok || !res.data) {
    const msg = res.data?.error || `Gagal verifikasi (${res.status})`;
    verMsg('verify-error', `<div class="verify-badge error">❌ ERROR</div><div class="verify-detail">${esc(msg)}</div>`);
    showToast('Error saat verifikasi: ' + msg, 3000, 'error');
    return;
  }
  const result = res.data;
  const pname = m.label;
  if (result.valid && !result.expired) {
    verMsg('verify-success', `<div class="verify-badge success">✅ VALID</div><div class="verify-detail">Produk: ${esc(pname)}<br>Device Code: ${esc(result.deviceCode)}<br>Masa Berlaku: ${esc(result.expiryText || formatExpiry(result.expCode))}<br><small>Status: Aktif</small></div>`);
    showToast('Serial valid', 2000, 'success');
  } else if (result.valid && result.expired) {
    verMsg('verify-warning', `<div class="verify-badge warning">⚠️ KADALUARSA</div><div class="verify-detail">Produk: ${esc(pname)}<br>Device Code: ${esc(result.deviceCode)}<br>Kadaluarsa: ${esc(result.expiryText || formatExpiry(result.expCode))}<br><small>Serial valid tapi masa berlaku habis</small></div>`);
    showToast('Serial kadaluarsa', 2500, 'warning');
  } else {
    verMsg('verify-error', `<div class="verify-badge error">❌ TIDAK VALID</div><div class="verify-detail">Serial tidak cocok dengan Device Code atau salt produk.<br>Periksa kembali input Anda.</div>`);
    showToast('Serial tidak valid', 2000, 'error');
  }
};

/** Kirim serial ke WhatsApp merchant */
window.sendCardSerialWA = function (btn) {
  const { card, c } = kbPer(btn);
  if (!c) return;
  const serial = kbVal(card, 'serialOut');
  if (!serial) { showToast('Generate dulu', 2000, 'warning'); return; }
  const nama = c.nama_warung || 'Usaha Anda';
  const text = `Halo *${nama}*,\nIni kode lisensi Kasir Solo Anda:\n\n*${serial}*\n\nAktifkan di aplikasi pada menu Lisensi. Terima kasih 🙏\n— PT Mesin Kasir Solo`;
  const wa = normalizePhone(c.no_whatsapp || '');
  const target = wa || '628816566935';
  window.open('https://wa.me/' + encodeURIComponent(target) + '?text=' + encodeURIComponent(text), '_blank');
};

/** Toggle akordeon detail kartu kanban */
window.toggleCardDetail = function (headEl) {
  const card = headEl.closest('.kanban-card');
  if (!card) return;
  const detail = card.querySelector('.kb-detail');
  if (!detail) return;
  const isOpen = detail.classList.toggle('open');
  card.classList.toggle('expanded', isOpen);
  headEl.setAttribute('aria-expanded', String(isOpen));
};

/** Umur lead dalam teks ramah (dari first_seen / created_at) */
function formatLeadAge(firstSeen) {
  const t = firstSeen ? new Date(firstSeen).getTime() : null;
  if (!t) return '—';
  const d = Math.max(0, Math.floor((Date.now() - t) / 86400000));
  if (d === 0) return 'baru';
  if (d < 30) return d + ' hari';
  const mo = Math.floor(d / 30);
  return mo + ' bln';
}

/** Pindah kartu ke tahap lain — dir='prev'|'next' ATAU key stage langsung */
function moveStage(id, dir) {
  const c = clients.find((x) => x.id === id);
  if (!c) return;
  let target;
  if (dir === 'next') {
    const idx = PIPELINE_STAGES.findIndex((s) => s.key === c.status);
    if (idx < 0 || idx >= PIPELINE_STAGES.length - 1) return;
    target = PIPELINE_STAGES[idx + 1].key;
  } else if (dir === 'prev') {
    const idx = PIPELINE_STAGES.findIndex((s) => s.key === c.status);
    if (idx <= 0) return;
    target = PIPELINE_STAGES[idx - 1].key;
  } else {
    // target stage key langsung (dari drag & drop)
    if (!PIPELINE_STAGES.some((s) => s.key === dir) || dir === c.status) return;
    target = dir;
  }
  updateClientStatus(id, target);
}
window.moveStage = moveStage;

/** Open client accordion dari dashboard: pindah ke view Kelola + buka akordeon kartu tsb */
let pendingOpenId = null;
window.openClientAccordion = async function (id) {
  pendingOpenId = id;
  try { if (window.showScreen) window.showScreen('klien', 'kelola'); } catch { try { window.showScreen('klien'); } catch {} }
  // tunggu semua load asinkron (coalesced) selesai supaya render final punya kartu terbaru
  await loadClients();
  // set ulang pending SETELAH render asinkron, lalu render sekali lagi agar terbuka & ter-scroll
  pendingOpenId = id;
  if (typeof renderKanban === 'function') renderKanban();
  openPendingCard();
};

/** Buka kartu pendingOpenId setelah DOM dirender (dipanggil dari renderKanban) */
function maybeOpenPending() {
  if (!pendingOpenId) return;
  const id = pendingOpenId;
  const card = document.querySelector(`.kanban-card[data-client-id="${CSS.escape(id)}"]`);
  if (!card) return; // kartu belum ada — tetap pending, akan coba lagi setelah load asinkron
  pendingOpenId = null;
  // pastikan tab "Semua" / tab berisi kartu tsb
  kanbanTab = 'semua';
  const head = card.querySelector('.kb-head');
  if (head && !card.querySelector('.kb-detail')?.classList.contains('open')) toggleCardDetail(head);
  requestAnimationFrame(() => card.scrollIntoView({ block: 'center', behavior: 'smooth' }));
}
function openPendingCard() {
  maybeOpenPending();
}

/** Load all clients from Supabase */
async function loadClients() {
  if (loadClients._inflight) return loadClients._inflight;
  const p = (async () => {
    try {
      const res = await supabaseFetch('/rest/v1/clients?order=last_seen.desc');
      clients = res.ok ? (res.data || []) : [];
    } catch (e) {
      clients = [];
      console.error('load clients', e);
    }
    renderAll();
    updateSidebarBadges({ clients: clients.length });
    setState('clients', clients);
  })();
  loadClients._inflight = p;
  try { return await p; } finally { loadClients._inflight = null; }
}
window.refreshClients = loadClients;

/** Render dashboard analitik khusus klien (view "Analitik") */
function renderAnalytics() {
  const host = document.getElementById('analyticsBody');
  if (!host) return;

  const q = (document.getElementById('clientsSearch')?.value || '').toLowerCase();
  const appF = document.getElementById('clientsAppFilter')?.value || '';
  const rows = clients.filter((c) => {
    if (appF && c.app_type !== appF) return false;
    if (!q) return true;
    return [c.nama_warung, c.nama_pemilik, c.device_code, c.no_whatsapp, c.kabkota, c.provinsi]
      .some((v) => (v || '').toLowerCase().includes(q));
  });

  if (!rows.length) {
    host.innerHTML = `<div class="empty-state"><div class="empty-ic">📊</div><div class="empty-t">Belum ada data klien</div><div class="empty-d">Data analitik muncul saat klien pertama kali terhubung.</div></div>`;
    return;
  }

  const total = rows.length;
  const active = rows.filter(isActive).length;
  const aktifDeal = rows.filter((c) => c.status === 'aktif').length;
  const priceForClient = (c) => Number((STATE.catalog || []).find((p) => p.appType === c.app_type)?.price) || 0;
  const potensi = rows.reduce((a, c) => a + priceForClient(c), 0);

  // Per status pipeline
  const perStatus = PIPELINE_STAGES.map((st) => {
    const list = rows.filter((c) => c.status === st.key);
    return { ...st, n: list.length, rev: list.reduce((a, c) => a + priceForClient(c), 0) };
  });
  const maxStage = Math.max(1, ...perStatus.map((s) => s.n));

  // Per aplikasi
  const perApp = Object.entries(APP_META).map(([at, m]) => ({
    ...m, key: at, n: rows.filter((c) => c.app_type === at).length
  })).filter((x) => x.n > 0);
  const appTotal = perApp.reduce((a, x) => a + x.n, 0);
  const maxApp = Math.max(1, ...perApp.map((x) => x.n));

  // Sebaran wilayah (kabkota/provinsi)
  const wil = {};
  rows.forEach((c) => {
    const w = c.kabkota || c.provinsi;
    if (w) wil[w] = (wil[w] || 0) + 1;
  });
  const topWilayah = Object.entries(wil).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const maxWil = Math.max(1, ...topWilayah.map(([, n]) => n));

  const barStage = perStatus.filter((s) => s.n > 0).map((s) => `
    <div class="bar-row">
      <span class="bar-label">${s.label}</span>
      <div class="bar-track"><div class="bar-fill tone-${s.tone}" style="width:${(s.n / maxStage) * 100}%"></div></div>
      <span class="bar-num">${s.n}</span>
    </div>`).join('') || `<div class="text-xs" style="color:var(--text2)">Belum ada klien di pipeline ini.</div>`;

  const barApp = perApp.map((x) => `
    <div class="bar-row">
      <span class="bar-label">${x.icon} ${escapeHtml(x.label)}</span>
      <div class="bar-track"><div class="bar-fill" style="width:${(x.n / maxApp) * 100}%"></div></div>
      <span class="bar-num">${x.n}</span>
    </div>`).join('');

  const barWil = topWilayah.map(([w, n]) => `
    <div class="bar-row">
      <span class="bar-label">${escapeHtml(w)}</span>
      <div class="bar-track"><div class="bar-fill tone-teal" style="width:${(n / maxWil) * 100}%"></div></div>
      <span class="bar-num">${n}</span>
    </div>`).join('') || `<div class="text-xs" style="color:var(--text2)">Belum ada data wilayah.</div>`;

  host.innerHTML = `
    <div class="stat-grid" style="margin-bottom:var(--s5)">
      <div class="stat-card"><div class="stat-label">👥 Total Klien</div><div class="stat-value">${total}</div></div>
      <div class="stat-card"><div class="stat-label">✅ Aktif / Deal</div><div class="stat-value green">${aktifDeal}</div></div>
      <div class="stat-card"><div class="stat-label">🟢 Aktif 30 Hari</div><div class="stat-value green">${active}</div></div>
      <div class="stat-card"><div class="stat-label">💰 Potensial Revenue</div><div class="stat-value orange">Rp ${potensi.toLocaleString('id-ID')}</div></div>
    </div>

    <div class="an-grid">
      <div class="an-box">
        <h4 class="an-title">Pipeline per Status</h4>
        ${barStage}
      </div>
      <div class="an-box">
        <h4 class="an-title">Klien per Aplikasi</h4>
        ${barApp}
        <div class="text-xs" style="color:var(--text2);margin-top:var(--s3)">Total ${appTotal} klien</div>
      </div>
      <div class="an-box">
        <h4 class="an-title">Sebaran Wilayah</h4>
        ${barWil}
      </div>
    </div>
  `;
}
