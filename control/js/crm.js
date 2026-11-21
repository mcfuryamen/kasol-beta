/**
 * Control Center Kasir Solo — Modul CRM (Kontak | Klien | Mitra | Outreach)
 * =============================================================================
 * Merge modul Klien + Mitra jadi satu modul CRM (keputusan owner, 2026-10-28).
 *
 *   · Tab "Kontak"  — render view SQL terpadu `crm_contacts` (gabungan tabel
 *     clients + referral_partners; 1 baris = 1 orang, kolom kinds = tipenya).
 *   · Tab "Klien"   — modul clients.js utuh (markup dipindah ke index.html,
 *     ID element tetap; init & aksi tidak berubah).
 *   · Tab "Mitra"   — modul partners.js utuh (pola sama).
 *   · Tab "Outreach" — modul outreach.js utuh (layar mandiri melebur jadi tab
 *     ke-4; menu sidebar/bottom-nav lama dihapus, hash #outreach di-redirect).
 *
 * crm.js hanya pegang: tab-switching (#crm?tab=...), view kontak, dan flip page
 * detail 360° (#crmContactPage, gaya halaman detail katalog). Semua aksi tulis
 * tetap di modul asalnya — halaman 360° cuma jembatan (buka detail
 * klien/mitra penuh yang sudah ada).
 *
 * Akses data: supabaseFetch() → proxy /api/rest (service_role di server).
 * Tabel yang dipakai di sini: crm_contacts + referral_wallets +
 * payout_requests (semuanya sudah di whitelist rest.js/server.js).
 * =============================================================================
 */

import { escapeHtml, formatRelativeTime, formatDate, formatRupiah, normalizePhone } from './utils.js';
import { showToast } from './toast.js';
import { supabaseFetch } from './api.js';
import { initClients, stageMeta } from './clients.js';
import { initPartnersTab } from './partners.js';
import { plainLabel } from './icons.js';

/* =================== State =================== */

let contacts = [];
let contactFilter = 'all';   // 'all' | 'klien' | 'mitra'
let contactQuery = '';
let contactLoadFailed = false;

const CRM_TABS = ['kontak', 'klien', 'mitra', 'outreach'];
let activeTab = 'kontak';

// Escape menutup satu flip page CRM teratas; sheet lain (mis. composer WA)
// tetap mendapat prioritas dan tidak ikut menutup halaman di belakangnya.
if (!document.documentElement.dataset.crmDetailEscapeBound) {
  document.documentElement.dataset.crmDetailEscapeBound = '1';
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || document.querySelector('.overlay.open')) return;
    const page = ['crmContactPage', 'partnerDetailPage', 'outreachDetailPage', 'clientDetailPage']
      .map((id) => document.getElementById(id))
      .find((el) => el && !el.hidden);
    if (!page) return;
    e.preventDefault();
    if (page.id === 'crmContactPage') window.closeCrmContactPage?.();
    else if (page.id === 'partnerDetailPage') window.closePartnerDetailPage?.();
    else if (page.id === 'outreachDetailPage') window.closeOutreachDetail?.();
    else window.closeClientPage?.();
  }, true);
}

const CRM_CHIPS = [
  { key: 'all', short: 'Semua', tone: 'gray' },
  { key: 'klien', short: 'Klien', tone: 'blue' },
  { key: 'mitra', short: 'Mitra', tone: 'amber' },
];

// Status mitra (parallel dengan STAGE_META di partners.js — tidak diekspor
// dari sana, jadi metadata ringan ini disalin sadar dari nilai view).
const PARTNER_META = {
  aktif:   { short: 'Aktif',   tone: 'green' },
  pending: { short: 'Nunggu',  tone: 'yellow' },
  ditolak: { short: 'Ditolak', tone: 'red' },
  suspend: { short: 'Suspend', tone: 'gray' },
};

/* =================== Tab switching (pola content-tabs katalog) =================== */

/** Ganti tab CRM + persist ke URL hash (#crm?tab=...).
 *  Global supaya bisa dipanggil dari navigation.js (deep-link / redirect
 *  legacy #klien & #mitra) dan dari tombol di sheet. */
window.setCrmTab = function (tab) {
  if (!CRM_TABS.includes(tab)) tab = 'kontak';
  const changed = activeTab !== tab;
  if (changed) {
    // Detail flip page tidak boleh tertinggal tersembunyi saat pindah tab.
    if (document.getElementById('crmContactPage') && !document.getElementById('crmContactPage').hidden) window.closeCrmContactPage();
    if (document.getElementById('partnerDetailPage') && !document.getElementById('partnerDetailPage').hidden) window.closePartnerDetailPage?.();
    if (document.getElementById('outreachDetailPage') && !document.getElementById('outreachDetailPage').hidden) window.closeOutreachDetail?.();
    const clientPage = document.getElementById('clientDetailPage');
    if (clientPage && !clientPage.hidden) {
      // Detail perangkat dari akun punya back-stack (perangkat → akun → daftar).
      // Saat berpindah tab, tutup seluruh level agar tidak tertinggal tersembunyi.
      window.closeClientPage?.();
      if (!clientPage.hidden) window.closeClientPage?.();
    }
  }
  activeTab = tab;
  document.querySelectorAll('#crmTabs .content-tab').forEach((b) => {
    const on = b.dataset.ctab === tab;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
  });
  CRM_TABS.forEach((t) => {
    const el = document.getElementById('crmView' + t.charAt(0).toUpperCase() + t.slice(1));
    if (el) el.hidden = t !== tab;
  });
  // replaceState = tidak memicu hashchange (navigation yang pegang event itu)
  history.replaceState(null, '', '#crm?tab=' + tab);
  // Masuk tab Klien → render segar (pola lama switchScreen('klien'))
  if (changed && tab === 'klien') window.switchClientView?.();
  // Masuk tab Outreach → muat segar (pengganti screen:change 'outreach' lama)
  if (changed && tab === 'outreach') window.refreshOutreach?.();
};

function bindCrmTabs() {
  document.querySelectorAll('#crmTabs .content-tab').forEach((btn) => {
    btn.addEventListener('click', () => window.setCrmTab(btn.dataset.ctab));
  });
}

/* =================== Muat data kontak =================== */

async function fetchContacts() {
  const host = document.getElementById('crmCardList');
  if (host && (!contacts.length || contactLoadFailed)) {
    host.innerHTML = '<div class="muted" style="padding:16px 0;text-align:center">⏳ Memuat kontak…</div>';
  }
  try {
    const res = await supabaseFetch('/rest/v1/crm_contacts?select=*&order=last_seen.desc.nullslast');
    if (!res.ok) {
      contactLoadFailed = true;
      contacts = [];
      renderNotice(res.status);
      renderAll();
      return;
    }
    contactLoadFailed = false;
    contacts = Array.isArray(res.data) ? res.data : [];
    renderNotice();
    renderAll();
  } catch (e) {
    console.error('[crm] fetchContacts error:', e);
    contactLoadFailed = true;
    contacts = [];
    renderNotice(e?.status || 0);
    renderAll();
  }
}

/** Notice ramah bila view crm_contacts belum ter-apply — JANGAN crash. */
function renderNotice(status) {
  const el = document.getElementById('crmNotice');
  if (!el) return;
  if (!contactLoadFailed) {
    el.hidden = true;
    el.innerHTML = '';
    return;
  }
  el.hidden = false;
  el.innerHTML = `
    <div class="hub-notice-ic" aria-hidden="true">⚠️</div>
    <div class="hub-notice-txt">
      <strong>View crm_contacts belum ter-apply.</strong>
      Tab Kontak butuh view SQL <span class="mono">crm_contacts</span> di Supabase
      (HTTP ${escapeHtml(String(status || '?'))}). Tab Klien &amp; Mitra tetap jalan normal —
      kontak terpadu muncul sendiri setelah view di-apply.
    </div>
    <button type="button" class="btn btn-outline btn-sm" onclick="refreshContacts()">⟳ Muat ulang</button>`;
}

export async function refreshContacts() {
  await fetchContacts();
}
window.refreshContacts = refreshContacts;

/* =================== Helper =================== */

function kindsOf(k) {
  return Array.isArray(k.kinds) ? k.kinds : [];
}

function kindBadge(kinds) {
  const has = (t) => kinds.includes(t);
  if (has('klien') && has('mitra')) return '<span class="badge teal">Keduanya</span>';
  if (has('mitra')) return '<span class="badge amber">Mitra</span>';
  if (has('klien')) return '<span class="badge blue">Klien</span>';
  return '';
}

function waDisplay(wa) {
  const digits = String(wa || '').replace(/[^0-9]/g, '');
  return digits ? '+' + digits : '';
}

function initials(nama) {
  return String(nama || '?').trim().slice(0, 2).toUpperCase();
}

function matchesContact(k) {
  const kinds = kindsOf(k);
  if (contactFilter === 'klien' && !kinds.includes('klien')) return false;
  if (contactFilter === 'mitra' && !kinds.includes('mitra')) return false;
  if (!contactQuery) return true;
  const q = contactQuery.toLowerCase();
  return [k.nama, k.wa, k.kota, k.provinsi, k.kode_referral]
    .some((v) => String(v || '').toLowerCase().includes(q));
}

/* =================== Render =================== */

function renderAll() {
  renderStatline();
  renderChips();
  renderList();
}

function renderStatline() {
  const host = document.getElementById('crmStatline');
  if (!host) return;
  if (contactLoadFailed) {
    host.innerHTML = '<span class="oc-stat-err">⚠️ Gagal memuat data kontak</span>';
    return;
  }
  const nKlien = contacts.filter((k) => kindsOf(k).includes('klien')).length;
  const nMitra = contacts.filter((k) => kindsOf(k).includes('mitra')).length;
  const nDua = contacts.filter((k) => kindsOf(k).includes('klien') && kindsOf(k).includes('mitra')).length;
  host.innerHTML =
    `<span><b>${contacts.length}</b> kontak</span>` +
    `<span>Klien <b>${nKlien}</b></span>` +
    `<span>Mitra <b>${nMitra}</b></span>` +
    `<span>Keduanya <b>${nDua}</b></span>`;
}

function renderChips() {
  const host = document.getElementById('crmChips');
  if (!host) return;
  const countBy = (key) => {
    if (key === 'all') return contacts.length;
    return contacts.filter((k) => kindsOf(k).includes(key)).length;
  };
  host.innerHTML = CRM_CHIPS.map((ch) => `
    <button type="button" class="oc-chip ${contactFilter === ch.key ? 'on' : ''}" data-tone="${ch.tone}"
      aria-pressed="${contactFilter === ch.key}" onclick="setCrmChip('${ch.key}')">
      <i aria-hidden="true"></i>${escapeHtml(ch.short)}<span class="n">${countBy(ch.key)}</span>
    </button>`).join('');
}

window.setCrmChip = function (key) {
  if (!['all', 'klien', 'mitra'].includes(key)) key = 'all';
  contactFilter = key;
  renderChips();
  renderList();
};

function renderList() {
  const host = document.getElementById('crmCardList');
  const empty = document.getElementById('crmEmpty');
  if (!host || !empty) return;

  if (contactLoadFailed) {
    host.innerHTML = '';
    empty.hidden = true;
    return;
  }

  const rows = contacts.filter(matchesContact);
  if (!rows.length) {
    host.innerHTML = '';
    empty.hidden = false;
    const t = empty.querySelector('.empty-t');
    const d = empty.querySelector('.empty-d');
    if (contacts.length) {
      if (t) t.textContent = 'Tidak ada kontak yang cocok';
      if (d) d.textContent = 'Ubah kata kunci atau pilih filter tipe kontak lain.';
    } else {
      if (t) t.textContent = 'Belum ada kontak';
      if (d) d.textContent = 'Kontak klien & mitra tergabung otomatis di sini — satu orang, satu baris.';
    }
    return;
  }

  empty.hidden = true;
  host.innerHTML = rows.map((k) => {
    const kinds = kindsOf(k);
    const waTxt = waDisplay(k.wa);
    // Status sesuai tipe: pipeline klien + status/tier mitra
    const chips = [];
    if (kinds.includes('klien') && k.status_klien) {
      const sm = stageMeta(k.status_klien);
      chips.push(`<span class="badge ${sm.tone}">${escapeHtml(plainLabel(sm.label))}</span>`);
    }
    if (kinds.includes('mitra') && k.status_mitra) {
      const pm = PARTNER_META[k.status_mitra] || { short: k.status_mitra, tone: 'gray' };
      chips.push(`<span class="badge ${pm.tone}">${escapeHtml(pm.short)}${k.tier_mitra ? ' · ' + escapeHtml(k.tier_mitra) : ''}</span>`);
    }
    const sub2 = [
      chips.join(' '),
      k.last_seen ? `<span title="Terlihat terakhir">${escapeHtml(formatRelativeTime(k.last_seen))}</span>` : '',
    ].filter(Boolean).join(' · ');
    return `
      <div class="oc-row" data-key="${escapeHtml(k.identity_key)}" role="button" tabindex="0" aria-label="Detail ${escapeHtml(k.nama || 'kontak')}">
        <div class="oc-ava oc-ava--teal" aria-hidden="true">${escapeHtml(initials(k.nama))}</div>
        <div class="oc-main">
          <div class="oc-name">${escapeHtml(k.nama || 'Tanpa nama')}</div>
          <div class="oc-sub"><span class="mono">${escapeHtml(waTxt || '—')}</span>${k.kota ? ' · ' + escapeHtml(k.kota) : ''}${k.kode_referral ? ' · <span class="mono">' + escapeHtml(k.kode_referral) + '</span>' : ''}</div>
          ${sub2 ? `<div class="oc-sub">${sub2}</div>` : ''}
        </div>
        <div class="oc-side">
          ${kindBadge(kinds)}
          ${waTxt ? `<button type="button" class="oc-wa" data-crm-contact-wa="${escapeHtml(k.identity_key)}" aria-label="WhatsApp ${escapeHtml(k.nama || '')}" title="Kirim pesan WhatsApp">💬</button>` : ''}
        </div>
      </div>`;
  }).join('');
  host.querySelectorAll('.oc-row').forEach((row) => {
    const go = () => openCrmContact(row.dataset.key);
    row.addEventListener('click', (e) => {
      if (e.target.closest('[data-crm-contact-wa]')) return;
      go();
    });
    row.addEventListener('keydown', (e) => {
      if (e.target !== row || (e.key !== 'Enter' && e.key !== ' ')) return;
      e.preventDefault();
      go();
    });
  });
  host.querySelectorAll('[data-crm-contact-wa]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const k = contacts.find((x) => x.identity_key === btn.dataset.crmContactWa);
      if (!k) return;
      const kinds = kindsOf(k);
      window.openCrmWhatsApp({ kind: kinds.includes('klien') ? 'klien' : 'mitra', clientId: k.client_id || null, partnerId: k.partner_id || null, phone: k.wa, nama: k.nama, usaha: k.nama, produk: k.app_type, kota: k.kota, kode: k.kode_referral });
    });
  });
}

/* =================== Halaman detail 360° (flip page, gaya katalog) =================== */

window.openCrmContact = async function (key) {
  const k = contacts.find((x) => x.identity_key === key);
  if (!k) return;
  const page = document.getElementById('crmContactPage');
  if (!page) return;
  const esc = escapeHtml;
  const kinds = kindsOf(k);
  const waTxt = waDisplay(k.wa);
  const isKlien = kinds.includes('klien') && !!k.client_id;
  const isMitra = kinds.includes('mitra') && !!k.partner_id;

  const smK = (kinds.includes('klien') && k.status_klien) ? stageMeta(k.status_klien) : null;
  const pmM = (kinds.includes('mitra') && k.status_mitra)
    ? (PARTNER_META[k.status_mitra] || { short: k.status_mitra, tone: 'gray' }) : null;

  // Kerangka page — bagian Klien/Mitra diisi setelahnya (fetch on-demand)
  page.innerHTML = `
    <div class="cd-head cd-head-sticky">
      <button type="button" class="cd-ab-close" onclick="closeCrmContactPage()" aria-label="Tutup detail kontak">✕</button>
      <div class="cd-title">
        <h3>${esc(k.nama || 'Tanpa nama')}</h3>
        <div class="cd-badges">${kindBadge(kinds)}</div>
      </div>
    </div>

    <div class="oc-sh" style="margin-bottom:var(--s3)">
      <div class="oc-ava oc-ava--lg oc-ava--teal" aria-hidden="true">${esc(initials(k.nama))}</div>
      <div class="oc-sh-id">
        <div class="oc-sh-name">${esc(k.nama || 'Tanpa nama')}</div>
        <div class="oc-sub"><span class="mono">${esc(waTxt || '—')}</span>${k.kota ? ' · ' + esc(k.kota) : ''}${k.provinsi ? ', ' + esc(k.provinsi) : ''}</div>
      </div>
    </div>

    <div class="cd-sec">
      <div class="cd-sec-t">Identitas</div>
      <div class="sheet-info">
        <div class="sheet-info-r"><span class="sheet-info-l">WhatsApp</span><span class="sheet-info-v mono">${esc(waTxt || '—')}</span></div>
        <div class="sheet-info-r"><span class="sheet-info-l">Kota/Provinsi</span><span class="sheet-info-v">${esc([k.kota, k.provinsi].filter(Boolean).join(', ') || '—')}</span></div>
        <div class="sheet-info-r"><span class="sheet-info-l">Global ID</span><span class="sheet-info-v mono">${k.global_identity_id ? esc(String(k.global_identity_id)) : '— belum ada —'}</span></div>
        <div class="sheet-info-r"><span class="sheet-info-l">Terlihat</span><span class="sheet-info-v">${k.last_seen ? esc(formatRelativeTime(k.last_seen)) : '—'}</span></div>
      </div>
    </div>

    ${isKlien ? `
    <div class="cd-sec">
      <div class="cd-sec-t">Sisi Klien</div>
      <div class="sheet-info">
        <div class="sheet-info-r"><span class="sheet-info-l">Pipeline</span><span class="sheet-info-v">${smK ? `<span class="badge ${smK.tone}">${esc(plainLabel(smK.label))}</span>` : '—'}</span></div>
        <div class="sheet-info-r"><span class="sheet-info-l">Aplikasi</span><span class="sheet-info-v">${esc(k.app_type || '—')}</span></div>
        <div class="sheet-info-r"><span class="sheet-info-l">Nilai</span><span class="sheet-info-v">${k.nilai_klien != null ? esc(formatRupiah(Number(k.nilai_klien) || 0)) : '—'}</span></div>
      </div>
    </div>` : ''}

    ${isMitra ? `
    <div class="cd-sec">
      <div class="cd-sec-t">Sisi Mitra</div>
      <div class="sheet-info">
        <div class="sheet-info-r"><span class="sheet-info-l">Status</span><span class="sheet-info-v">${pmM ? `<span class="badge ${pmM.tone}">${esc(pmM.short)}</span>` : '—'}</span></div>
        <div class="sheet-info-r"><span class="sheet-info-l">Tier</span><span class="sheet-info-v">${esc(k.tier_mitra || '—')}</span></div>
        <div class="sheet-info-r"><span class="sheet-info-l">Kode Referral</span><span class="sheet-info-v mono">${esc(k.kode_referral || '—')}</span></div>
      </div>
      <div id="crmMitraWallet" style="margin-top:10px"><div class="muted">⏳ Memuat dompet &amp; pencairan…</div></div>
    </div>` : ''}

    <div class="cd-actionbar">
      ${waTxt ? `<button type="button" class="btn btn-primary cd-ab-btn" id="crmContactWaBtn">💬 Kirim Pesan</button>` : ''}
      ${isKlien ? `<button type="button" class="btn btn-outline cd-ab-btn" onclick="crmGoClient('${esc(k.client_id)}')">⚙️ Kelola Klien</button>` : ''}
      ${isMitra ? `<button type="button" class="btn btn-outline cd-ab-btn" onclick="crmGoMitra('${esc(k.partner_id)}')">🤝 Detail Mitra</button>` : ''}
    </div>
  `;

  // Flip: sembunyikan toolbar+list kontak, tampilkan halaman detail
  const view = document.getElementById('crmViewKontak');
  view?.querySelectorAll('.oc-pin, .oc-statline, #crmCardList, #crmEmpty, .hub-notice').forEach((el) => { el.hidden = true; el.dataset.crmFlipHide = '1'; });
  page.hidden = false;
  window.scrollTo({ top: 0 });
  document.getElementById('crmContactWaBtn')?.addEventListener('click', () => {
    window.openCrmWhatsApp({ kind: kinds.includes('klien') ? 'klien' : 'mitra', clientId: k.client_id || null, partnerId: k.partner_id || null, phone: k.wa, nama: k.nama, usaha: k.nama, produk: k.app_type, kota: k.kota, kode: k.kode_referral });
  });

  // Dompet & riwayat payout mitra — tabel sudah di whitelist; kegagalan = pesan
  // kecil di dalam halaman, bukan error global.
  if (isMitra) {
    const host = document.getElementById('crmMitraWallet');
    try {
      const [wRes, pRes] = await Promise.all([
        supabaseFetch('/rest/v1/referral_wallets?partner_id=eq.' + encodeURIComponent(k.partner_id) + '&limit=1'),
        supabaseFetch('/rest/v1/payout_requests?partner_id=eq.' + encodeURIComponent(k.partner_id) + '&order=created_at.desc&limit=5'),
      ]);
      if (!host || page.hidden) return;
      const w = (wRes.ok && Array.isArray(wRes.data)) ? wRes.data[0] : null;
      const pays = (pRes.ok && Array.isArray(pRes.data)) ? pRes.data : [];
      const payRows = pays.length ? pays.map((p) => `
        <div class="oc-row" style="cursor:default">
          <div class="oc-main">
            <div class="oc-name">${esc(formatRupiah(Number(p.amount_rupiah) || 0))} <span class="mono">${Number(p.points_used) || 0} poin</span></div>
            <div class="oc-sub">${esc(formatDate(p.created_at))}</div>
          </div>
          <div class="oc-side"><span class="badge ${p.status === 'dibayar' ? 'green' : p.status === 'ditolak' ? 'red' : 'yellow'}">${esc(p.status || '?')}</span></div>
        </div>`).join('')
        : '<div class="muted" style="padding:6px 0">Belum ada pencairan.</div>';
      host.innerHTML = `
        <div class="oc-sh-stats" style="border:none;padding:0">
          <div class="oc-sh-stat"><span class="oc-sh-sl">Poin siap</span><span class="oc-sh-sv">${w ? (Number(w.points_balance) || 0).toLocaleString('id-ID') : '—'}</span></div>
          <div class="oc-sh-stat"><span class="oc-sh-sl">Poin siklus</span><span class="oc-sh-sv">${w ? (Number(w.points_pending) || 0).toLocaleString('id-ID') : '—'}</span></div>
          <div class="oc-sh-stat"><span class="oc-sh-sl">Saldo Rp</span><span class="oc-sh-sv">${w ? esc(formatRupiah(Number(w.rupiah_balance) || 0)) : '—'}</span></div>
        </div>
        <div class="field-label" style="margin-top:8px">Riwayat pencairan terakhir</div>
        ${payRows}`;
    } catch (e) {
      console.error('[crm] wallet/payout fetch:', e);
      if (host) host.innerHTML = '<div class="muted">Data dompet mitra gagal dimuat.</div>';
    }
  }
};

/** Tutup flip page detail kontak — tampilkan lagi daftar. */
window.closeCrmContactPage = function () {
  const page = document.getElementById('crmContactPage');
  if (page) page.hidden = true;
  const view = document.getElementById('crmViewKontak');
  view?.querySelectorAll('[data-crm-flip-hide]').forEach((el) => { el.hidden = false; delete el.dataset.crmFlipHide; });
};

/** Aksi cepat: buka tab Klien + halaman detail klien (aksi PATCH/lisensi ada di sana). */
window.crmGoClient = function (clientId) {
  window.closeCrmContactPage();
  window.setCrmTab('klien');
  if (clientId) window.openClientPage?.(clientId);
};

/** Aksi cepat: buka tab Mitra. */
window.crmGoMitra = function (partnerId = null) {
  window.closeCrmContactPage();
  window.setCrmTab('mitra');
  if (partnerId) window.openPartnerDetail?.(partnerId);
};

/* =================== Init =================== */

export async function initCrmContacts() {
  bindCrmTabs();
  const input = document.getElementById('crmSearch');
  if (input && input.dataset.bound !== '1') {
    input.dataset.bound = '1';
    input.addEventListener('input', () => {
      contactQuery = input.value.trim();
      renderList();
    });
  }
  try {
    await refreshContacts();
  } catch (e) {
    console.error('[crm] refreshContacts:', e);
    contactLoadFailed = true;
    renderNotice(e?.status || 0);
    showToast('Gagal memuat kontak CRM', 2500, 'error');
  }
}

/** Bootstrap modul CRM = ketiga sub-modul sekaligus (dipanggil app.js). */
export async function initCrm() {
  const results = await Promise.allSettled([initClients(), initPartnersTab(), initCrmContacts()]);
  results.forEach((r, i) => {
    if (r.status === 'rejected') console.error('[crm] init gagal (sub-module ' + i + '):', r.reason);
  });
}
