/**
 * Control Center Kasir Solo — Kode Diskon Module (tab Katalog)
 * =============================================================================
 * Mengelola "satu sistem kode" (docs/ADR-VOUCHER-REFERRAL.md) dari tabel
 * license_codes:
 *   - kind 'voucher'  → kode buatan admin (DSK-…, dibuat di sini)
 *   - kind 'referral' → kode otomatis milik pelanggan (AJK-…) / mitra (MKS-…)
 *
 * Nilai diskon yang diedit di sini LANGSUNG berlaku di app klien — RPC
 * code_apply_discount membaca dari baris license_codes, bukan dari config.
 * Termasuk: editor default global (settings.referral_config) untuk kode
 * referral baru + statistik pemakaian dari code_redemptions.
 *
 * Semua akses via supabaseFetch → proxy service-role (api/rest.js). Tabel
 * wajib ada di ALLOWED_REST_TABLES: license_codes, code_redemptions,
 * referral_partners (hanya untuk nama pemilik kode).
 * =============================================================================
 */

import { STATE } from './app-state.js';
import { formatRupiah, formatDate, escapeHtml } from './utils.js';
import { showToast } from './toast.js';
import { supabaseFetch } from './api.js';
import { icon } from './icons.js';

let codesLoaded = false;
let codes = [];        // baris license_codes (terbaru dulu)
let codeView = [];     // hasil filter aktif — idx dipakai onclick daftar
let editingCode = null;
let ownerNames = {};   // uuid → label pemilik (client / partner)
let redemptions = [];  // pemakaian terbaru (code_redemptions)
let cfg = {};          // settings.referral_config
let codeFilter = 'all';
let codeQuery = '';

const DEFAULT_CFG = {
  discount_referral: 50000,
  min_purchase_for_discount: 100000,
  points_per_paid_referral: 50
};

/* =================== Muat data =================== */

async function fetchCodes() {
  const res = await supabaseFetch('/rest/v1/license_codes?select=id,code,kind,app_type,owner_client_id,owner_partner_id,created_by,discount_type,discount_value,max_discount,min_purchase,discount_max_uses,discount_used_count,discount_used_at,status,expires_at,notes,created_at&order=created_at.desc&limit=500');
  if (!res.ok) {
    console.error('license_codes fetch failed:', res.status, res.text);
    throw new Error('Gagal memuat kode diskon (HTTP ' + res.status + ')');
  }
  codes = res.data || [];
  await loadOwners();
}

/** Nama pemilik kode: clients (referral pelanggan) + referral_partners (mitra). */
async function loadOwners() {
  ownerNames = {};
  const clientIds = [...new Set(codes.map((c) => c.owner_client_id).filter(Boolean))];
  const partnerIds = [...new Set(codes.map((c) => c.owner_partner_id).filter(Boolean))];
  await Promise.all([
    loadOwnerBatch(clientIds, 'clients', 'id,nama_usaha', (r) => {
      ownerNames[r.id] = r.nama_usaha || 'Pelanggan';
    }),
    loadOwnerBatch(partnerIds, 'referral_partners', 'id,nama,kota', (r) => {
      const label = [r.nama, r.kota].filter(Boolean).join(' · ');
      ownerNames[r.id] = label || 'Mitra';
    })
  ]);
}

async function loadOwnerBatch(ids, table, cols, push) {
  for (let i = 0; i < ids.length; i += 60) {
    const chunk = ids.slice(i, i + 60);
    const res = await supabaseFetch('/rest/v1/' + table + '?select=' + cols + '&id=in.(' + chunk.join(',') + ')');
    if (res.ok) (res.data || []).forEach(push);
  }
}

async function fetchRedemptions() {
  const res = await supabaseFetch('/rest/v1/code_redemptions?select=code_id,code,channel,app_type,discount_value,points_awarded,referee_name,referee_city,status,created_at&order=created_at.desc&limit=10');
  if (!res.ok) {
    console.error('code_redemptions fetch failed:', res.status, res.text);
    redemptions = [];
    return;
  }
  redemptions = res.data || [];
}

async function loadRefConfig() {
  const res = await supabaseFetch('/rest/v1/settings?key=eq.referral_config&select=value&limit=1');
  if (!res.ok || !Array.isArray(res.data) || !res.data.length) {
    cfg = { ...DEFAULT_CFG };
    return;
  }
  const v = res.data[0].value;
  let parsed = v;
  if (typeof v === 'string') {
    try { parsed = JSON.parse(v); } catch { parsed = {}; }
  }
  cfg = { ...DEFAULT_CFG, ...(parsed || {}) };
}

/* =================== Helper label =================== */

/** Status efektif: status tersimpan + kadaluwarsa dari tanggal. */
function codeStatus(c) {
  const s = String(c.status || '').toLowerCase();
  if (s === 'dibatalkan') return 'dibatalkan';
  if (s === 'terpakai') return 'terpakai';
  if (c.expires_at && new Date(c.expires_at).getTime() <= Date.now()) return 'kadaluwarsa';
  if (s === 'kadaluwarsa') return 'kadaluwarsa';
  return 'aktif';
}

const CODE_STATUS_CHIP = {
  aktif:       { cls: 'domain-live',  label: 'Aktif' },
  terpakai:    { cls: 'domain-maint', label: 'Habis' },
  kadaluwarsa: { cls: 'domain-none',  label: 'Kadaluwarsa' },
  dibatalkan:  { cls: 'domain-none',  label: 'Dibatalkan' }
};

function statusChip(c) {
  const b = CODE_STATUS_CHIP[codeStatus(c)] || CODE_STATUS_CHIP.aktif;
  return '<span class="domain-chip ' + b.cls + '">' + b.label + '</span>';
}

function diskonLabel(c) {
  if (c.discount_type === 'percent') {
    const base = c.discount_value + '%';
    return c.max_discount ? base + ' · maks ' + formatRupiah(c.max_discount) : base;
  }
  return formatRupiah(c.discount_value);
}

function scopeLabel(appType) {
  if (!appType || appType === '*') return 'Semua produk';
  const p = (STATE.catalog || []).find((x) => x.appType === appType);
  return p ? p.name : appType;
}

function ownerLabel(c) {
  const id = c.owner_client_id || c.owner_partner_id;
  if (!id) return '—';
  return ownerNames[id] || '—';
}

function genVoucherCode() {
  const hex = '0123456789ABCDEF';
  let s = '';
  for (let i = 0; i < 6; i++) s += hex[Math.floor(Math.random() * 16)];
  return 'DSK-' + s;
}

/* =================== Render daftar kode =================== */

function renderCodes() {
  const tbody = document.getElementById('codeTableBody');
  const grid = document.getElementById('codeCardList');
  const empty = document.getElementById('codeEmpty');
  const count = document.getElementById('catN-kode');
  if (count) count.textContent = codes.length || '';

  codeView = codes.filter((c) => {
    if (codeFilter !== 'all' && c.kind !== codeFilter) return false;
    if (codeQuery && !String(c.code || '').includes(codeQuery)) return false;
    return true;
  });

  if (!tbody || !grid) return;

  if (!codeView.length) {
    tbody.innerHTML = '';
    grid.innerHTML = '';
    if (empty) {
      empty.hidden = false;
      const t = empty.querySelector('.empty-t');
      const d = empty.querySelector('.empty-d');
      if (codes.length) {
        if (t) t.textContent = 'Tidak ada kode yang cocok';
        if (d) d.textContent = 'Coba ubah filter atau kata kunci pencarian.';
      } else {
        if (t) t.textContent = 'Belum ada kode diskon';
        if (d) d.textContent = 'Buat voucher diskon, atau biarkan kode referral terbentuk otomatis dari pelanggan dan mitra.';
      }
    }
    return;
  }
  if (empty) empty.hidden = true;

  // ── Tabel (desktop) ──
  tbody.innerHTML = codeView.map((c, i) => `
    <tr data-idx="${i}" data-id="${escapeHtml(c.id)}" tabindex="0">
      <td><span class="mono" style="font-weight:700">${escapeHtml(c.code)}</span></td>
      <td><span class="tag-pill">${c.kind === 'voucher' ? 'Voucher' : 'Referral'}</span></td>
      <td>${escapeHtml(ownerLabel(c))}</td>
      <td class="ct-price">${escapeHtml(diskonLabel(c))}</td>
      <td>${c.min_purchase > 0 ? formatRupiah(c.min_purchase) : '—'}</td>
      <td class="ct-quota" title="${c.discount_used_at ? 'Terakhir ' + escapeHtml(formatDate(c.discount_used_at)) : ''}">${c.discount_used_count || 0}${c.discount_max_uses ? '/' + c.discount_max_uses : ''}</td>
      <td>${escapeHtml(scopeLabel(c.app_type))}</td>
      <td>${statusChip(c)}</td>
      <td>${escapeHtml(formatDate(c.expires_at))}</td>
      <td class="ct-actions">
        <button type="button" class="btn ${codeStatus(c) === 'aktif' ? 'btn-danger' : 'btn-outline'} btn-sm" onclick="event.stopPropagation(); toggleCodeStatus(${i})" aria-label="${codeStatus(c) === 'aktif' ? 'Batalkan kode' : 'Aktifkan kembali'} ${escapeHtml(c.code)}">${codeStatus(c) === 'aktif' ? 'Batalkan' : 'Aktifkan'}</button>
      </td>
    </tr>`).join('');
  tbody.querySelectorAll('tr[data-idx]').forEach((row) => {
    row.style.cursor = 'pointer';
    row.addEventListener('click', (event) => {
      if (event.target.closest('button')) return;
      openCodePage(parseInt(row.dataset.idx, 10));
    });
    row.addEventListener('keydown', (event) => {
      if (event.target !== row || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault();
      openCodePage(parseInt(row.dataset.idx, 10));
    });
  });
  // ── Kartu (mobile): aksi edit eksplisit, tanpa menjadikan seluruh baris tombol semu ──
  grid.innerHTML = codeView.map((c, i) => `
    <div class="oc-row" data-idx="${i}">
      <div class="oc-ava" aria-hidden="true">${c.kind === 'voucher' ? '🎟️' : '🤝'}</div>
      <div class="oc-main">
        <div class="oc-name mono">${escapeHtml(c.code)}</div>
        <div class="oc-sub">${escapeHtml(diskonLabel(c))} · pakai ${c.discount_used_count || 0}${c.discount_max_uses ? '/' + c.discount_max_uses : ''} · ${escapeHtml(scopeLabel(c.app_type))}</div>
      </div>
      <div class="oc-side">
        ${statusChip(c)}
        <button type="button" class="oc-more" aria-label="Edit ${escapeHtml(c.code)}" title="Edit" onclick="openCodePage(${i})">${icon('pencil', 14)}</button>
      </div>
    </div>`).join('');
}

function renderRedemptions() {
  const box = document.getElementById('codeRedemptions');
  const emptyEl = document.getElementById('codeRedemptionsEmpty');
  if (!box) return;
  if (!redemptions.length) {
    box.innerHTML = '';
    if (emptyEl) emptyEl.hidden = false;
    return;
  }
  if (emptyEl) emptyEl.hidden = true;
  box.innerHTML = redemptions.map((r) => `
    <div class="oc-row">
      <div class="oc-ava">🧾</div>
      <div class="oc-main">
        <div class="oc-name">${escapeHtml(r.referee_name || 'Pelanggan')}${r.referee_city ? ' · ' + escapeHtml(r.referee_city) : ''}</div>
        <div class="oc-sub"><span class="mono">${escapeHtml(r.code || '')}</span> · ${escapeHtml(scopeLabel(r.app_type))} · ${escapeHtml(formatDate(r.created_at))}</div>
      </div>
      <div class="oc-side">
        <span class="tag-pill">-${formatRupiah(r.discount_value || 0)}</span>
        ${r.points_awarded ? `<span class="hot-badge hot-badge-sm">+${r.points_awarded} poin</span>` : ''}
      </div>
    </div>`).join('');
}

/* =================== Flip page edit =================== */

function flipCodesEdit(on) {
  const page = document.getElementById('catalogEditPage');
  const tabs = document.getElementById('catalogTabs');
  if (on) {
    ['catViewSoftware', 'catViewHardware', 'catViewLayanan', 'catViewKode'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.hidden = true;
    });
    if (tabs) tabs.hidden = true;
    if (page) page.hidden = false;
  } else {
    if (page) page.hidden = true;
    if (tabs) tabs.hidden = false;
    const active = document.querySelector('#catalogTabs .content-tab.active');
    const tab = (active && active.dataset.ctab) || 'software';
    if (window.switchCatalogTab) window.switchCatalogTab(tab);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

window.closeCodePage = function () {
  flipCodesEdit(false);
};

window.openCodePage = function (ref = null) {
  let c = null;
  if (typeof ref === 'number') c = codeView[ref] || null;
  else if (typeof ref === 'string' && ref) c = codes.find((x) => x.id === ref) || null;
  const isEdit = !!c;
  editingCode = c;

  const expDefault = isEdit
    ? String(c.expires_at || '').slice(0, 10)
    : new Date(Date.now() + 90 * 86400000).toISOString().slice(0, 10);

  const scopeOptions = ['<option value="*"' + (!isEdit || c.app_type === '*' ? ' selected' : '') + '>Semua produk</option>']
    .concat((STATE.catalog || [])
      .filter((p, i, arr) => p.appType && arr.findIndex((x) => x.appType === p.appType) === i)
      .map((p) => '<option value="' + escapeHtml(p.appType) + '"' + (isEdit && c.app_type === p.appType ? ' selected' : '') + '>' + escapeHtml(p.name) + ' (' + escapeHtml(p.appType) + ')</option>'))
    .join('');

  const page = document.getElementById('catalogEditPage');
  if (!page) return;

  page.innerHTML = `
    <div class="cd-head cd-head-sticky" role="region" aria-label="${isEdit ? 'Edit kode diskon' : 'Buat kode diskon'}">
      <button type="button" class="btn btn-outline btn-sm" onclick="closeCodePage()">← Kembali</button>
      <div class="cd-title"><h3>${isEdit ? 'Edit Kode Diskon' : 'Buat Kode Diskon'}</h3></div>
      <div class="cd-head-actions">
        <button type="button" class="btn btn-primary btn-sm" onclick="saveCodePage()">${isEdit ? 'Simpan' : 'Buat Kode'}</button>
      </div>
    </div>

    <div class="cd-sec">
      <div class="cd-sec-t">Kode</div>
      <div class="field-grid">
        <div class="field">
          <label class="field-label" for="codeKode">Kode</label>
          <input type="text" id="codeKode" value="${isEdit ? escapeHtml(c.code) : ''}" placeholder="DSK-8F2K9Q" ${isEdit ? 'readonly' : ''} style="text-transform:uppercase">
          ${isEdit ? '' : '<small class="field-hint">Klik Generate, atau ketik kode sendiri (huruf besar, angka, dash).</small>'}
        </div>
        ${isEdit ? '' : `
        <div class="field">
          <button type="button" class="btn btn-outline btn-sm" onclick="genCodeBtn()">Generate Kode</button>
        </div>`}
        <div class="field">
          <label class="field-label" for="codeJenis">Jenis</label>
          <input type="text" id="codeJenis" value="${isEdit && c.kind === 'referral' ? 'Kode referral (otomatis)' : 'Voucher diskon'}" readonly>
        </div>
        <div class="field">
          <label class="field-label" for="codeScope">Cakupan Produk</label>
          <select id="codeScope">${scopeOptions}</select>
          <small class="field-hint">Semua produk = kode berlaku di semua aplikasi Kasir Solo.</small>
        </div>
        ${isEdit ? `
        <div class="field">
          <label class="field-label" for="codeStatus">Status</label>
          <select id="codeStatus">
            <option value="aktif" ${codeStatus(c) === 'aktif' ? 'selected' : ''}>Aktif</option>
            <option value="dibatalkan" ${c.status === 'dibatalkan' ? 'selected' : ''}>Dibatalkan</option>
          </select>
          ${['terpakai', 'kadaluwarsa'].includes(String(c.status || '').toLowerCase()) ? '<small class="field-hint">Status tersimpan: ' + escapeHtml(c.status) + ' — pilih Aktif untuk mengaktifkan ulang.</small>' : ''}
        </div>` : ''}
      </div>
    </div>

    <div class="cd-sec">
      <div class="cd-sec-t">Diskon dan Batasan</div>
      <div class="field-grid">
        <div class="field">
          <label class="field-label" for="codeDtype">Tipe Diskon</label>
          <select id="codeDtype">
            <option value="fixed" ${!isEdit || c.discount_type !== 'percent' ? 'selected' : ''}>Nominal (Rp)</option>
            <option value="percent" ${isEdit && c.discount_type === 'percent' ? 'selected' : ''}>Persen (%)</option>
          </select>
        </div>
        <div class="field">
          <label class="field-label" for="codeDval">Nilai Diskon</label>
          <input type="number" id="codeDval" min="0" ${isEdit && c.discount_type === 'percent' ? 'max="100"' : ''} value="${isEdit ? Number(c.discount_value || 0) : ''}" placeholder="${isEdit && c.discount_type === 'percent' ? '10' : '50000'}">
        </div>
        <div class="field">
          <label class="field-label" for="codeDmax">Maks. Diskon (Rp, khusus persen)</label>
          <input type="number" id="codeDmax" min="0" step="5000" value="${isEdit && c.max_discount != null ? Number(c.max_discount) : ''}" placeholder="Kosong = tanpa batas">
          <small class="field-hint">Batas potongan terbesar untuk tipe persen. Diabaikan untuk nominal.</small>
        </div>
        <div class="field">
          <label class="field-label" for="codeMin">Min. Pembelian (Rp)</label>
          <input type="number" id="codeMin" min="0" step="10000" value="${isEdit ? Number(c.min_purchase || 0) : 0}">
        </div>
        <div class="field">
          <label class="field-label" for="codeMaxUses">Batas Pemakaian</label>
          <input type="number" id="codeMaxUses" min="1" step="1" value="${isEdit && c.discount_max_uses != null ? Number(c.discount_max_uses) : ''}" placeholder="Kosong = tak terbatas">
          <small class="field-hint">Kuota total kode. Satu perangkat tetap hanya sekali pakai meski tak terbatas.</small>
        </div>
        <div class="field">
          <label class="field-label" for="codeExpires">Berlaku Sampai</label>
          <input type="date" id="codeExpires" value="${expDefault}">
          <small class="field-hint">Tanggal terakhir kode bisa dipakai.</small>
        </div>
        <div class="field field-span-2">
          <label class="field-label" for="codeNotes">Catatan (internal)</label>
          <textarea id="codeNotes" rows="2" placeholder="mis. voucher peluncuran rosok">${isEdit ? escapeHtml(c.notes || '') : ''}</textarea>
        </div>
      </div>
    </div>

    ${isEdit && c.kind === 'referral' ? `
    <div class="cd-sec">
      <div class="cd-sec-t">Info Kode Referral</div>
      <div class="field-hint">Kode referral milik ${escapeHtml(ownerLabel(c) !== '—' ? ownerLabel(c) : 'pengguna')} dan terbentuk otomatis. Perubahan nilai diskon langsung berlaku di app. Membatalkan membuat pemilik tidak bisa memakai kodenya lagi (tidak dibuat ulang otomatis).</div>
    </div>` : ''}

    ${isEdit ? `
    <div class="cd-sec">
      <div class="cd-sec-t">Pemakaian</div>
      <div class="field-hint" style="margin-bottom:8px">Terpakai <b>${c.discount_used_count || 0}</b>${c.discount_max_uses ? ' dari kuota ' + c.discount_max_uses : ''} kali${c.discount_used_at ? ' · terakhir ' + escapeHtml(formatDate(c.discount_used_at)) : ''}.</div>
      <div id="codeUsageList"><div class="field-hint">Memuat riwayat…</div></div>
    </div>` : ''}
  `;

  flipCodesEdit(true);

  if (isEdit && c.id) loadCodeUsage(c.id);
  setTimeout(() => document.getElementById(isEdit ? 'codeKode' : 'codeKode')?.focus(), 100);
};

window.genCodeBtn = function () {
  const inp = document.getElementById('codeKode');
  if (inp) {
    inp.value = genVoucherCode();
    inp.focus();
  }
};

async function loadCodeUsage(codeId) {
  const box = document.getElementById('codeUsageList');
  if (!box) return;
  const res = await supabaseFetch('/rest/v1/code_redemptions?select=code,app_type,discount_value,points_awarded,referee_name,status,created_at&code_id=eq.' + codeId + '&order=created_at.desc&limit=20');
  if (!res.ok) {
    box.innerHTML = '<div class="field-hint">Gagal memuat riwayat pemakaian.</div>';
    return;
  }
  const rows = res.data || [];
  if (!rows.length) {
    box.innerHTML = '<div class="field-hint">Belum ada pemakaian tercatat.</div>';
    return;
  }
  box.innerHTML = rows.map((r) =>
    '<div class="oc-sub" style="padding:6px 0;border-bottom:1px solid var(--border)">'
    + escapeHtml(formatDate(r.created_at)) + ' · ' + escapeHtml(r.referee_name || 'Pelanggan')
    + ' · -' + formatRupiah(r.discount_value || 0)
    + (r.points_awarded ? ' · +' + r.points_awarded + ' poin' : '')
    + (r.status && r.status !== 'berhasil' ? ' · ' + escapeHtml(r.status) : '')
    + '</div>'
  ).join('');
}

/* =================== Simpan / ubah status =================== */

window.saveCodePage = async function () {
  if (!editingCode && !codesLoaded) {
    showToast('Data kode belum siap', 2000, 'error');
    return;
  }
  const val = (id) => (document.getElementById(id)?.value || '').trim();
  const code = val('codeKode').toUpperCase();
  const isEdit = !!editingCode;
  const kind = isEdit ? editingCode.kind : 'voucher';
  const dtype = document.getElementById('codeDtype')?.value || 'fixed';
  const dval = Math.max(0, Number(val('codeDval')) || 0);
  const dmaxRaw = val('codeDmax');
  const dmax = dmaxRaw ? Math.max(0, Number(dmaxRaw) || 0) : null;
  const min = Math.max(0, Number(val('codeMin')) || 0);
  const kuotaRaw = val('codeMaxUses');
  const kuota = kuotaRaw ? Math.max(1, parseInt(kuotaRaw, 10) || 1) : null;
  const expStr = val('codeExpires');
  const scope = val('codeScope') || '*';
  const notes = val('codeNotes') || null;

  if (!/^[A-Z0-9][A-Z0-9-]{3,23}$/.test(code)) {
    showToast('Kode harus 4-24 karakter: huruf besar, angka, dash', 2500, 'error');
    return;
  }
  if (dtype === 'percent') {
    if (dval < 1 || dval > 100) {
      showToast('Diskon persen harus 1-100', 2500, 'error');
      return;
    }
  } else if (dval <= 0) {
    showToast('Nilai diskon harus lebih dari 0', 2500, 'error');
    return;
  }
  if (!expStr) {
    showToast('Isi tanggal berlaku sampai', 2500, 'error');
    return;
  }
  const expiresIso = new Date(expStr + 'T23:59:59').toISOString();
  if (new Date(expiresIso).getTime() <= Date.now()) {
    showToast('Tanggal berlaku harus di masa depan', 2500, 'error');
    return;
  }

  try {
    let res;
    if (isEdit) {
      const payload = {
        app_type: scope,
        discount_type: dtype,
        discount_value: dval,
        max_discount: dtype === 'percent' ? dmax : null,
        min_purchase: min,
        discount_max_uses: kuota,
        expires_at: expiresIso,
        status: document.getElementById('codeStatus')?.value || 'aktif',
        notes,
        updated_at: new Date().toISOString()
      };
      res = await supabaseFetch('/rest/v1/license_codes?id=eq.' + editingCode.id, {
        method: 'PATCH',
        data: payload,
        headers: { Prefer: 'return=representation' }
      });
    } else {
      const payload = {
        code,
        kind,
        app_type: scope,
        discount_type: dtype,
        discount_value: dval,
        max_discount: dtype === 'percent' ? dmax : null,
        min_purchase: min,
        discount_max_uses: kuota,
        expires_at: expiresIso,
        status: 'aktif',
        created_by: 'admin',
        notes
      };
      res = await supabaseFetch('/rest/v1/license_codes', {
        method: 'POST',
        data: payload,
        headers: { Prefer: 'return=representation' }
      });
    }

    if (res.ok) {
      showToast(isEdit ? 'Kode diperbarui' : 'Kode ' + code + ' dibuat', 2200, 'success');
      await reloadCodesAndRender();
      closeCodePage();
    } else if (res.status === 409) {
      showToast('Kode sudah dipakai — ganti kode lain', 2500, 'error');
    } else {
      console.error('save code failed:', res.status, res.text);
      showToast('Gagal menyimpan kode (HTTP ' + res.status + ')', 2500, 'error');
    }
  } catch (e) {
    console.error('Error saving code:', e);
    showToast('Error: ' + e.message, 2500, 'error');
  }
};

window.toggleCodeStatus = async function (viewIdx) {
  const c = codeView[viewIdx];
  if (!c) return;
  const next = codeStatus(c) === 'aktif' ? 'dibatalkan' : 'aktif';
  if (next === 'dibatalkan' && !confirm('Batalkan kode ' + c.code + '? Pemegang tidak bisa memakainya lagi.')) return;
  try {
    const res = await supabaseFetch('/rest/v1/license_codes?id=eq.' + c.id, {
      method: 'PATCH',
      data: { status: next, updated_at: new Date().toISOString() },
      headers: { Prefer: 'return=representation' }
    });
    if (res.ok) {
      showToast(next === 'aktif' ? 'Kode diaktifkan' : 'Kode dibatalkan', 2000, 'success');
      await reloadCodesAndRender();
    } else {
      console.error('toggle status failed:', res.status, res.text);
      showToast('Gagal mengubah status kode', 2500, 'error');
    }
  } catch (e) {
    console.error('Error toggling code status:', e);
    showToast('Error: ' + e.message, 2500, 'error');
  }
};

/* =================== Default global (referral_config) =================== */

function fillRefConfig() {
  const setv = (id, v) => {
    const el = document.getElementById(id);
    if (el && document.activeElement !== el) el.value = v;
  };
  setv('refCfgDiscount', cfg.discount_referral ?? DEFAULT_CFG.discount_referral);
  setv('refCfgMin', cfg.min_purchase_for_discount ?? DEFAULT_CFG.min_purchase_for_discount);
  setv('refCfgPoints', cfg.points_per_paid_referral ?? DEFAULT_CFG.points_per_paid_referral);
}

window.saveRefConfig = async function () {
  const num = (id) => Math.max(0, parseInt(document.getElementById(id)?.value, 10) || 0);
  const value = {
    discount_referral: num('refCfgDiscount'),
    min_purchase_for_discount: num('refCfgMin'),
    points_per_paid_referral: num('refCfgPoints')
  };
  // Pertahankan kunci lain (payout_cycle_days_* dll.) yang sudah ada.
  const merged = { ...cfg, ...value };
  try {
    const res = await supabaseFetch('/rest/v1/settings?on_conflict=key', {
      method: 'POST',
      data: { key: 'referral_config', value: merged },
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }
    });
    if (res.ok) {
      cfg = merged;
      showToast('Default kode referral tersimpan', 2000, 'success');
    } else {
      console.error('save referral_config failed:', res.status, res.text);
      showToast('Gagal menyimpan default (HTTP ' + res.status + ')', 2500, 'error');
    }
  } catch (e) {
    console.error('Error saving referral_config:', e);
    showToast('Error: ' + e.message, 2500, 'error');
  }
};

/* =================== Init & integrasi =================== */

function bindFilters() {
  document.querySelectorAll('#codeFilters .content-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      codeFilter = btn.dataset.cf || 'all';
      document.querySelectorAll('#codeFilters .content-tab').forEach((b) => {
        const on = b === btn;
        b.classList.toggle('active', on);
        b.setAttribute('aria-pressed', String(on));
      });
      renderCodes();
    });
  });
  const search = document.getElementById('codeSearch');
  if (search) {
    search.addEventListener('input', () => {
      codeQuery = (search.value || '').trim().toUpperCase();
      renderCodes();
    });
  }
}

async function reloadCodesAndRender() {
  try {
    await Promise.all([fetchCodes(), fetchRedemptions()]);
  } catch (e) {
    console.error('reload codes:', e);
  }
  renderCodes();
  renderRedemptions();
}

export async function initCodesTab() {
  bindFilters();
  fillRefConfig();
  try {
    await Promise.all([fetchCodes(), fetchRedemptions(), loadRefConfig()]);
  } catch (e) {
    console.error('initCodesTab:', e);
    showToast(e.message || 'Gagal memuat kode diskon', 3000, 'error');
  }
  codesLoaded = true;
  refreshProductCodeSummary();
  fillRefConfig();
  renderCodes();
  renderRedemptions();
}

/** Dipanggil catalog.js saat tab Kode Diskon dibuka (render ulang dari cache). */
export function refreshCodesUI() {
  renderCodes();
  renderRedemptions();
}

/** Statistik untuk garis ringkasan + hitung tab (renderTabCounts di catalog.js). */
export function getCodesCount() {
  return codes.length;
}

export function getCodesLine() {
  if (!codes.length) return '<span class="cat-st"><i></i>belum ada kode</span>';
  const aktif = codes.filter((c) => codeStatus(c) === 'aktif').length;
  const pakai = codes.reduce((s, c) => s + (c.discount_used_count || 0), 0);
  const voucher = codes.filter((c) => c.kind === 'voucher').length;
  return '<span class="cat-st"><i></i>' + codes.length + ' kode (' + voucher + ' voucher)</span>'
    + '<span class="cat-st"><i class="is-live"></i>' + aktif + ' aktif</span>'
    + '<span class="cat-st"><i class="is-ready"></i>' + pakai + ' pemakaian</span>';
}

/**
 * Sinkronkan ringkasan kode di editor produk kalau flip page sedang terbuka —
 * dipanggil initCodesTab setelah fetch pertama selesai (codesLoaded baru true).
 */
function refreshProductCodeSummary() {
  const wrap = document.getElementById('prodCodeSummaryWrap');
  if (!wrap) return;
  const idx = parseInt(wrap.dataset.idx, 10);
  const app = Number.isInteger(idx) ? (STATE.catalog || [])[idx] : null;
  if (!app) return;
  wrap.innerHTML = renderProductCodeSummary(app);
}

/**
 * Ringkasan kode yang berlaku untuk satu produk — dirender di dalam halaman
 * edit produk (openCatalogPage, catalog.js). Read-only + tautan kelola.
 */
export function renderProductCodeSummary(app) {
  const t = (app && app.appType) || '';
  if (!codesLoaded) {
    return '<div class="cd-sec"><div class="cd-sec-t">Kode Diskon</div><div class="field-hint">Memuat kode diskon…</div></div>';
  }
  const list = codes.filter((c) => c.app_type === '*' || (t && c.app_type === t));
  const rows = list.slice(0, 6).map((c) => `
    <div class="oc-row">
      <div class="oc-ava">${c.kind === 'voucher' ? '🎟️' : '🤝'}</div>
      <div class="oc-main">
        <div class="oc-name mono">${escapeHtml(c.code)} <span class="tag-pill">${c.kind === 'voucher' ? 'Voucher' : 'Referral'}</span></div>
        <div class="oc-sub">${escapeHtml(diskonLabel(c))} · pakai ${c.discount_used_count || 0}${c.discount_max_uses ? '/' + c.discount_max_uses : ''} · ${escapeHtml(scopeLabel(c.app_type))}</div>
      </div>
      <div class="oc-side">${statusChip(c)}</div>
    </div>`).join('');
  return `
    <div class="cd-sec">
      <div class="cd-sec-t">Kode Diskon untuk Produk Ini</div>
      ${list.length ? '<div class="oc-list">' + rows + '</div>' : '<div class="field-hint">Belum ada kode yang berlaku untuk produk ini' + (t ? ' (app_type ' + escapeHtml(t) + ')' : '') + '.</div>'}
      <div style="margin-top:8px"><button type="button" class="btn btn-outline btn-sm" onclick="closeCatalogPage(); switchCatalogTab('kode')">Kelola semua kode →</button></div>
    </div>`;
}
