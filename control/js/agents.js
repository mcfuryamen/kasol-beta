/**
 * Control Center Kasir Solo — Agent AI (Kelola Agent, Konfigurasi & Antrean)
 * =============================================================================
 * Halaman Agent = pusat kendali agent AI:
 *   - 👥 AGENTS: tambah / edit / hapus agent. Tiap agent = profil pekerja
 *     (nama, target perkenalan|followup, model, arahan khusus, variasi,
 *     aktif/nonaktif) — tersimpan di Supabase `settings` key `agents` agar
 *     terbaca runner dari PC mana pun. Agent tanpa model/arahan/variasi
 *     mewarisi nilai global (settings key `agent_config`).
 *   - ⚙️ GLOBAL: arahan global (fallback semua agent) + follow-up otomatis
 *     (saklar seeder harian + ambang hari).
 *   - Antrean: statline + batal massal.
 *   - 🚀 Susun tugas per agent langsung dari browser (port logika seeder,
 *     dedupe idempotent sama dengan agent/enqueue-reaktivasi.mjs).
 *
 * Draft hasil AI TIDAK dikelola di sini — dikonsumsi lewat komposer WA di
 * sheet detail kontak (control/js/outreach.js), alur satu pintu.
 *
 * Akses: semua data lewat supabaseFetch() → /api/rest (proxy server-side).
 * Tabel: agent_tasks, agent_outputs, settings (RLS tanpa policy publik).
 */

import { showToast } from './toast.js';
import { escapeHtml } from './utils.js';
import { supabaseFetch } from './api.js';

let tasks = [];   // baris agent_tasks (statline antrean)
let outputs = []; // baris ringkas agent_outputs (statistik draft)
let cfg = null;   // settings.agent_config (nilai global)
let agents = [];  // settings.agents — daftar profil agent
let editAgent = null; // null = daftar; { id|null } = form tambah/edit
let stok = { belum: 0, followup: 0 }; // hitungan kandidat susun tugas
let heartbeat = null; // ISO settings.runner_heartbeat — bukti hidup runner
let susunBusy = false; // kunci anti dobel-klik susun tugas

const CFG_DEFAULT = {
  arahanGlobal: '',      // fallback arahan utk agent yang tidak punya sendiri
  model: 'auto/best-fast',
  variasi: 1,            // 1-3 draft alternatif per kontak
  followupAuto: true,    // seeder follow-up harian aktif?
  followupHari: 3,       // ambang hari sejak last_contact_at
};

/** Daftar tampil bila settings.agens masih kosong (belum pernah diedit) */
const AGENTS_BAKU = [
  { id: 'marketing', nama: 'Marketing', target: 'perkenalan', aktif: true },
];

const cfgAktif = () => ({ ...CFG_DEFAULT, ...(cfg || {}) });
const agentAktif = (id) => agents.find((a) => a.id === id);

export function initAgents() {
  window.addEventListener('screen:change', (e) => {
    if (e.detail?.screen === 'agents') loadAgents();
  });
  loadAgents();
}

async function loadAgents() {
  try {
    const [t, o, s] = await Promise.all([
      supabaseFetch('/rest/v1/agent_tasks?select=id,status,agent,tipe,payload&order=created_at.desc&limit=200'),
      supabaseFetch('/rest/v1/agent_outputs?select=ref_id,judul,status&order=created_at.desc&limit=500'),
      supabaseFetch('/rest/v1/settings?key=in.(agent_config,agents,runner_heartbeat)&select=key,value'),
    ]);
    tasks = t.ok ? (t.data || []) : [];
    outputs = o.ok ? (o.data || []) : [];
    cfg = (s.ok ? s.data : []).find((r) => r.key === 'agent_config')?.value || null;
    const rawAgents = (s.ok ? s.data : []).find((r) => r.key === 'agents')?.value;
    // Agent dihapus semua → kembali ke daftar baku, jangan biarkan halaman buntu
    agents = rawAgents?.length ? rawAgents : [...AGENTS_BAKU];
    heartbeat = (s.ok ? s.data : []).find((r) => r.key === 'runner_heartbeat')?.value?.at || null;
    await muatStok();
  } catch (e) {
    console.error('loadAgents', e);
    showToast('Gagal memuat data agent', 2200, 'error');
  }
  renderStatline();
  renderAgents();
  renderConfig();
}

/** Cutoff ISO utk ambang follow-up dari konfigurasi global */
function cutoffFollowup() {
  const n = Number(cfgAktif().followupHari) || 3;
  return new Date(Date.now() - n * 86_400_000).toISOString();
}

/** Kontak id sudah punya output draft Follow-up? (konvensi judul "Follow-up —") */
const sudahFollowup = (refId) =>
  outputs.some((o) => o.ref_id === refId && /^follow-up/i.test(o.judul || ''));

/** Hitungan kandidat susun tugas (ringan: hanya kolom id) */
async function muatStok() {
  try {
    const [b, k] = await Promise.all([
      supabaseFetch('/rest/v1/outreach_contacts?select=id&status=eq.belum&limit=1000'),
      supabaseFetch(`/rest/v1/outreach_contacts?select=id&status=in.(terkirim,bales)&sent_count=gt.0&last_contact_at=lte.${cutoffFollowup()}&limit=1000`),
    ]);
    stok.belum = b.data?.length || 0;
    stok.followup = (k.data || []).filter((x) => !sudahFollowup(x.id)).length;
  } catch { stok = { belum: 0, followup: 0 }; }
}

/* ================= Statline ================= */

function renderStatline() {
  const host = document.getElementById('agentStatline');
  if (!host) return;
  const pending = tasks.filter((t) => t.status === 'pending').length;
  const running = tasks.filter((t) => t.status === 'running').length;
  const batal = tasks.filter((t) => t.status === 'batal').length;
  const error = tasks.filter((t) => t.status === 'error').length;
  const siap = outputs.filter((o) => o.status === 'draft').length;
  const dipakai = outputs.filter((o) => o.status === 'dipakai').length;
  // Indikator runner lokal: hidup (umur heartbeat) / tidak terdeteksi
  const mnt = heartbeat ? Math.round((Date.now() - new Date(heartbeat).getTime()) / 60000) : 999;
  const runnerBadge = !heartbeat
    ? 'Runner <b>tidak terdeteksi</b> — jalankan agent/runner.mjs'
    : mnt <= 5
      ? `Runner <b>hidup</b>${mnt > 0 ? ` · ${mnt} mnt lalu` : ' · baru saja'}`
      : `Runner <b>stagnan ${mnt} mnt</b> — cek PC/watchdog`;
  host.innerHTML = `
    <span class="oc-stat-grup">⚙ Antrean <b>${pending}</b> tunda · <b>${running}</b> jalan${batal ? ` · <b>${batal}</b> batal` : ''}${error ? ` · <b>${error}</b> gagal` : ''}
      ${pending ? `<button type="button" class="btn btn-outline btn-sm ag-cancel-btn" onclick="cancelPendingAgentTasks()" title="Batalkan semua tugas pending">✕ Batalkan antrean</button>` : ''}</span>
    <span class="oc-stat-grup">✎ Draft <b>${siap}</b> siap di kontak · <b>${dipakai}</b> dipakai</span>
    <span class="oc-stat-grup">${heartbeat && mnt <= 5 ? '🟢' : '🔴'} ${runnerBadge}</span>`;
}

/** Batalkan semua tugas pending sekaligus — konfirmasi dulu, lalu PATCH massal */
window.cancelPendingAgentTasks = async function () {
  const n = tasks.filter((t) => t.status === 'pending').length;
  if (!n) { showToast('Tidak ada tugas pending', 1800, 'info'); return; }
  if (!confirm(`Batalkan ${n} tugas pending?`)) return;
  try {
    const res = await supabaseFetch('/rest/v1/agent_tasks?status=eq.pending', {
      method: 'PATCH',
      data: { status: 'batal' },
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    showToast(`${n} tugas pending dibatalkan`, 2200, 'success');
    loadAgents();
  } catch (e) {
    console.error('cancelPendingAgentTasks', e);
    showToast('Gagal membatalkan antrean', 2200, 'error');
  }
};

/* ================= Panel Agents (tambah/edit/hapus) ================= */

function renderAgents() {
  const host = document.getElementById('agentListBody');
  if (!host) return;
  if (editAgent) return renderFormAgent(host);

  const baris = agents.map((a) => {
    const target = a.target === 'followup'
      ? `Follow-up ≥ ${Number(cfgAktif().followupHari) || 3} hari · kandidat <b>${stok.followup}</b>`
      : `Perkenalan · stok <b>${stok.belum}</b>`;
    return `
      <div class="oc-row" data-agent="${escapeHtml(a.id)}">
        <div class="oc-ava oc-ava--${a.aktif ? 'blue' : 'gray'}" title="${a.aktif ? 'Aktif' : 'Nonaktif'}">${escapeHtml((a.nama || '?').slice(0, 2).toUpperCase())}</div>
        <div class="oc-main">
          <div class="oc-name">${escapeHtml(a.nama)}${a.aktif ? '' : ' <span class="badge gray">Nonaktif</span>'}</div>
          <div class="oc-sub">${escapeHtml(target)} · ${escapeHtml(a.model || `model global (${cfgAktif().model})`)}${a.arahan ? ' · ada arahan khusus' : ''}</div>
        </div>
        <div class="oc-side ag-agent-aksi">
          <input type="number" min="1" max="100" value="10" style="max-width:74px" aria-label="Jumlah tugas" id="agJml-${escapeHtml(a.id)}">
          <button type="button" class="btn btn-outline btn-sm" onclick="susunTugasAgent('${escapeHtml(a.id)}')" title="Susun tugas utk agent ini">🚀</button>
          <button type="button" class="btn btn-ghost btn-sm" onclick="editAgentForm('${escapeHtml(a.id)}')" title="Edit agent">✎</button>
          <button type="button" class="btn btn-danger btn-sm" onclick="hapusAgent('${escapeHtml(a.id)}')" title="Hapus agent">🗑</button>
        </div>
      </div>`;
  }).join('');

  host.innerHTML = `
    ${baris || '<div class="empty-state"><div class="empty-t">Belum ada agent</div></div>'}
    <div class="btn-block-row">
      <button type="button" class="btn btn-outline" onclick="editAgentForm(null)">+ Tambah Agent</button>
    </div>`;
}

window.editAgentForm = function (id) {
  editAgent = { id: id || null };
  renderAgents();
  host_scroll();
};
window.tambahAgentBatal = function () {
  editAgent = null;
  renderAgents();
};

function host_scroll() {
  document.getElementById('agentListBody')?.scrollIntoView({ block: 'nearest' });
}

function renderFormAgent(host) {
  const a = editAgent.id ? (agentAktif(editAgent.id) || {}) : {};
  host.innerHTML = `
    <div class="field-grid">
      <div class="field">
        <label class="field-label" for="agfNama">Nama agent *</label>
        <input id="agfNama" value="${escapeHtml(a.nama || '')}" placeholder="Contoh: Reaktivasi Klien Lama">
      </div>
      <div class="field">
        <label class="field-label" for="agfTarget">Target pekerjaan</label>
        <select id="agfTarget" class="select">
          <option value="perkenalan"${a.target !== 'followup' ? ' selected' : ''}>Perkenalan — kontak yang belum dihubungi</option>
          <option value="followup"${a.target === 'followup' ? ' selected' : ''}>Follow-up — kontak yang sudah dihubungi</option>
        </select>
      </div>
      <div class="field">
        <label class="field-label" for="agfModel">Model AI</label>
        <input id="agfModel" value="${escapeHtml(a.model || '')}" placeholder="Kosongkan = ikut global (${cfgAktif().model})">
      </div>
      <div class="field">
        <label class="field-label" for="agfVariasi">Draft per kontak</label>
        <select id="agfVariasi" class="select">
          <option value=""${!a.variasi ? ' selected' : ''}>Ikut global (${Number(cfgAktif().variasi) || 1})</option>
          ${[1, 2, 3].map((n) => `<option value="${n}"${Number(a.variasi) === n ? ' selected' : ''}>${n}</option>`).join('')}
        </select>
      </div>
      <div class="field field-span-2">
        <label class="field-label" for="agfArahan">Arahan khusus agent</label>
        <textarea id="agfArahan" rows="3" placeholder="Kosongkan = ikut arahan global. Contoh: sapa hangat sbg kenalan lama, tekankan bisa coba gratis dulu.">${escapeHtml(a.arahan || '')}</textarea>
      </div>
      <div class="field">
        <label class="field-label" for="agfAktif">Status</label>
        <select id="agfAktif" class="select">
          <option value="on"${a.aktif !== false ? ' selected' : ''}>Aktif</option>
          <option value="off"${a.aktif === false ? ' selected' : ''}>Nonaktif — tugas pending tidak diproses runner</option>
        </select>
      </div>
    </div>
    <div class="btn-block-row">
      <button type="button" class="btn btn-outline" onclick="tambahAgentBatal()">Batal</button>
      <button type="button" class="btn btn-primary" onclick="simpanAgent()">Simpan Agent</button>
    </div>`;
}

const slugId = (nama) =>
  String(nama).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'agent';

window.simpanAgent = async function () {
  const nama = (document.getElementById('agfNama')?.value || '').trim();
  if (!nama) { showToast('Nama agent wajib diisi', 2000, 'warning'); return; }
  const baru = {
    id: editAgent.id || `${slugId(nama)}-${Math.random().toString(36).slice(2, 6)}`,
    nama,
    target: document.getElementById('agfTarget')?.value || 'perkenalan',
    model: (document.getElementById('agfModel')?.value || '').trim(),
    variasi: parseInt(document.getElementById('agfVariasi')?.value, 10) || null,
    arahan: (document.getElementById('agfArahan')?.value || '').trim(),
    aktif: (document.getElementById('agfAktif')?.value || 'on') === 'on',
  };
  const daftar = agents.filter((x) => x.id !== baru.id).concat([baru]);
  try {
    const res = await supabaseFetch('/rest/v1/settings?on_conflict=key', {
      method: 'POST',
      data: [{ key: 'agents', value: daftar }],
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    showToast(`Agent "${nama}" tersimpan`, 2200, 'success');
    editAgent = null;
    loadAgents();
  } catch (e) {
    console.error('simpanAgent', e);
    showToast('Gagal menyimpan agent', 2200, 'error');
  }
};

window.hapusAgent = async function (id) {
  const a = agentAktif(id);
  if (!a) return;
  const pendingAda = tasks.some((t) => t.status === 'pending' && t.payload?.agent_id === id);
  if (!confirm(`Hapus agent "${a.nama}"?${pendingAda ? '\n\nTugas pending milik agent ini akan IKUT DIBATALKAN.' : ''}`)) return;
  const daftar = agents.filter((x) => x.id !== id);
  try {
    const res = await supabaseFetch('/rest/v1/settings?on_conflict=key', {
      method: 'POST',
      data: [{ key: 'agents', value: daftar }],
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    // Tugas pending milik agent yang dihapus ikut dibatalkan — jangan dibiarkan
    // dieksekusi runner tanpa profil (jatuh ke konfigurasi global secara diam).
    await supabaseFetch(`/rest/v1/agent_tasks?status=eq.pending&payload->>agent_id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH', data: { status: 'batal' },
    }).catch(() => {});
    showToast(`Agent "${a.nama}" dihapus`, 2200, 'success');
    loadAgents();
  } catch (e) {
    console.error('hapusAgent', e);
    showToast('Gagal menghapus agent', 2200, 'error');
  }
};

/* ================= Panel global & follow-up ================= */

function renderConfig() {
  const host = document.getElementById('agentConfigBody');
  if (!host) return;
  const c = cfgAktif();
  host.innerHTML = `
    <div class="field-grid">
      <div class="field field-span-2">
        <label class="field-label" for="agArahan">Arahan global (fallback semua agent)</label>
        <textarea id="agArahan" rows="2" placeholder="Dipakai agent yang tidak punya arahan khusus. Contoh: fokus dorong coba gratis, sebut bayar QRIS.">${escapeHtml(c.arahanGlobal || '')}</textarea>
        <span class="hint">Berlaku seketika ke draft berikutnya — tanpa perlu susun ulang tugas.</span>
      </div>
      <div class="field">
        <label class="field-label" for="agFollAuto">Follow-up otomatis (seeder harian)</label>
        <select id="agFollAuto" class="select">
          <option value="on"${c.followupAuto ? ' selected' : ''}>Aktif</option>
          <option value="off"${!c.followupAuto ? ' selected' : ''}>Nonaktif</option>
        </select>
      </div>
      <div class="field">
        <label class="field-label" for="agFollHari">Ambang follow-up (hari)</label>
        <input id="agFollHari" type="number" min="1" max="60" value="${Number(c.followupHari) || 3}">
      </div>
    </div>
    <div class="btn-block-row">
      <button type="button" class="btn btn-primary" onclick="saveAgentConfig()">Simpan Global</button>
    </div>`;
}

window.saveAgentConfig = async function () {
  const arahan = (document.getElementById('agArahan')?.value || '').trim();
  const followupAuto = (document.getElementById('agFollAuto')?.value || 'on') === 'on';
  const followupHari = Math.min(60, Math.max(1, parseInt(document.getElementById('agFollHari')?.value, 10) || 3));

  try {
    const res = await supabaseFetch('/rest/v1/settings?on_conflict=key', {
      method: 'POST',
      data: [{ key: 'agent_config', value: { ...cfgAktif(), arahanGlobal: arahan, followupAuto, followupHari } }],
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    cfg = { ...cfgAktif(), arahanGlobal: arahan, followupAuto, followupHari };
    showToast('Konfigurasi global tersimpan', 2200, 'success');
    muatStok(); // ambang berubah → hitungan kandidat follow-up ikut berubah
    renderAgents();
  } catch (e) {
    console.error('saveAgentConfig', e);
    showToast('Gagal menyimpan konfigurasi global', 2200, 'error');
  }
};

/* ================= Susun tugas per agent ================= */

/** Payload kontak utk task — snapshot field yang aman & berguna */
function payloadKontak(c) {
  return {
    nama: c.nama, kategori: c.kategori || 'usaha kecil', status: c.status, sent_count: c.sent_count || 0,
    ...(c.alamat ? { alamat: c.alamat } : {}),
    ...(c.catatan ? { catatan: c.catatan } : {}),
    ...(c.last_contact_at ? { last_contact_at: c.last_contact_at } : {}),
    ...(c.source ? { source: c.source } : {}),
  };
}

/** Susun tugas milik satu agent — target menentukan kandidat & tipe task.
 *  Port logika seeder (enqueue-reaktivasi / enqueue-followup) ke browser. */
window.susunTugasAgent = async function (id) {
  if (susunBusy) return; // anti dobel-klik
  const a = agentAktif(id);
  if (!a) return;
  if (a.aktif === false) { showToast('Agent nonaktif — aktifkan dulu', 2000, 'warning'); return; }
  susunBusy = true;
  const jumlah = Math.min(100, Math.max(1, parseInt(document.getElementById(`agJml-${id}`)?.value, 10) || 10));
  const foll = a.target === 'followup';
  try {
    const [k, o, t, prev] = await Promise.all([
      foll
        ? supabaseFetch(`/rest/v1/outreach_contacts?select=id,nama,kategori,status,sent_count,alamat,catatan,last_contact_at,source&status=in.(terkirim,bales)&sent_count=gt.0&last_contact_at=lte.${cutoffFollowup()}&order=last_contact_at.asc&limit=${jumlah * 3}`)
        : supabaseFetch(`/rest/v1/outreach_contacts?select=id,nama,kategori,status,sent_count,alamat,catatan,last_contact_at,source&status=eq.belum&order=sent_count.asc,updated_at.asc&limit=${jumlah * 3}`),
      supabaseFetch('/rest/v1/agent_outputs?select=ref_id,judul&ref_table=eq.outreach_contacts&order=created_at.desc&limit=1000'),
      supabaseFetch(`/rest/v1/agent_tasks?select=payload&agent=eq.marketing&tipe=eq.${foll ? 'followup_wa' : 'draft_wa'}&status=in.(pending,running)&limit=1000`),
      foll ? supabaseFetch('/rest/v1/agent_outputs?select=ref_id,isi&jenis=eq.draft_wa&ref_table=eq.outreach_contacts&status=in.(approved,dipakai)&order=created_at.asc&limit=1000') : Promise.resolve({ data: [] }),
    ]);
    const sudahOut = new Set((o.data || []).filter((x) => (foll ? /^follow-up/i.test(x.judul || '') : true) && x.ref_id).map((x) => x.ref_id));
    const sudahTask = new Set((t.data || []).map((x) => x.payload?.kontak_id).filter(Boolean));
    const pesanMap = new Map();
    for (const p of prev.data || []) if (p.ref_id && p.isi) pesanMap.set(p.ref_id, p.isi);
    const hariSejak = (iso) => Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000));
    const pilih = (k.data || []).filter((x) => !sudahOut.has(x.id) && !sudahTask.has(x.id)).slice(0, jumlah);
    if (!pilih.length) { showToast('Tidak ada kandidat untuk agent ini', 2000, 'info'); return; }
    if (!confirm(`Susun ${pilih.length} tugas utk agent "${a.nama}"?`)) return;
    const rows = pilih.map((c) => ({
      agent: 'marketing', // handler kode — identitas agent dibawa payload.agent_id
      tipe: foll ? 'followup_wa' : 'draft_wa', status: 'pending', priority: 5, max_attempts: 3,
      payload: {
        agent_id: a.id, kontak_id: c.id, kontak: payloadKontak(c),
        ...(foll && pesanMap.has(c.id) ? { pesan_sebelumnya: pesanMap.get(c.id) } : {}),
        ...(foll && c.last_contact_at ? { hari_lalu: hariSejak(c.last_contact_at) } : {}),
        ...(Number(a.variasi) > 1 ? { variasi: Number(a.variasi) } : {}),
      },
    }));
    let res = await supabaseFetch('/rest/v1/agent_tasks', { method: 'POST', data: rows });
    let ok = rows.length, dup = 0;
    if (!res.ok) {
      // Indeks unik agent_tasks_aktif_unik menolak batch yang mengandung
      // duplikat → susun ulang per baris; duplikat dilewati, sisanya tetap masuk.
      ok = 0;
      for (const row of rows) {
        try {
          const satu = await supabaseFetch('/rest/v1/agent_tasks', { method: 'POST', data: [row] });
          if (satu.ok) ok++; else dup++;
        } catch { dup++; }
      }
    }
    showToast(`${ok} tugas utk "${a.nama}" disusun${dup ? ` · ${dup} duplikat dilewati` : ''} — runner akan memproses`, 2600, 'success');
    loadAgents();
  } catch (e) {
    console.error('susunTugasAgent', e);
    showToast('Gagal menyusun tugas', 2200, 'error');
  } finally {
    susunBusy = false;
  }
};
