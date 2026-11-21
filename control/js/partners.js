/**
 * Control Center Kasir Solo — Modul Mitra (Program Referral / Afiliasi)
 * =============================================================================
 * Screen sekunder "🤝 Mitra" (via menu Lainnya) — Lapis 2a modul manajemen
 * mitra (ADR-VOUCHER-REFERRAL §12). Sumber data = Supabase via /api/rest proxy
 * (service_role ada di server; browser nggak pernah pegang key).
 *
 * Fitur (Fase A3, keputusan owner 2026-10-27):
 *   · Daftar mitra + filter status + pencarian (nama / kode / WA)
 *   · Statline: jumlah mitra, aktif, akun global ter-link (Fase A1), poin siap
 *   · Detail mitra (sheet): profil, dompet, kode referral, riwayat pencairan
 *   · Aksi admin (RPC service-only via proxy):
 *       - partner_approve(approve/reject/suspend) — approve = aktif + akses
 *         portal (token 1 thn, dikembalikan sekali di response)
 *       - partner_issue_token(30/365 hari) — token mentah tampil SEKALI
 *       - referral_resolve_pending — lepas poin pending yang sudah lewat siklus
 *
 * Kontrak penting:
 *   · Token portal TIDAK PERNAH bisa diambil ulang dari DB (disimpan SHA-256).
 *     Setelah dialog ditutup, satu-satunya cara = terbitkan token baru.
 *   · 1 WA = 1 akun global (Fase A1). Kolom `global_identity_id` di
 *     referral_partners = tanda mitra sudah punya akun global.
 * =============================================================================
 */

import { escapeHtml, formatDate, formatRupiah } from './utils.js';
import { showToast } from './toast.js';
import { supabaseFetch } from './api.js';

let partners = [];
let wallets = [];   // referral_wallets (saldo poin mitra)
let payouts = [];   // payout_requests (riwayat pencairan)
let codes = [];     // license_codes kind='referral' (kode universal mitra)
let loaded = false;
let filterStatus = '';
let filterQuery = '';

const PARTNER_STAGES = [
  { key: '',         short: 'Semua',   tone: 'gray' },
  { key: 'aktif',    short: 'Aktif',   tone: 'green' },
  { key: 'pending',  short: 'Nunggu',  tone: 'yellow' },
  { key: 'ditolak',  short: 'Ditolak', tone: 'red' },
  { key: 'suspend',  short: 'Suspend', tone: 'gray' },
];

const STAGE_META = {
  aktif:   { short: 'Aktif',   label: 'Aktif',   tone: 'green' },
  pending: { short: 'Nunggu',  label: 'Nunggu verifikasi', tone: 'yellow' },
  ditolak: { short: 'Ditolak', label: 'Ditolak', tone: 'red' },
  suspend: { short: 'Suspend', label: 'Suspend', tone: 'gray' },
};

function stageMeta(status) {
  return STAGE_META[status] || { short: status || '?', label: status || '?', tone: 'gray' };
}

/* =================== Muat data =================== */

async function fetchPartners() {
  const res = await supabaseFetch('/rest/v1/referral_partners?select=id,code,nama,no_whatsapp,kota,provinsi,email,produk_interest,catatan,status,tier,client_id,global_identity_id,registered_via,approved_at,created_at&order=created_at.desc&limit=500');
  if (!res.ok) {
    console.error('referral_partners fetch failed:', res.status, res.text);
    throw new Error('Gagal memuat mitra (HTTP ' + res.status + ')');
  }
  partners = Array.isArray(res.data) ? res.data : [];
}

async function fetchWallets() {
  const res = await supabaseFetch('/rest/v1/referral_wallets?select=partner_id,app_type,points_balance,points_pending,points_earned,rupiah_balance,withdrawable&limit=1000');
  if (!res.ok) {
    console.error('referral_wallets fetch failed:', res.status, res.text);
    throw new Error('Gagal memuat dompet mitra (HTTP ' + res.status + ')');
  }
  wallets = Array.isArray(res.data) ? res.data : [];
}

async function fetchPayouts() {
  const res = await supabaseFetch('/rest/v1/payout_requests?select=id,partner_id,amount_rupiah,points_used,payout_type,bank_info,status,created_at&order=created_at.desc&limit=500');
  if (!res.ok) {
    console.error('payout_requests fetch failed:', res.status, res.text);
    throw new Error('Gagal memuat pencairan (HTTP ' + res.status + ')');
  }
  payouts = Array.isArray(res.data) ? res.data : [];
}

async function fetchCodes() {
  const res = await supabaseFetch('/rest/v1/license_codes?select=code,owner_partner_id,status,expires_at&kind=eq.referral&limit=500');
  if (!res.ok) {
    console.error('license_codes(referral) fetch failed:', res.status, res.text);
    throw new Error('Gagal memuat kode referral (HTTP ' + res.status + ')');
  }
  codes = Array.isArray(res.data) ? res.data : [];
}

async function fetchAll() {
  const host = document.getElementById('partnerCardList');
  if (host && !loaded) {
    host.innerHTML = '<div class="muted" style="padding:16px 0;text-align:center">⏳ Memuat mitra…</div>';
  }
  await Promise.all([fetchPartners(), fetchWallets(), fetchPayouts(), fetchCodes()]);
  loaded = true;
  renderAll();
}

/* =================== Helper =================== */

function walletOf(partnerId) {
  return wallets.find((w) => w.partner_id === partnerId) || null;
}

function codeOf(partnerId) {
  return codes.find((c) => c.owner_partner_id === partnerId) || null;
}

function payoutsOf(partnerId) {
  return payouts.filter((p) => p.partner_id === partnerId);
}

function displayWa(wa) {
  const digits = String(wa || '').replace(/[^0-9]/g, '');
  return digits ? '+' + digits : '—';
}

function shortId(id) {
  return id ? String(id).slice(0, 8) + '…' : '—';
}

async function callRpc(fn, args) {
  const res = await supabaseFetch('/rest/v1/rpc/' + fn, { method: 'POST', data: args });
  if (!res.ok) {
    const detail = typeof res.data === 'string' ? res.data : (res.data?.message || res.text || '');
    throw new Error(detail || ('RPC ' + fn + ' gagal (HTTP ' + res.status + ')'));
  }
  return res.data;
}

/* =================== Render =================== */

function renderAll() {
  renderStatline();
  renderChips();
  renderList();
}

function renderStatline() {
  const host = document.getElementById('partnerStatline');
  if (!host) return;
  const total = partners.length;
  const aktif = partners.filter((p) => p.status === 'aktif').length;
  const linked = partners.filter((p) => p.global_identity_id).length;
  const ready = wallets.reduce((s, w) => s + (Number(w.points_balance) || 0), 0);
  const pendingPayout = payouts.filter((p) => p.status === 'pending').length;
  host.innerHTML =
    `<span><b>${total}</b> mitra</span>` +
    `<span>Aktif <b>${aktif}</b></span>` +
    `<span>Akun global <b>${linked}</b></span>` +
    `<span>Poin siap <b>${ready.toLocaleString('id-ID')}</b></span>` +
    `<span>Payout nunggu <b>${pendingPayout}</b></span>`;
}

function renderChips() {
  const host = document.getElementById('partnerChips');
  if (!host) return;
  const countBy = (key) => key ? partners.filter((p) => p.status === key).length : partners.length;
  host.innerHTML = PARTNER_STAGES.map((s) => `
    <button type="button" class="oc-chip ${filterStatus === s.key ? 'on' : ''}" data-tone="${s.tone}"
      aria-pressed="${filterStatus === s.key}" onclick="setPartnerChip('${s.key}')">
      <i aria-hidden="true"></i>${escapeHtml(s.short)}<span class="n">${countBy(s.key)}</span>
    </button>`).join('');
}

function matchesFilter(p) {
  if (filterStatus && p.status !== filterStatus) return false;
  if (!filterQuery) return true;
  const q = filterQuery.toLowerCase();
  return [p.nama, p.code, p.no_whatsapp, p.kota, p.email]
    .some((v) => String(v || '').toLowerCase().includes(q));
}

function renderList() {
  const host = document.getElementById('partnerCardList');
  const empty = document.getElementById('partnerEmpty');
  if (!host || !empty) return;
  const rows = partners.filter(matchesFilter);
  if (!rows.length) {
    host.innerHTML = '';
    empty.hidden = false;
    const t = empty.querySelector('.empty-t');
    const d = empty.querySelector('.empty-d');
    if (partners.length) {
      if (t) t.textContent = 'Tidak ada mitra yang cocok';
      if (d) d.textContent = 'Ubah kata kunci pencarian atau pilih filter status lain.';
    } else {
      if (t) t.textContent = 'Belum ada mitra';
      if (d) d.textContent = 'Mitra daftar mandiri di mitra.kasirsolo.com/daftar — datanya muncul di sini.';
    }
    return;
  }
  empty.hidden = true;
  host.innerHTML = rows.map((p) => {
    const sm = stageMeta(p.status);
    const w = walletOf(p.id);
    const linked = Boolean(p.global_identity_id);
    return `
      <div class="oc-row" data-id="${escapeHtml(p.id)}" role="button" tabindex="0"
        aria-label="${escapeHtml(p.nama)}, ${escapeHtml(sm.label)}"
        onclick="openPartnerDetail('${escapeHtml(p.id)}')">
        <div class="oc-ava oc-ava--teal" aria-hidden="true">${escapeHtml((p.nama || '?').slice(0, 2).toUpperCase())}</div>
        <div class="oc-main">
          <div class="oc-name">${escapeHtml(p.nama)} <span class="mono">${escapeHtml(p.code || '')}</span></div>
          <div class="oc-sub"><span class="mono">${escapeHtml(displayWa(p.no_whatsapp))}</span>${p.kota ? ' · ' + escapeHtml(p.kota) : ''} · ${escapeHtml(p.registered_via || 'website')}</div>
          <div class="oc-sub">${linked
            ? `<span title="${escapeHtml(p.global_identity_id)}">Akun global ${escapeHtml(shortId(p.global_identity_id))}</span>`
            : '<span>Akun global belum ter-link</span>'}${w ? ` · Poin siap <b>${Number(w.points_balance) || 0}</b>` : ''}</div>
        </div>
        <div class="oc-side">
          <span class="badge ${sm.tone}">${escapeHtml(sm.short)}</span>
          ${p.no_whatsapp ? `<button type="button" class="oc-wa" data-crm-wa-partner="${escapeHtml(p.id)}" aria-label="Kirim pesan WhatsApp ${escapeHtml(p.nama)}" title="Kirim pesan WhatsApp">💬</button>` : ''}
        </div>
      </div>`;
  }).join('');
  host.querySelectorAll('[data-crm-wa-partner]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const p = partners.find((x) => x.id === btn.dataset.crmWaPartner);
      if (!p) return;
      window.openCrmWhatsApp({ kind: 'mitra', partnerId: p.id, phone: p.no_whatsapp, nama: p.nama, kota: p.kota, kode: p.code, produk: p.produk_interest });
    });
  });
}

/* =================== Sheet detail =================== */

function statusActions(p) {
  const btns = [];
  if (p.status === 'aktif') {
    btns.push(`<button type="button" class="btn btn-outline" onclick="partnerSetStatus('${escapeHtml(p.id)}','suspend')">⏸ Suspend</button>`);
  } else {
    btns.push(`<button type="button" class="btn btn-primary" onclick="partnerSetStatus('${escapeHtml(p.id)}','approve')">✓ Aktifkan &amp; Kasih Akses Portal</button>`);
    btns.push(`<button type="button" class="btn btn-outline" onclick="partnerSetStatus('${escapeHtml(p.id)}','reject')">✕ Tolak</button>`);
    if (p.status === 'suspend') {
      // Suspend → aktifkan lagi = jalur approve (reset token portal 1 thn).
    }
  }
  return btns.join('');
}

function openPartnerDetail(partnerId) {
  const p = partners.find((x) => x.id === partnerId);
  if (!p) return;
  const sm = stageMeta(p.status);
  const w = walletOf(p.id);
  const code = codeOf(p.id);
  const plist = payoutsOf(p.id);
  const page = document.getElementById('partnerDetailPage');
  if (!page) return;

  const payoutRows = plist.length ? plist.map((pr) => `
    <div class="oc-row" style="cursor:default">
      <div class="oc-main">
        <div class="oc-name">${escapeHtml(formatRupiah(Number(pr.amount_rupiah) || 0))} <span class="mono">${Number(pr.points_used) || 0} poin</span></div>
        <div class="oc-sub">${escapeHtml(formatDate(pr.created_at))}${pr.bank_info ? ' · ' + escapeHtml(pr.bank_info) : ''}</div>
      </div>
      <div class="oc-side"><span class="badge ${pr.status === 'dibayar' ? 'green' : pr.status === 'ditolak' ? 'red' : 'yellow'}">${escapeHtml(pr.status || '?')}</span></div>
    </div>`).join('')
    : '<div class="empty-state" style="padding:14px"><div class="empty-d">Belum ada pencairan.</div></div>';

  page.innerHTML = `
    <div class="cd-head cd-head-sticky">
      <button type="button" class="cd-ab-close" onclick="closePartnerDetailPage()" aria-label="Tutup detail mitra">✕</button>
      <div class="cd-title">
        <h3>${escapeHtml(p.nama)}</h3>
        <div class="cd-badges"><span class="badge ${sm.tone}">${escapeHtml(sm.short)}</span></div>
      </div>
    </div>

    <div class="oc-sh" style="margin-bottom:var(--s3)">
      <div class="oc-ava oc-ava--lg oc-ava--teal" aria-hidden="true">${escapeHtml((p.nama || '?').slice(0, 2).toUpperCase())}</div>
      <div class="oc-sh-id">
        <div class="oc-sh-name">${escapeHtml(p.nama)}</div>
        <div class="oc-sub"><span class="mono">${escapeHtml(displayWa(p.no_whatsapp))}</span>${p.kota ? ' · ' + escapeHtml(p.kota) : ''}</div>
      </div>
    </div>

    <div class="cd-sec">
      <div class="cd-sec-t">Profil &amp; Dompet</div>
      <div class="oc-sh-stats">
        <div class="oc-sh-stat"><span class="oc-sh-sl">Kode</span><span class="oc-sh-sv mono">${escapeHtml(p.code || '—')}</span></div>
        <div class="oc-sh-stat"><span class="oc-sh-sl">Tier</span><span class="oc-sh-sv">${escapeHtml(p.tier || '—')}</span></div>
        <div class="oc-sh-stat"><span class="oc-sh-sl">Produk</span><span class="oc-sh-sv">${escapeHtml(p.produk_interest || '*')}</span></div>
        <div class="oc-sh-stat"><span class="oc-sh-sl">Terdaftar</span><span class="oc-sh-sv">${escapeHtml(formatDate(p.created_at))}</span></div>
      </div>
      <div class="oc-sh-stats">
        <div class="oc-sh-stat"><span class="oc-sh-sl">Akun global</span><span class="oc-sh-sv mono">${p.global_identity_id
          ? '<span title="' + escapeHtml(p.global_identity_id) + '">' + escapeHtml(shortId(p.global_identity_id)) + ' ✓</span>'
          : 'belum ter-link'}</span></div>
        <div class="oc-sh-stat"><span class="oc-sh-sl">Poin siap</span><span class="oc-sh-sv">${w ? (Number(w.points_balance) || 0).toLocaleString('id-ID') : '—'}</span></div>
        <div class="oc-sh-stat"><span class="oc-sh-sl">Poin siklus</span><span class="oc-sh-sv">${w ? (Number(w.points_pending) || 0).toLocaleString('id-ID') : '—'}</span></div>
        <div class="oc-sh-stat"><span class="oc-sh-sl">Saldo Rp</span><span class="oc-sh-sv">${w ? escapeHtml(formatRupiah(Number(w.rupiah_balance) || 0)) : '—'}</span></div>
      </div>
      <div class="field">
        <span class="field-label">Kode referral</span>
        <div class="oc-sub">${code
          ? `<span class="mono">${escapeHtml(code.code)}</span> · ${escapeHtml(code.status || '?')} · exp ${escapeHtml(formatDate(code.expires_at))}`
          : 'belum ada'}</div>
      </div>
    </div>

    <div class="cd-sec">
      <div class="cd-sec-t">Riwayat pencairan (${plist.length})</div>
      ${payoutRows}
    </div>

    <div class="cd-sec">
      <div class="cd-sec-t">Catatan admin (opsional)</div>
      <textarea id="partnerNoteInput" rows="2" placeholder="Contoh: kenapa di-suspend / kenapa di-approve">${escapeHtml(p.catatan || '')}</textarea>
      <div id="partnerTokenBox" hidden style="margin-top:10px"></div>
    </div>

    <div class="cd-actionbar">
      ${p.no_whatsapp ? `<button type="button" class="btn btn-primary cd-ab-btn" data-crm-wa-detail="${escapeHtml(p.id)}">💬 Kirim Pesan</button>` : ''}
      ${statusActions(p).replaceAll('class="btn ', 'class="btn cd-ab-btn ')}
      <button type="button" class="btn btn-outline cd-ab-btn" onclick="partnerIssueToken('${escapeHtml(p.id)}')">🔑 Token Portal</button>
    </div>
  `;

  page.dataset.partnerId = p.id;
  page.querySelector('[data-crm-wa-detail]')?.addEventListener('click', () => {
    const target = partners.find((x) => x.id === page.dataset.partnerId);
    if (target) window.openCrmWhatsApp({ kind: 'mitra', phone: target.no_whatsapp, nama: target.nama, kota: target.kota, kode: target.code, produk: target.produk_interest });
  });

  // Flip: sembunyikan toolbar+list mitra, tampilkan halaman detail
  const view = document.getElementById('crmViewMitra');
  view?.querySelectorAll('.oc-pin, .oc-statline, #partnerCardList, #partnerEmpty').forEach((el) => { el.hidden = true; el.dataset.partnerFlipHide = '1'; });
  page.hidden = false;
  window.scrollTo({ top: 0 });
}

/** Tutup flip page detail mitra — tampilkan lagi daftar. */
window.closePartnerDetailPage = function () {
  const page = document.getElementById('partnerDetailPage');
  if (page) page.hidden = true;
  const view = document.getElementById('crmViewMitra');
  view?.querySelectorAll('[data-partner-flip-hide]').forEach((el) => { el.hidden = false; delete el.dataset.partnerFlipHide; });
};

/** Tampilkan token portal SEKALI di halaman detail (mentah nggak bisa diambil lagi). */
function showTokenBox(partnerId, token, expiresAt) {
  const p = partners.find((x) => x.id === partnerId);
  const box = document.getElementById('partnerTokenBox');
  if (!box) return;
  const portalLink = `${location.origin.replace('ctrlbeta', 'mitra').replace(/\/$/, '')}/portal?t=${encodeURIComponent(token)}`;
  // Link portal resmi = domain mitra; kalau view dari beta, tetap kasih pola sama.
  const waText = encodeURIComponent(
    `Halo ${p?.nama || 'Mitra'}, ini link portal mitra lo (berlaku sampai ${expiresAt || '-'}):\n${portalLink}`
  );
  box.hidden = false;
  box.innerHTML = `
    <div class="field">
      <span class="field-label">🔑 Token portal — TAMPIL SEKALI INI SAJA (tersimpan sebagai hash)</span>
      <div class="oc-sub" style="margin-bottom:8px">Kirim lewat WhatsApp sekarang; setelah dialog ini ditutup, token nggak bisa dilihat lagi — harus terbitkan baru.</div>
      <input id="partnerTokenValue" class="mono" readonly value="${escapeHtml(token)}" style="width:100%">
      <div class="oc-seg" style="margin-top:8px">
        <button type="button" class="btn btn-outline" onclick="copyPartnerToken()">📋 Salin token</button>
        <a class="btn btn-primary" target="_blank" rel="noopener"
           href="https://wa.me/${escapeHtml(String(p?.no_whatsapp || ''))}?text=${waText}">💬 Kirim via WhatsApp</a>
      </div>
    </div>`;
}

window.copyPartnerToken = function () {
  const input = document.getElementById('partnerTokenValue');
  if (!input) return;
  navigator.clipboard?.writeText(input.value)
    .then(() => showToast('Token tersalin', 1500, 'success'))
    .catch(() => {
      input.select();
      document.execCommand('copy');
      showToast('Token tersalin', 1500, 'success');
    });
};

/* =================== Aksi admin =================== */

window.setPartnerChip = function (key) {
  filterStatus = key;
  renderChips();
  renderList();
};

// Dipanggil dari onclick inline di kartu (oc-row) — harus global.
window.openPartnerDetail = openPartnerDetail;

function bindSearch() {
  const input = document.getElementById('partnerSearch');
  if (!input || input.dataset.bound === '1') return;
  input.dataset.bound = '1';
  input.addEventListener('input', () => {
    filterQuery = input.value.trim();
    renderList();
  });
}

window.partnerSetStatus = async function (partnerId, action) {
  const p = partners.find((x) => x.id === partnerId);
  if (!p) return;
  const noteEl = document.getElementById('partnerNoteInput');
  const note = noteEl ? noteEl.value.trim() : '';

  const labels = {
    approve: `Aktifkan ${p.nama}? Mitra langsung dapat akses portal (token 1 tahun dikirim sekali di bawah).`,
    reject: `Tolak ${p.nama}? Token portal-nya dicabut.`,
    suspend: `Suspend ${p.nama}? Kode referral-nya ikut dibatalkan.`,
  };
  if (!confirm(labels[action] || action)) return;

  try {
    const result = await callRpc('partner_approve', { p_partner_id: partnerId, p_action: action, p_note: note });
    showToast(`${p.nama}: ${result?.status || action}`, 2500, 'success');
    await fetchAll();
    // approve mengembalikan portal_token sekali — langsung tawarkan kirim WA.
    if (action === 'approve' && result?.portal_token) {
      openPartnerDetail(partnerId);
      showTokenBox(partnerId, result.portal_token, result.expires_at);
    } else {
      // Tetap terbuka di flip page dengan data segar.
      openPartnerDetail(partnerId);
    }
  } catch (e) {
    console.error('partner_approve:', e);
    showToast(e.message || 'Aksi gagal', 3000, 'error');
  }
};

window.partnerIssueToken = async function (partnerId) {
  const p = partners.find((x) => x.id === partnerId);
  if (!p) return;
  const days = confirm('Terbitkan token portal 30 hari? (Cancel = 365 hari)') ? 30 : 365;
  try {
    const result = await callRpc('partner_issue_token', { p_partner_id: partnerId, p_days: days });
    if (!result?.ok) throw new Error(result?.reason || 'Gagal terbitkan token');
    showToast('Token baru diterbitkan — kirim sekarang, tampil sekali', 3000, 'success');
    showTokenBox(partnerId, result.token, result.expires_at);
  } catch (e) {
    console.error('partner_issue_token:', e);
    showToast(e.message || 'Gagal terbitkan token', 3000, 'error');
  }
};

window.partnerResolvePending = async function () {
  if (!confirm('Lepas poin pending yang sudah lewat siklus payout? Dijalankan juga otomatis oleh cron.')) return;
  try {
    const result = await callRpc('referral_resolve_pending', {});
    const n = typeof result === 'object' && result !== null
      ? (result.resolved ?? result.count ?? JSON.stringify(result))
      : result;
    showToast('Poin pending dilepas: ' + String(n), 3000, 'success');
    await fetchAll();
  } catch (e) {
    console.error('referral_resolve_pending:', e);
    showToast(e.message || 'Gagal melepas poin pending', 3000, 'error');
  }
};

window.refreshPartners = async function () {
  await fetchAll();
};

/* =================== Init =================== */

export async function initPartnersTab() {
  bindSearch();
  try {
    await fetchAll();
  } catch (e) {
    console.error('initPartnersTab:', e);
    showToast(e.message || 'Gagal memuat data mitra', 3000, 'error');
  }
}
