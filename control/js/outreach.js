/**
 * Control Center Kasir Solo — Outreach Module (Klien Lama)
 * Kampanye reaktivasi klien lama Mesin Kasir Solo: impor kontak dari CSV
 * Excel lama, kelola status alur WA manual (belum → terkirim → bales →
 * minat → beli, plus mati/optout), catatan per kontak, ekspor balik.
 *
 * Layout: workbench native-style — chip rail berhitung (filter + statistik
 * sekaligus), baris kontak padat dengan avatar inisial per kategori bisnis,
 * sheet detail dengan status segmented (1 tap ganti status).
 *
 * Akses: semua data lewat supabaseFetch() → Vercel Serverless /api/rest
 * (service_role key hanya server-side, tidak pernah di browser).
 * Tabel: outreach_contacts (unique nomor_wa; RLS tanpa policy publik).
 */

import { showToast } from './toast.js';
import { escapeHtml, formatRelativeTime } from './utils.js';
import { supabaseFetch } from './api.js';
import { updateSidebarBadges } from './navigation.js?v=20260915a';

let contacts = [];
let chipFilter = ''; // '' = semua
let sourceFilter = ''; // '' = semua sumber (klien_lama / prospek-<kota>)
let detailId = null;

/** Alur status kampanye — urutan = tahapan natural percakapan WA.
 *  `short` = label ringkas utk chip/pill; `label` = utk toast & sheet info. */
export const OUTREACH_STAGES = [
  { key: 'belum',    short: 'Belum',    label: 'Belum Dihubungi', tone: 'gray' },
  { key: 'terkirim', short: 'Terkirim', label: 'Terkirim',        tone: 'blue' },
  { key: 'bales',    short: 'Bales',    label: 'Membalas',        tone: 'amber' },
  { key: 'minat',    short: 'Minat',    label: 'Tertarik',        tone: 'orange' },
  { key: 'beli',     short: 'Beli',     label: 'Beli Lisensi',    tone: 'green' },
  { key: 'mati',     short: 'Mati',     label: 'Nomor Mati',      tone: 'red' },
  { key: 'optout',   short: 'Opt-out',  label: 'Jangan Kontak',   tone: 'gray' },
];

function stageMeta(status) {
  return OUTREACH_STAGES.find((s) => s.key === status) || { key: status, short: status, label: status || 'Tanpa status', tone: 'gray' };
}

/** Init module — dipanggil dari app.js bootstrap */
export function initOutreach() {
  document.getElementById('outreachSearch')?.addEventListener('input', renderList);
  document.getElementById('outreachSource')?.addEventListener('change', (e) => {
    sourceFilter = e.target.value || '';
    renderAll();
  });
  document.getElementById('outreachImportFile')?.addEventListener('change', onImportFile);

  window.addEventListener('screen:change', (e) => {
    if (e.detail?.screen === 'outreach') { loadOutreach(); }
  });

  loadOutreach();
}

/** Muat semua kontak (coalesced — panggilan beruntun digabung satu request) */
async function loadOutreach() {
  if (loadOutreach._inflight) return loadOutreach._inflight;
  const p = (async () => {
    try {
      const res = await supabaseFetch('/rest/v1/outreach_contacts?order=last_contact_at.desc.nullslast,nama.asc');
      contacts = res.ok ? (res.data || []) : [];
    } catch (e) {
      contacts = [];
      console.error('load outreach', e);
    }
    renderAll();
    updateSidebarBadges({ outreach: contacts.length });
    // beri tahu modul lain (dashboard) bahwa data kontak sudah siap
    window.dispatchEvent(new CustomEvent('outreach:data'));
  })();
  loadOutreach._inflight = p;
  try { return await p; } finally { loadOutreach._inflight = null; }
}
window.refreshOutreach = loadOutreach;

/** Akses data kontak utk modul lain (dashboard) — live dari memori modul ini */
export function getOutreachContacts() {
  return contacts;
}

/* ================= Render ================= */

function renderAll() {
  renderSourceSelect();
  renderChips();
  renderStatline();
  renderList();
}

/* ── Filter sumber (klien lama vs prospek per kota) ─────────────────────────
 * Basis = kontak setelah filter sumber; chip status & statline menghitung
 * di dalam basis ini supaya angka selalu nyambung dengan list. */
function sumberBasis() {
  return sourceFilter ? contacts.filter((c) => c.source === sourceFilter) : contacts;
}

/** Label cantik sumber: 'klien_lama' → 'Klien Lama', 'prospek-malang' → 'Prospek Malang' */
function labelSumber(s) {
  if (s === 'klien_lama') return 'Klien Lama';
  if (s.startsWith('prospek-')) return 'Prospek ' + s.slice(8).replace(/^\w/, (c) => c.toUpperCase());
  return s || 'Tanpa sumber';
}

/** Isi dropdown sumber dari data nyata (urut jumlah terbanyak) */
function renderSourceSelect() {
  const sel = document.getElementById('outreachSource');
  if (!sel) return;
  const hitung = {};
  for (const c of contacts) hitung[c.source || ''] = (hitung[c.source || ''] || 0) + 1;
  const opsi = [{ key: '', label: 'Semua sumber', n: contacts.length }]
    .concat(Object.entries(hitung)
      .sort((a, b) => b[1] - a[1])
      .map(([key, n]) => ({ key, label: `${labelSumber(key)} (${n})` })));
  sel.innerHTML = opsi.map((o) =>
    `<option value="${escapeHtml(o.key)}"${o.key === sourceFilter ? ' selected' : ''}>${escapeHtml(o.label)}</option>`).join('');
}

const countBy = (k, list = contacts) => list.filter((c) => c.status === k).length;

/** Chip rail — filter + statistik dalam satu elemen (signature layar ini) */
function renderChips() {
  const host = document.getElementById('outreachChips');
  if (!host) return;
  const basis = sumberBasis();
  const chips = [{ key: '', short: 'Semua', tone: 'gray', n: basis.length }]
    .concat(OUTREACH_STAGES.map((s) => ({ ...s, n: countBy(s.key, basis) })));
  host.innerHTML = chips.map((c) => `
    <button type="button" class="oc-chip ${chipFilter === c.key ? 'on' : ''}" data-tone="${c.tone}"
      aria-pressed="${chipFilter === c.key}" onclick="setOutreachChip('${c.key}')">
      <i aria-hidden="true"></i>${escapeHtml(c.short)}<span class="n">${c.n}</span>
    </button>`).join('');
}

window.setOutreachChip = function (key) {
  if (chipFilter === key) return;
  chipFilter = key;
  renderChips();
  renderList();
};

/** Satu baris ringkas: total + funnel hairline + beli + konversi (dalam basis sumber) */
function renderStatline() {
  const host = document.getElementById('outreachStatline');
  if (!host) return;
  const basis = sumberBasis();
  const total = basis.length || 1;
  const beli = countBy('beli', basis);
  const segs = OUTREACH_STAGES.filter((s) => !['belum', 'optout'].includes(s.key))
    .map((s) => ({ ...s, n: countBy(s.key, basis) }))
    .filter((s) => s.n > 0);
  const prog = segs.map((s) =>
    `<i data-tone="${s.tone}" style="width:${(s.n / total) * 100}%" title="${escapeHtml(s.label)} ${s.n}"></i>`).join('');
  host.innerHTML = `
    <span><b>${basis.length}</b> kontak</span>
    <span class="oc-prog" aria-hidden="true">${prog}</span>
    <span>Beli <b>${beli}</b></span>
    <span>Konversi <b>${Math.round((beli / total) * 100)}%</b></span>`;
}

function filteredContacts() {
  const q = (document.getElementById('outreachSearch')?.value || '').toLowerCase();
  return contacts.filter((c) => {
    if (sourceFilter && c.source !== sourceFilter) return false;
    if (chipFilter && c.status !== chipFilter) return false;
    if (!q) return true;
    return [c.nama, c.nomor_wa, c.alamat, c.kategori, c.catatan].some((v) => (v || '').toLowerCase().includes(q));
  });
}

/* Avatar inisial — warna mengikuti kategori bisnis (info, bukan hiasan) */
const AVA_TONE = { 'Kuliner': 'amber', 'Toko & Retail': 'blue', 'Jasa & Bengkel': 'teal', 'Petshop': 'green' };
function avaHtml(c) {
  const parts = (c.nama || '?').replace(/^@/, '').split(/\s+/).filter(Boolean);
  const ini = ((parts[0]?.[0] || '?') + (parts[1]?.[0] || '')).toUpperCase();
  return `<div class="oc-ava oc-ava--${AVA_TONE[c.kategori] || 'gray'}" title="${escapeHtml(c.kategori || 'Tanpa kategori')}">${escapeHtml(ini)}</div>`;
}

function renderList() {
  const host = document.getElementById('outreachCardList');
  const empty = document.getElementById('outreachEmpty');
  if (!host || !empty) return;

  const rows = filteredContacts();
  if (!rows.length) {
    host.innerHTML = '';
    empty.hidden = false;
    if (contacts.length) {
      empty.querySelector('.empty-t').textContent = 'Tidak ada yang cocok';
      empty.querySelector('.empty-d').textContent = 'Ubah kata kunci atau pilih chip status lain.';
    } else {
      empty.querySelector('.empty-t').textContent = 'Belum ada kontak outreach';
      empty.querySelector('.empty-d').textContent = 'Impor CSV klien lama untuk memulai kampanye.';
    }
    return;
  }
  empty.hidden = true;

  host.innerHTML = rows.map((c) => {
    const sm = stageMeta(c.status);
    return `
      <div class="oc-row" data-id="${escapeHtml(c.id)}" role="button" tabindex="0" aria-label="${escapeHtml(c.nama)}, ${escapeHtml(sm.label)}">
        ${avaHtml(c)}
        <div class="oc-main">
          <div class="oc-name">${escapeHtml(c.nama)}</div>
          <div class="oc-sub"><span class="mono">${escapeHtml(c.nomor_wa)}</span>${c.alamat ? ' · ' + escapeHtml(c.alamat) : ''}</div>
        </div>
        <div class="oc-side">
          <span class="badge ${sm.tone}">${escapeHtml(sm.short)}</span>
          <button type="button" class="oc-wa" aria-label="WhatsApp ${escapeHtml(c.nama)}" title="Buka WhatsApp" onclick="event.stopPropagation(); openOutreachDetail('${escapeHtml(c.id)}')">💬</button>
        </div>
      </div>`;
  }).join('');

  host.querySelectorAll('.oc-row').forEach((row) => {
    row.addEventListener('click', () => openOutreachDetail(row.dataset.id));
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openOutreachDetail(row.dataset.id); }
    });
  });
}

/* ================= Mutasi ================= */

/** Update sebagian field kontak — optimistic, rollback bila gagal */
async function patchContact(id, patch, okMsg) {
  const prev = contacts.find((c) => c.id === id);
  if (!prev) return;
  contacts = contacts.map((c) => c.id === id ? { ...c, ...patch } : c);
  renderAll();
  if (detailId === id) renderSheetBody(contacts.find((c) => c.id === id));
  try {
    const res = await supabaseFetch(`/rest/v1/outreach_contacts?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      data: patch,
      headers: { Prefer: 'return=representation' }
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    if (okMsg) showToast(okMsg, 1600, 'success');
  } catch (e) {
    contacts = contacts.map((c) => c.id === id ? prev : c);
    renderAll();
    if (detailId === id) renderSheetBody(contacts.find((c) => c.id === id));
    console.error(e);
    showToast('Gagal menyimpan perubahan', 2200, 'error');
  }
}

/** Ganti status + cap waktu kontak saat keluar dari "belum" */
function stagePatch(c, status) {
  const patch = { status };
  if (status !== 'belum' && status !== 'mati' && status !== 'optout' && c.status === 'belum') {
    patch.last_contact_at = new Date().toISOString();
    patch.sent_count = (Number(c.sent_count) || 0) + 1;
  }
  return patch;
}

/** Chip status di sheet — satu tap langsung simpan */
window.quickOutreachStage = function (id, status) {
  const c = contacts.find((x) => x.id === id);
  if (!c || c.status === status) return;
  patchContact(id, stagePatch(c, status), `Status → ${stageMeta(status).label}`);
};

/* ---------- Template chat WA per konteks ---------- */

const WA_TEMPLATES = {
  // Pertama kali dihubungi — perkenalan + tawaran coba gratis
  intro: [
    'Halo {nama}, saya dari Mesin Kasir Solo 👋 Dulu pernah pasang kasir di tempat {sapa}.\n\nMau kabarin: sekarang kami punya aplikasi kasir yang jalan di HP — catat jualan, kas, sampai laporan untung harian. Sekali bayar Rp 500rb, SELAMANYA, bukan langganan bulanan.\n\nBisa dicoba gratis dulu, mau saya kirim linknya, Kak?',
    'Halo {nama} 👋 Dari Mesin Kasir Solo sini. Lihat {usaha} masih jalan terus — hebat!\n\nKami sekarang punya aplikasi kasir HP yang cocok buat {kategori}: catat penjualan, kelola kas, lihat untung tiap hari. Sekali bayar Rp 500rb selamanya, bisa coba gratis dulu tanpa kartu kredit. Mau linknya, Kak?',
  ],
  // Follow-up setelah pesan pertama
  followup: [
    'Halo {nama}, kemarin sudah saya kabarin soal aplikasi kasir HP dari Mesin Kasir Solo 🙏\n\nRingkasnya: sekali bayar Rp 500rb selamanya, ada masa coba gratis, dan kalau mau pasang saya dampingi lewat video call sampai beres. Link coba: https://kaki5.kasirsolo.com\n\nAda yang mau ditanyakan, Kak?',
    'Halo {nama} 😊 Nyempilin lagi — aplikasi kasir HP dari Mesin Kasir Solo yang kemarin. Yang suka ditanyakan: gak ada langganan, data jualan tersimpan di HP sendiri, dan bisa cetak struk. Coba gratis dulu aja: https://kaki5.kasirsolo.com — kalau cocok baru bayar.',
  ],
  // Sudah bilang minat — harga + cara beli
  minat: [
    'Siap {nama}! 👍 Ini link coba gratisnya: https://kaki5.kasirsolo.com\n\nKalau sudah cocok: pembayaran Rp 500rb bisa QRIS atau transfer, lisensi langsung saya aktifkan (umumnya kurang dari 1 jam). Pasang bingung? Saya dampingi lewat video call sampai jalan.\n\nMau coba kapan, Kak?',
    'Halo {nama}, lanjutan dari chat kemarin ya 🙏\n\nHarganya sekali bayar Rp 500rb — seumur aplikasi, tanpa biaya bulanan. Bayar via QRIS/transfer, upload buktinya di aplikasi, lisensi aktif otomatis saya proses. Link coba gratis: https://kaki5.kasirsolo.com',
  ],
  // Sudah beli — after sales
  beli: [
    'Terima kasih banyak {nama}! 🙏 Aplikasinya sudah aktif.\n\nKalau ada kendala atau mau tanya fitur (laporan, backup, cetak struk), langsung chat sini aja ya — saya bantu. Semoga lancar jualannya! 🙌',
    'Halo {nama} 🙌 Sekali lagi makasih sudah pakai kasir dari Mesin Kasir Solo. Tips: aktifkan backup berkala di menu Pengaturan biar data jualan aman. Ada apa pun, chat sini aja ya!',
  ],
};

/** Nama sapaan ringkas: buang prefix gelar umum + @, ambil maks 2 kata */
function waSapa(nama) {
  const words = String(nama || '').replace(/^@/, '')
    .replace(/^(toko|warung|kedai|rm|wm|cafe|resto)\s+/i, '')
    .split(/\s+/).filter((w) => !/^(bp|ibu|mbak|mas|pak|bu)\.?$/i.test(w));
  return words.slice(0, 2).join(' ') || 'Kak';
}

function fillTemplate(tpl, c) {
  return tpl
    .replaceAll('{nama}', waSapa(c.nama))
    .replaceAll('{usaha}', c.nama || 'tempat Kakak')
    .replaceAll('{kategori}', (c.kategori || 'usaha kecil').toLowerCase());
}

/** Pilih kelompok template sesuai konteks kontak */
function templateGroup(c) {
  if (c.status === 'beli') return 'beli';
  if (c.status === 'minat') return 'minat';
  if ((Number(c.sent_count) || 0) > 0 || ['terkirim', 'bales'].includes(c.status)) return 'followup';
  return 'intro';
}

let waCtx = null; // { id, group, variant, dirty }

const HINT_GROUP = {
  intro: 'Template perkenalan — kontak ini belum pernah dihubungi.',
  followup: 'Template follow-up — kontak ini sudah pernah dihubungi.',
  minat: 'Template lanjutan — kontak ini sudah bilang minat.',
  beli: 'Template after-sales — kontak ini sudah beli.',
};

/**
 * Isi composer WA di dalam sheet detail. Prioritas isi:
 *   1. Draft AI terakhir untuk kontak ini (status apa pun — meja review tidak
 *      ada lagi; komposer INI titik reviewnya: periksa, edit, kirim).
 *   2. Template per konteks (intro/followup/minat/beli) varian 0.
 * Tidak menimpa isi yang sudah diedit user (flag dirty).
 */
async function isiComposerWa(c) {
  const ta = document.getElementById('outreachWaText');
  const hint = document.getElementById('outreachWaHint');
  if (!ta) return;
  const ctx = { id: c.id, group: templateGroup(c), variant: 0, dirty: false, outputId: null };
  waCtx = ctx;
  let teks = null;
  let asal = '';
  try {
    const res = await supabaseFetch(
      `/rest/v1/agent_outputs?select=id,isi,status&jenis=eq.draft_wa&ref_table=eq.outreach_contacts&ref_id=eq.${encodeURIComponent(c.id)}&status=in.(draft,approved,dipakai)&order=updated_at.desc&limit=1`,
    );
    const draf = res.ok && res.data?.[0];
    if (draf?.isi) {
      teks = draf.isi;
      ctx.outputId = draf.id;
      asal = draf.status === 'draft'
        ? 'Draft AI — periksa & edit bila perlu, lalu kirim'
        : 'Draft AI disetujui — siap kirim';
    }
  } catch { /* gagal ambil draft → jatuh ke template */ }
  // Sheet bisa saja sudah ditutup/diganti (waCtx diganti/null saat await) — batal.
  if (waCtx !== ctx || ctx.dirty) return;
  if (teks == null) {
    teks = fillTemplate(WA_TEMPLATES[ctx.group][0], c);
    asal = HINT_GROUP[ctx.group] || 'Template otomatis.';
  }
  ta.value = teks;
  if (hint) hint.textContent = asal;
}

/** Tombol 💬 pada baris/sheet: buka detail kontak — komposer WA ada di
 *  dalamnya dan template/draft sudah terisi otomatis (alur tak terpisah). */
window.openOutreachWa = function (id) {
  window.openOutreachDetail(id);
};

/** Generate ulang — putar ke varian template berikutnya */
window.regenerateOutreachWa = function () {
  if (!waCtx) return;
  const c = contacts.find((x) => x.id === waCtx.id);
  if (!c) return;
  const ta = document.getElementById('outreachWaText');
  const hint = document.getElementById('outreachWaHint');
  if (!ta) return;
  const list = WA_TEMPLATES[waCtx.group];
  waCtx.variant = (waCtx.variant + 1) % list.length;
  ta.value = fillTemplate(list[waCtx.variant], c);
  if (hint) hint.textContent = `Template ${waCtx.group} — varian ${waCtx.variant + 1}`;
  showToast('Template digenerate ulang', 1400, 'info');
};

/** Kembali ke template hasil generate (buang hasil edit manual) */
window.resetOutreachWa = function () {
  if (!waCtx) return;
  const c = contacts.find((x) => x.id === waCtx.id);
  if (!c) return;
  const ta = document.getElementById('outreachWaText');
  const hint = document.getElementById('outreachWaHint');
  if (!ta) return;
  ta.value = fillTemplate(WA_TEMPLATES[waCtx.group][waCtx.variant], c);
  if (hint) hint.textContent = `Template ${waCtx.group} — varian ${waCtx.variant + 1}`;
};

/** Buka composer WA utk kontak tertentu dari modul lain (mis. Agent —
 *  "Setujui & Buka Chat"). Array `contacts` diisi saat modul init, tapi bisa
 *  jadi belum memuat kontak tsb (data baru dari runner) — pastikan ter-load
 *  dulu, pindah ke halaman Outreach bila belum aktif, lalu buka composer.
 *  Return true bila composer terbuka. */
window.openOutreachWaFor = async function (id) {
  try {
    if (!contacts.some((c) => c.id === id)) {
      await loadOutreach(); // muat daftar kontak dulu (coalesced bila sedang jalan)
      // Masih tidak ada (mis. kontak baru dibuat runner) → ambil satu baris langsung
      if (!contacts.some((c) => c.id === id)) {
        const res = await supabaseFetch(`/rest/v1/outreach_contacts?id=eq.${encodeURIComponent(id)}&limit=1`);
        if (res.ok && res.data?.length) contacts = contacts.concat(res.data);
      }
    }
    if (!contacts.some((c) => c.id === id)) {
      showToast('Kontak untuk draft ini tidak ditemukan', 2400, 'error');
      return false;
    }
    // Pindah ke halaman Outreach bila belum aktif (window.showScreen = switchScreen)
    const active = document.querySelector('.screen.active');
    if (!active || active.id !== 'screen-outreach') window.showScreen?.('outreach');
    window.openOutreachWa(id);
    return true;
  } catch (e) {
    console.error('openOutreachWaFor', e);
    showToast('Gagal membuka composer WhatsApp', 2200, 'error');
    return false;
  }
};

/** Kirim dari komposer di sheet detail: buka WhatsApp dgn pesan terisi +
 *  tandai kontak terkirim + tutup sheet */
window.sendOutreachWa = function () {
  if (!waCtx) return;
  const c = contacts.find((x) => x.id === waCtx.id);
  if (!c) return;
  const text = (document.getElementById('outreachWaText')?.value || '').trim();
  if (!text) { showToast('Pesan masih kosong', 1800, 'error'); return; }
  if (['mati', 'optout'].includes(c.status)) {
    showToast('Kontak opt-out/mati — jangan dikontak lagi', 2600, 'error');
    return;
  }
  window.open(`https://wa.me/${c.nomor_wa}?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  // Draft AI yang dikirim (walau diedit) = dipakai — penanda akhir siklusnya
  if (waCtx.outputId) {
    supabaseFetch(`/rest/v1/agent_outputs?id=eq.${encodeURIComponent(waCtx.outputId)}`, {
      method: 'PATCH', data: { status: 'dipakai' },
    }).catch(() => {});
  }
  if (c.status === 'belum') {
    patchContact(c.id, {
      status: 'terkirim',
      sent_count: (Number(c.sent_count) || 0) + 1,
      last_contact_at: new Date().toISOString()
    });
  } else {
    patchContact(c.id, {
      sent_count: (Number(c.sent_count) || 0) + 1,
      last_contact_at: new Date().toISOString()
    });
  }
  waCtx = null;
  closeOutreachDetail();
};

/* ================= Sheet detail ================= */

let noteSaveTimer = null;

window.openOutreachDetail = function (id) {
  const c = contacts.find((x) => x.id === id);
  if (!c) return;
  detailId = id;
  renderSheetBody(c);
  openSheet('sheetOutreachDetail'); // reset inline display:none bekas closeSheet
};

window.closeOutreachDetail = function () {
  flushOutreachNote();
  detailId = null;
  closeSheet('sheetOutreachDetail');
};

/** Simpan catatan tertunda (dipanggil saat sheet ditutup) */
function flushOutreachNote() {
  if (noteSaveTimer) { clearTimeout(noteSaveTimer); noteSaveTimer = null; }
  if (!detailId) return;
  const val = (document.getElementById('outreachNoteInput')?.value || '').trim();
  const c = contacts.find((x) => x.id === detailId);
  if (c && val !== (c.catatan || '').trim()) patchContact(detailId, { catatan: val });
}

function renderSheetBody(c) {
  if (!c) { closeOutreachDetail(); return; }
  const esc = escapeHtml;
  const sm = stageMeta(c.status);
  const parts = (c.nama || '?').replace(/^@/, '').split(/\s+/).filter(Boolean);
  const ini = ((parts[0]?.[0] || '?') + (parts[1]?.[0] || '')).toUpperCase();
  const tone = AVA_TONE[c.kategori] || 'gray';

  document.getElementById('outreachDetailBody').innerHTML = `
    <div class="oc-sh">
      <div class="oc-ava oc-ava--lg oc-ava--${tone}" aria-hidden="true">${esc(ini)}</div>
      <div class="oc-sh-id">
        <div class="oc-sh-name">${esc(c.nama)}</div>
        <div class="oc-sub"><span class="mono">${esc(c.nomor_wa)}</span></div>
      </div>
      <span class="badge ${sm.tone}">${esc(sm.short)}</span>
    </div>
    ${c.alamat ? `<div class="oc-sh-meta">${esc(c.alamat)}</div>` : ''}
    <div class="oc-sh-stats">
      <div class="oc-sh-stat"><span class="oc-sh-sl">Kategori</span><span class="oc-sh-sv">${esc(c.kategori || '—')}</span></div>
      <div class="oc-sh-stat"><span class="oc-sh-sl">Terakhir</span><span class="oc-sh-sv">${c.last_contact_at ? esc(formatRelativeTime(c.last_contact_at)) : 'Belum pernah'}</span></div>
      <div class="oc-sh-stat"><span class="oc-sh-sl">Dikirim</span><span class="oc-sh-sv">${Number(c.sent_count) || 0}×</span></div>
    </div>
    <div class="field">
      <span class="field-label">Status — tap untuk ganti</span>
      <div class="oc-seg" role="group" aria-label="Status kontak">
        ${OUTREACH_STAGES.map((s) => `
          <button type="button" class="oc-seg-b ${c.status === s.key ? 'on' : ''}" data-tone="${s.tone}"
            aria-pressed="${c.status === s.key}" onclick="quickOutreachStage('${esc(c.id)}','${s.key}')">
            <i aria-hidden="true"></i>${esc(s.short)}
          </button>`).join('')}
      </div>
    </div>
    <div class="field">
      <label class="field-label" for="outreachNoteInput">Catatan <span class="oc-note-hint" id="outreachNoteHint"></span></label>
      <textarea id="outreachNoteInput" rows="3" placeholder="Contoh: minat, minta info harga; pelanggan software lama 2020">${esc(c.catatan || '')}</textarea>
    </div>
    <div class="field">
      <label class="field-label" for="outreachWaText">Pesan WhatsApp <span class="oc-note-hint" id="outreachWaHint"></span></label>
      <textarea id="outreachWaText" rows="6" placeholder="Pesan — generate template atau tulis manual"></textarea>
      <div class="oc-wa-tools">
        <button type="button" class="btn btn-outline btn-sm" onclick="regenerateOutreachWa()">↻ Generate ulang</button>
        <button type="button" class="btn btn-ghost btn-sm" onclick="resetOutreachWa()">↺ Kembalikan</button>
      </div>
      <p class="oc-wa-note">WhatsApp terbuka dengan pesan sudah terisi — tinggal tekan kirim di sana. Kontak otomatis ditandai terkirim.</p>
    </div>
    <div class="btn-block-row">
      <button type="button" class="btn btn-outline" onclick="closeOutreachDetail()">Tutup</button>
      <button type="button" class="btn btn-primary" onclick="sendOutreachWa()">💬 Kirim via WhatsApp</button>
    </div>
  `;

  // Komposer WA: template/draft AI disetujui terisi otomatis saat sheet terbuka
  isiComposerWa(c);

  // Edit manual menandai composer dirty — prefill async tidak menimpanya
  document.getElementById('outreachWaText')?.addEventListener('input', () => {
    if (waCtx) waCtx.dirty = true;
  });

  // Catatan auto-save: debounce saat mengetik + langsung saat pindah fokus
  const noteEl = document.getElementById('outreachNoteInput');
  noteEl?.addEventListener('input', () => {
    const hint = document.getElementById('outreachNoteHint');
    if (hint) hint.textContent = '…';
    if (noteSaveTimer) clearTimeout(noteSaveTimer);
    noteSaveTimer = setTimeout(saveOutreachNote, 700);
  });
  noteEl?.addEventListener('blur', saveOutreachNote);
}

/** Auto-save catatan (debounce/blur) — indikator kecil di label */
window.saveOutreachNote = function () {
  if (noteSaveTimer) { clearTimeout(noteSaveTimer); noteSaveTimer = null; }
  if (!detailId) return;
  const val = (document.getElementById('outreachNoteInput')?.value || '').trim();
  const c = contacts.find((x) => x.id === detailId);
  if (!c || val === (c.catatan || '').trim()) return;
  patchContact(detailId, { catatan: val });
  const hint = document.getElementById('outreachNoteHint');
  if (hint) hint.textContent = '✓ tersimpan';
};

/* ================= Impor CSV ================= */

window.importOutreachCsvClick = function () {
  document.getElementById('outreachImportFile')?.click();
};

/** Parser CSV sederhana — dukung field berkutip ("a,b") & kutip-ganda ("") */
function parseCsv(text) {
  const rows = [];
  let row = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(field); rows.push(row); row = []; field = '';
    } else field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim()));
}

/** Normalisasi nomor Indonesia → 628xxxxxxxxxx, null bila bukan nomor HP.
 *  WAJIB prefix 628 — nomor darat (0271…, 021…) bukan target WA dan tidak
 *  boleh lolos sebagai kontak. */
function normalizeImportPhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = '62' + d.slice(1);
  else if (d.startsWith('8')) d = '62' + d;
  if (!/^628\d{8,12}$/.test(d)) return null;
  return d;
}

/** Kategori kasar dari nama usaha — cukup utk filter & warna avatar */
function deriveKategori(nama) {
  const n = (nama || '').toLowerCase();
  if (/(warung|bakso|soto|ayam|mie|coffe|coffee|resto|cafe|kafe|makan|nasi|steak|burger|frozen|minum|susu|kedai|burjo|geprek|pizza)/.test(n)) return 'Kuliner';
  if (/(laundry|car ?wash|carwash|cuci|salon|barber|autocare|detailing|bengkel)/.test(n)) return 'Jasa & Bengkel';
  if (/(pet|petshop)/.test(n)) return 'Petshop';
  if (/(toko|market|mart|swalayan|grosir|toserba|cell|hijab|baju|plastik|sembako|elektrik|electric|koleksi|collec|fashion|boutique|shop|store|butiq|butik|kosmetik|glow)/.test(n)) return 'Toko & Retail';
  return null;
}

async function onImportFile(e) {
  const file = e.target?.files?.[0];
  if (!file) return;
  e.target.value = ''; // reset supaya file sama bisa diimpor ulang
  try {
    const text = (await file.text()).replace(/^\uFEFF/, '');
    const rows = parseCsv(text);
    if (!rows.length) { showToast('CSV kosong', 2000, 'error'); return; }

    // Deteksi header: cari kolom nama & nomor dari baris pertama
    const head = rows[0].map((h) => h.trim().toLowerCase());
    const idx = (names) => head.findIndex((h) => names.includes(h));
    let iNama = idx(['nama', 'nama usaha', 'klien', 'pelanggan', 'outlet']);
    let iNomor = idx(['nomor', 'nomor wa', 'no wa', 'nomor hp', 'no hp', 'kontak', 'telp', 'telepon', 'phone']);
    let iAlamat = idx(['alamat', 'address']);
    if (iNama < 0 || iNomor < 0) {
      // tanpa header yang jelas → asumsi pola file bersih: nama,alamat,jenis,nomor
      iNama = 0; iAlamat = 1; iNomor = 3;
    }

    const seen = new Set();
    const payload = [];
    let skipped = 0;
    for (const r of rows.slice(1)) {
      const nama = String(r[iNama] || '').trim();
      const nomor = normalizeImportPhone(r[iNomor]);
      if (!nama || !nomor) { skipped++; continue; }
      if (seen.has(nomor)) { skipped++; continue; }
      seen.add(nomor);
      payload.push({
        nama,
        alamat: String(r[iAlamat] || '').trim() || null,
        kategori: deriveKategori(nama),
        nomor_wa: nomor,
        source: 'klien_lama'
      });
    }
    if (!payload.length) { showToast(`Tidak ada kontak valid (${skipped} dilewati)`, 2600, 'error'); return; }

    // Insert batch — ignore-duplicates: impor ulang TIDAK menimpa status kampanye
    let inserted = 0;
    for (let i = 0; i < payload.length; i += 100) {
      const batch = payload.slice(i, i + 100);
      const res = await supabaseFetch('/rest/v1/outreach_contacts?on_conflict=nomor_wa', {
        method: 'POST',
        data: batch,
        headers: { Prefer: 'resolution=ignore-duplicates,return=representation' }
      });
      if (!res.ok) throw new Error('HTTP ' + res.status + ' — batch ' + (i / 100 + 1));
      inserted += (res.data || []).length;
    }
    showToast(`Impor selesai: ${inserted} baru, ${payload.length - inserted} sudah ada, ${skipped} dilewati`, 4000, 'success');
    await loadOutreach();
  } catch (err) {
    console.error('[impor CSV]', err);
    showToast('Gagal impor CSV: ' + (err.message || 'unknown'), 3500, 'error');
  }
}

/* ================= Ekspor CSV ================= */

window.exportOutreachCsv = function () {
  const rows = filteredContacts();
  if (!rows.length) { showToast('Tidak ada data untuk diekspor', 2000, 'info'); return; }
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = ['nama,alamat,kategori,nomor_wa,status,terakhir_kontak,total_dikirim,catatan']
    .concat(rows.map((c) => [
      q(c.nama), q(c.alamat), q(c.kategori), c.nomor_wa, c.status,
      c.last_contact_at || '', Number(c.sent_count) || 0, q(c.catatan)
    ].join(','))).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `outreach-klien-lama-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
};
