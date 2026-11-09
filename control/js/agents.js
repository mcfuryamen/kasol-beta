/**
 * Control Center Kasir Solo — Agent AI (Konfigurasi Karakter & Provider)
 * =============================================================================
 * Halaman Agent = pusat kendali agent AI, 2 tab:
 *   - Tab 🤖 AGENTS: tambah / edit / hapus agent. Tiap agent = profil pekerja
 *     (nama, target perkenalan|followup, model, arahan khusus, variasi,
 *     aktif/nonaktif) — tersimpan di Supabase `settings` key `agents` agar
 *     terbaca runner dari PC mana pun. Agent tanpa model/arahan/variasi
 *     mewarisi nilai global (settings key `agent_config`).
 *   - Tab 🔌 PROVIDER: manajemen koneksi provider AI (multi-provider,
 *     OpenAI-compatible) — settings key `ai_providers`.
 *
 * Konfigurasi global `agent_config` (arahan/model/follow-up) tetap dipakai
 * sebagai fallback data — panel editnya dihapus dari UI; nilainya hanya
 * bisa diubah via Supabase.
 *
 * Draft hasil AI TIDAK dikelola di sini — dikonsumsi lewat komposer WA di
 * sheet detail kontak (control/js/outreach.js), alur satu pintu.
 *
 * Akses: semua data lewat supabaseFetch() → /api/rest (proxy server-side).
 * Tabel konfigurasi: settings (agent_config, agents, ai_providers).
 */

import { showToast } from './toast.js';
import { escapeHtml } from './utils.js';
import { supabaseFetch, controlApi } from './api.js';

let cfg = null;   // settings.agent_config (nilai global)
let agents = [];  // settings.agents — daftar profil agent
let providers = []; // settings.ai_providers — koneksi provider AI (OpenAI-compatible)
let editAgent = null; // null = daftar; { id|null } = form tambah/edit
let editProv = null;  // null = daftar; { id|null } = form tambah/edit provider
let editorModels = []; // model yang tersedia/terpilih pada editor provider
let editorFallback = '';
let editorExistingApiKey = '';

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

const AGENT_TABS = ['agents', 'provider'];
let activeTab = 'agents'; // tab halaman Agent yang sedang terbuka

export function initAgents() {
  // Tab halaman: Agents | Provider (pola sama dgn Grow Up)
  document.querySelectorAll('#agentTabs .content-tab').forEach((btn) => {
    btn.addEventListener('click', () => window.setAgentTab(btn.dataset.atab));
  });
  // Tombol ⟳ topbar (app.js) memanggil window.refreshAgents
  window.refreshAgents = () => loadAgents();
  window.addEventListener('screen:change', (e) => {
    if (e.detail?.screen === 'agents') loadAgents();
  });
  loadAgents();
}

/** Ganti tab halaman Agent (dipanggil listener tab & deep-link) */
window.setAgentTab = function (tab) {
  if (!AGENT_TABS.includes(tab)) tab = activeTab;
  activeTab = tab;
  history.replaceState(null, '', '#agents?tab=' + tab);
  document.querySelectorAll('#agentTabs .content-tab').forEach((b) => {
    const on = b.dataset.atab === tab;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', String(on));
  });
  const viewAgents = document.getElementById('agentViewAgents');
  const viewProvider = document.getElementById('agentViewProvider');
  if (viewAgents) viewAgents.hidden = tab !== 'agents';
  if (viewProvider) viewProvider.hidden = tab !== 'provider';
};

async function loadAgents() {
  try {
    const s = await supabaseFetch('/rest/v1/settings?key=in.(agent_config,agents,ai_providers)&select=key,value');
    cfg = (s.ok ? s.data : []).find((r) => r.key === 'agent_config')?.value || null;
    const rawAgents = (s.ok ? s.data : []).find((r) => r.key === 'agents')?.value;
    // Agent dihapus semua → kembali ke daftar baku, jangan biarkan halaman buntu
    agents = rawAgents?.length ? rawAgents : [...AGENTS_BAKU];
    providers = (s.ok ? s.data : []).find((r) => r.key === 'ai_providers')?.value || [];
  } catch (e) {
    console.error('loadAgents', e);
    showToast('Gagal memuat data agent', 2200, 'error');
  }
  refreshModelDatalist();
  renderAgents();
  renderProviders();
}

/* ================= Panel Agents (tambah/edit/hapus) ================= */

function renderAgents() {
  const host = document.getElementById('agentListBody');
  if (!host) return;
  if (editAgent) return renderFormAgent(host);

  const baris = agents.map((a) => {
    const target = a.target === 'followup' ? 'Follow-up' : 'Perkenalan';
    return `
      <div class="oc-row ag-config-card" data-agent="${escapeHtml(a.id)}" role="button" tabindex="0" aria-label="Edit karakter ${escapeHtml(a.nama || a.id)}">
        <div class="oc-ava oc-ava--${a.aktif ? 'blue' : 'gray'}" title="${a.aktif ? 'Aktif' : 'Nonaktif'}">${escapeHtml((a.nama || '?').slice(0, 2).toUpperCase())}</div>
        <div class="oc-main">
          <div class="oc-name">${escapeHtml(a.nama)}${a.aktif ? '' : ' <span class="badge gray">Nonaktif</span>'}</div>
          <div class="oc-sub">${escapeHtml(target)} · ${escapeHtml(a.model || `model global (${cfgAktif().model})`)}${a.persona ? ' · ada karakter' : ''}${a.arahan ? ' · ada arahan khusus' : ''}</div>
        </div>
        <div class="oc-side ag-agent-aksi">
          <button type="button" class="btn btn-ghost btn-sm" onclick="editAgentForm('${escapeHtml(a.id)}')" title="Edit karakter agent">✎</button>
          <button type="button" class="btn btn-danger btn-sm" onclick="hapusAgent('${escapeHtml(a.id)}')" title="Hapus agent">🗑</button>
        </div>
      </div>`;
  }).join('');

  host.innerHTML = `
    ${baris || '<div class="empty-state"><div class="empty-t">Belum ada agent</div></div>'}
    <div class="btn-block-row">
      <button type="button" class="btn btn-outline" onclick="editAgentForm(null)">+ Tambah Agent</button>
    </div>`;
  host.querySelectorAll('[data-agent]').forEach((card) => {
    const open = (event) => {
      if (event.target.closest('button, input, select, textarea, a')) return;
      editAgentForm(card.dataset.agent);
    };
    card.addEventListener('click', open);
    card.addEventListener('keydown', (event) => {
      if ((event.key === 'Enter' || event.key === ' ') && event.target === card) {
        event.preventDefault();
        editAgentForm(card.dataset.agent);
      }
    });
  });
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
        <select id="agfModel" class="select">
          <option value="">Ikut model global (${escapeHtml(cfgAktif().model)})</option>
          ${modelOptions(a.model || '')}
        </select>
        <span class="hint">Pilih provider dan model yang sudah terdaftar di tab Provider.</span>
      </div>
      <div class="field">
        <label class="field-label" for="agfVariasi">Draft per kontak</label>
        <select id="agfVariasi" class="select">
          <option value=""${!a.variasi ? ' selected' : ''}>Ikut global (${Number(cfgAktif().variasi) || 1})</option>
          ${[1, 2, 3].map((n) => `<option value="${n}"${Number(a.variasi) === n ? ' selected' : ''}>${n}</option>`).join('')}
        </select>
      </div>
      <div class="field field-span-2">
        <label class="field-label" for="agfPersona">Karakter / persona agent</label>
        <input id="agfPersona" value="${escapeHtml(a.persona || '')}" placeholder="Contoh: konsultan penjualan yang hangat dan tidak memaksa">
        <span class="hint">Identitas dan gaya dasar agent yang dipakai modul saat memanggilnya.</span>
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
    persona: (document.getElementById('agfPersona')?.value || '').trim(),
    arahan: (document.getElementById('agfArahan')?.value || '').trim(),
    aktif: (document.getElementById('agfAktif')?.value || 'on') === 'on',
  };
  const modelRef = baru.model;
  if (modelRef.includes('::')) {
    const [providerId, modelId] = modelRef.split('::', 2);
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) { showToast(`Provider "${providerId}" tidak ditemukan`, 2400, 'warning'); return; }
    if (provider.aktif === false) { showToast(`Provider "${providerId}" sedang nonaktif`, 2400, 'warning'); return; }
    if (!modelId) { showToast('Model provider wajib diisi', 2200, 'warning'); return; }
  }
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
  if (!confirm(`Hapus karakter agent "${a.nama}"?`)) return;
  const daftar = agents.filter((x) => x.id !== id);
  try {
    const res = await supabaseFetch('/rest/v1/settings?on_conflict=key', {
      method: 'POST',
      data: [{ key: 'agents', value: daftar }],
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    showToast(`Agent "${a.nama}" dihapus`, 2200, 'success');
    loadAgents();
  } catch (e) {
    console.error('hapusAgent', e);
    showToast('Gagal menghapus agent', 2200, 'error');
  }
};

/* ================= Panel Koneksi Provider AI ================= */

/** Satu instance datalist model global (di body) — direres saat providers berubah */
function refreshModelDatalist() {
  document.getElementById('aiModelList')?.remove();
  const dl = document.createElement('datalist');
  dl.id = 'aiModelList';
  dl.innerHTML = providers.filter((p) => p.aktif !== false).flatMap((p) =>
    (p.models || []).map((m) =>
      `<option value="${escapeHtml(p.id)}::${escapeHtml(m)}">${escapeHtml(p.nama || p.id)}</option>`)).join('');
  document.body.appendChild(dl);
}

function renderProviders() {
  const host = document.getElementById('providerBody');
  if (!host) return;
  if (editProv) return renderFormProvider(host);

  const baris = providers.map((p) => `
    <div class="oc-row ag-config-card" data-provider="${escapeHtml(p.id)}" role="button" tabindex="0" aria-label="Edit provider ${escapeHtml(p.nama || p.id)}">
      <div class="oc-ava oc-ava--${p.aktif !== false ? 'blue' : 'gray'}" title="${p.aktif !== false ? 'Aktif' : 'Nonaktif'}">${escapeHtml((p.nama || p.id || '?').slice(0, 2).toUpperCase())}</div>
      <div class="oc-main">
        <div class="oc-name">${escapeHtml(p.nama || p.id)}${p.aktif !== false ? '' : ' <span class="badge gray">Nonaktif</span>'}${p.id === 'omniroute' ? ' <span class="badge gray">legacy</span>' : ''}</div>
        <div class="oc-sub"><span class="provider-list-id">${escapeHtml(p.id)}</span><span>${escapeHtml(p.baseUrl || 'Base URL belum diisi')}</span></div>
        <div class="provider-list-meta"><span>${(p.models || []).length} model dipilih</span>${p.fallbackModel ? `<span>Fallback: ${escapeHtml(p.fallbackModel)}</span>` : '<span>Fallback otomatis</span>'}</div>
      </div>
      <div class="oc-side">
        <button type="button" class="btn btn-outline btn-sm" onclick="testProvider('${escapeHtml(p.id)}')" title="Uji koneksi">🧪</button>
        <button type="button" class="btn btn-ghost btn-sm" onclick="editProviderForm('${escapeHtml(p.id)}')" title="Edit provider">✎</button>
        <button type="button" class="btn btn-danger btn-sm" onclick="hapusProvider('${escapeHtml(p.id)}')" title="Hapus provider">🗑</button>
      </div>
    </div>`).join('');

  host.innerHTML = `
    <div class="hint" style="margin:0 0 10px">Format model di agent/global: <b>providerid::model</b> — mis. <span class="mono">omniroute::kiro/claude-haiku-4.5</span>. String model lama tanpa <span class="mono">::</span> otomatis dianggap milik Omniroute. Semua provider harus OpenAI-compatible (<span class="mono">/chat/completions</span>).</div>
    ${baris || '<div class="empty-state"><div class="empty-t">Belum ada provider</div><div class="empty-d">Runner memakai Omniroute lokal bawaan sampai provider ditambahkan.</div></div>'}
    <div class="btn-block-row">
      <button type="button" class="btn btn-outline" onclick="editProviderForm(null)">+ Tambah Provider</button>
    </div>`;
  host.querySelectorAll('[data-provider]').forEach((card) => {
    const open = (event) => {
      if (event.target.closest('button, input, select, textarea, a')) return;
      editProviderForm(card.dataset.provider);
    };
    card.addEventListener('click', open);
    card.addEventListener('keydown', (event) => {
      if ((event.key === 'Enter' || event.key === ' ') && event.target === card) {
        event.preventDefault();
        editProviderForm(card.dataset.provider);
      }
    });
  });
}

window.editProviderForm = function (id) {
  editProv = { id: id || null };
  renderProviders();
  document.getElementById('providerBody')?.scrollIntoView({ block: 'nearest' });
};
window.editProviderBatal = function () {
  editProv = null;
  renderProviders();
};

function renderFormProvider(host) {
  const p = editProv.id ? providers.find((x) => x.id === editProv.id) || {} : {};
  editorModels = [...new Set((p.models || []).map(String).filter(Boolean))];
  editorFallback = p.fallbackModel || '';
  editorExistingApiKey = p.apiKey || '';
  const displayName = p.nama || 'Provider baru';
  const providerId = p.id || 'ID belum diset';
  host.innerHTML = `
    <div class="provider-editor">
      <div class="provider-editor-head">
        <div class="provider-editor-mark">🔌</div>
        <div class="provider-editor-title">
          <div class="eyebrow">KONFIGURASI PROVIDER</div>
          <h3>${escapeHtml(displayName)}</h3>
          <span>${escapeHtml(providerId)}</span>
        </div>
        <div class="provider-editor-status">
          <span class="status-dot"></span> Provider AI
        </div>
      </div>

      <div class="provider-editor-section">
        <div class="provider-section-title"><span>Identitas & koneksi</span><small>Alamat API dan credential provider</small></div>
        <div class="provider-field-grid">
          <div class="field">
            <label class="field-label" for="pfNama">Nama provider</label>
            <input id="pfNama" value="${escapeHtml(p.nama || '')}" placeholder="Contoh: OpenRouter">
          </div>
          <div class="field">
            <label class="field-label" for="pfId">ID provider</label>
            <input id="pfId" value="${escapeHtml(p.id || '')}" placeholder="contoh: openrouter" ${p.id ? 'readonly' : ''}>
            <span class="hint">Dipakai sebagai prefix model.</span>
          </div>
          <div class="field provider-field-wide">
            <label class="field-label" for="pfBase">Base URL API</label>
            <input id="pfBase" value="${escapeHtml(p.baseUrl || '')}" placeholder="https://api.provider.com/v1">
            <span class="hint">Path <span class="mono">/models</span> dan <span class="mono">/chat/completions</span> ditambahkan otomatis.</span>
          </div>
          <div class="field provider-field-wide">
            <label class="field-label" for="pfKey">API key</label>
            <input id="pfKey" type="password" value="" placeholder="${p.apiKey ? 'Credential tersimpan — isi untuk mengganti' : 'Masukkan API key provider'}">
            <span class="hint">Credential hanya dipakai untuk koneksi provider.</span>
          </div>
        </div>
      </div>

      <div class="provider-editor-section provider-model-section">
        <div class="provider-section-title"><span>Model yang tersedia</span><small>Pilih model yang boleh dipakai oleh Agent</small></div>
        <div class="provider-model-picker" id="pfModelPicker">
          <div class="provider-model-picker-head">
            <div><b>Model provider</b><span class="provider-model-count" id="pfModelStatus">${editorModels.length} dipilih</span></div>
            <div class="provider-model-actions"><button type="button" class="btn btn-ghost btn-sm" data-model-all>Pilih semua</button><button type="button" class="btn btn-ghost btn-sm" data-model-none>Reset</button></div>
          </div>
          <div class="provider-model-toolbar"><input type="search" id="pfModelSearch" placeholder="Cari nama model…" aria-label="Cari model provider"><button type="button" class="btn btn-outline btn-sm" onclick="discoverProviderModels()">↻ Ambil model</button></div>
          <div id="pfModelChoices">${renderModelChoices()}</div>
        </div>
        <span class="hint" id="pfDiscoveryStatus">Belum mengambil model dari provider.</span>
      </div>

      <div class="provider-editor-section provider-runtime-section">
        <div class="provider-section-title"><span>Runtime</span><small>Fallback digunakan saat model utama kosong</small></div>
        <div class="provider-runtime-grid">
          <div class="field">
            <label class="field-label" for="pfFallback">Model fallback</label>
            <select id="pfFallback" class="select">${renderFallbackOptions()}</select>
          </div>
          <div class="field">
            <label class="field-label" for="pfAktif">Status provider</label>
            <select id="pfAktif" class="select">
              <option value="on"${p.aktif !== false ? ' selected' : ''}>Aktif — tersedia untuk Agent</option>
              <option value="off"${p.aktif === false ? ' selected' : ''}>Nonaktif — dilewati runner</option>
            </select>
          </div>
        </div>
      </div>

      <div class="provider-editor-foot">
        <button type="button" class="btn btn-outline" onclick="testProviderForm()">🧪 Uji koneksi</button>
        <div class="provider-editor-foot-actions"><button type="button" class="btn btn-ghost" onclick="editProviderBatal()">Batal</button><button type="button" class="btn btn-primary" onclick="simpanProvider()">Simpan provider</button></div>
      </div>
    </div>`;
  bindModelPicker();
}

function modelOptions(current) {
  const refs = providers.filter((p) => p.aktif !== false).flatMap((p) => (p.models || []).map((m) => `${p.id}::${m}`));
  if (current && !refs.includes(current)) refs.unshift(current);
  return [...new Set(refs)].map((ref) => `<option value="${escapeHtml(ref)}"${ref === current ? ' selected' : ''}>${escapeHtml(ref)}</option>`).join('');
}

const slugProv = (s) =>
  String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'provider';

function renderModelChoices(discovered = []) {
  const all = [...new Set([...editorModels, ...discovered])];
  return all.length ? all.map((m) => `<label data-model-option data-model-name="${escapeHtml(m.toLowerCase())}"><input type="checkbox" value="${escapeHtml(m)}"${editorModels.includes(m) ? ' checked' : ''}> <span>${escapeHtml(m)}</span></label>`).join('') : '<span class="muted">Belum ada model. Klik Ambil model untuk mendeteksi.</span>';
}

function renderFallbackOptions() {
  const fallback = editorModels.includes(editorFallback) ? editorFallback : '';
  return `<option value="">Gunakan model pertama</option>${editorModels.map((m) => `<option value="${escapeHtml(m)}"${m === fallback ? ' selected' : ''}>${escapeHtml(m)}</option>`).join('')}`;
}

function syncModelPicker() {
  const choices = document.getElementById('pfModelChoices');
  if (!choices) return;
  editorModels = [...choices.querySelectorAll('input:checked')].map((input) => input.value);
  if (!editorModels.includes(editorFallback)) editorFallback = '';
  const status = document.getElementById('pfModelStatus');
  if (status) status.textContent = `${editorModels.length} dipilih`;
  const fallback = document.getElementById('pfFallback');
  if (fallback) fallback.innerHTML = renderFallbackOptions();
}

function bindModelPicker() {
  const choices = document.getElementById('pfModelChoices');
  choices?.addEventListener('change', (event) => {
    if (event.target.matches('input[type="checkbox"]')) syncModelPicker();
  });
  document.getElementById('pfFallback')?.addEventListener('change', (event) => { editorFallback = event.target.value; });
  document.getElementById('pfModelSearch')?.addEventListener('input', (event) => {
    const query = event.target.value.trim().toLowerCase();
    document.querySelectorAll('#pfModelChoices [data-model-option]').forEach((row) => { row.hidden = query && !row.dataset.modelName.includes(query); });
  });
  document.querySelector('[data-model-all]')?.addEventListener('click', () => { choices?.querySelectorAll('input').forEach((input) => { input.checked = true; }); syncModelPicker(); });
  document.querySelector('[data-model-none]')?.addEventListener('click', () => { choices?.querySelectorAll('input').forEach((input) => { input.checked = false; }); syncModelPicker(); });
}

window.discoverProviderModels = async function () {
  const baseUrl = (document.getElementById('pfBase')?.value || '').trim();
  const apiKey = (document.getElementById('pfKey')?.value || '').trim() || editorExistingApiKey;
  const status = document.getElementById('pfDiscoveryStatus');
  if (!/^https?:\/\//i.test(baseUrl)) { showToast('Isi Base URL provider dulu', 2200, 'warning'); return; }
  if (status) status.textContent = 'Mengambil daftar model…';
  try {
    const res = await controlApi('/api/ai-test', { baseUrl: normalizeProviderBase(baseUrl), apiKey, model: '' });
    const models = [...new Set((res.data?.models || []).map(String).filter(Boolean))];
    if (!res.data?.ok || !models.length) { if (status) status.textContent = res.data?.detail || 'Provider tidak mengembalikan model.'; showToast('Model provider tidak ditemukan', 2600, 'warning'); return; }
    const choices = document.getElementById('pfModelChoices');
    if (choices) { choices.innerHTML = renderModelChoices(models); bindModelPicker(); }
    if (status) status.textContent = `${models.length} model ditemukan. Centang model yang ingin dipakai.`;
  } catch (e) { console.error('discoverProviderModels', e); if (status) status.textContent = 'Gagal menghubungi endpoint model provider.'; showToast('Gagal mengambil model provider', 2600, 'error'); }
};

function normalizeProviderBase(value) {
  return String(value || '').replace(/\/(?:models|chat\/completions)\/?$/i, '').replace(/\/$/, '');
}

function bacaFormProvider() {
  const nama = (document.getElementById('pfNama')?.value || '').trim();
  const id = (document.getElementById('pfId')?.value || '').trim().toLowerCase();
  const baseUrl = normalizeProviderBase((document.getElementById('pfBase')?.value || '').trim());
  const models = [...editorModels];
  return {
    err: !nama ? 'Nama tampilan wajib diisi'
      : !id ? 'ID provider wajib diisi'
      : !/^https?:\/\//i.test(baseUrl) ? 'Base URL harus diawali http:// atau https://'
      : null,
    prov: {
      id, nama, baseUrl,
      apiKey: (document.getElementById('pfKey')?.value || '').trim() || editorExistingApiKey,
      models,
      fallbackModel: editorModels.includes(editorFallback) ? editorFallback : '',
      aktif: (document.getElementById('pfAktif')?.value || 'on') === 'on',
    },
  };
}

window.simpanProvider = async function () {
  const { err, prov } = bacaFormProvider();
  if (err) { showToast(err, 2200, 'warning'); return; }
  if (editProv.id) prov.id = editProv.id; // id lama dikunci readonly
  else if (providers.some((x) => x.id === prov.id)) { showToast(`ID "${prov.id}" sudah dipakai`, 2200, 'warning'); return; }
  const daftar = editProv.id
    ? providers.map((x) => (x.id === prov.id ? prov : x))
    : providers.concat([prov]);
  try {
    const res = await supabaseFetch('/rest/v1/settings?on_conflict=key', {
      method: 'POST',
      data: [{ key: 'ai_providers', value: daftar }],
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    showToast(`Provider "${prov.nama}" tersimpan`, 2200, 'success');
    editProv = null;
    loadAgents();
  } catch (e) {
    console.error('simpanProvider', e);
    showToast('Gagal menyimpan provider', 2200, 'error');
  }
};

window.hapusProvider = async function (id) {
  const p = providers.find((x) => x.id === id);
  if (!p) return;
  const prefix = id + '::';
  if (!confirm(`Hapus provider "${p.nama || id}"?\n\nModel di agent/global yang memakai provider ini otomatis dikosongkan (ikut global).`)) return;
  const daftar = providers.filter((x) => x.id !== id);

  // Auto-bersih referensi model provider yang dihapus — kosong = ikut global;
  // dulu dibiarkan menunjuk provider mati → semua task gagal diam-diam.
  let cfgBersih = null;
  let agenBersih = null;
  let nDibersihkan = 0;
  if ((cfg?.model || '').startsWith(prefix)) {
    cfgBersih = { ...cfg, model: '' };
    nDibersihkan++;
  }
  const agenKena = agents.filter((a) => (a.model || '').startsWith(prefix));
  if (agenKena.length) {
    agenBersih = agents.map((a) => agenKena.some((x) => x.id === a.id) ? { ...a, model: '' } : a);
    nDibersihkan += agenKena.length;
  }

  try {
    const res = await supabaseFetch('/rest/v1/settings?on_conflict=key', {
      method: 'POST',
      data: [
        { key: 'ai_providers', value: daftar },
        ...(cfgBersih ? [{ key: 'agent_config', value: cfgBersih }] : []),
        ...(agenBersih ? [{ key: 'agents', value: agenBersih }] : []),
      ],
      headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    if (cfgBersih) cfg = cfgBersih;
    if (agenBersih) agents = agenBersih;
    showToast(`Provider "${p.nama || id}" dihapus${nDibersihkan ? ` · ${nDibersihkan} model dirujuk ikut dikosongkan` : ''}`, 3000, 'success');
    loadAgents();
  } catch (e) {
    console.error('hapusProvider', e);
    showToast('Gagal menghapus provider', 2200, 'error');
  }
};

/** Uji koneksi — nilai form (saat edit) atau provider tersimpan (dari list) */
window.testProviderForm = async function () {
  const { prov } = bacaFormProvider();
  await ujiKoneksi(prov.baseUrl, prov.apiKey, prov.models[0] || prov.fallbackModel || '');
};
window.testProvider = async function (id) {
  const p = providers.find((x) => x.id === id);
  if (!p) return;
  await ujiKoneksi(p.baseUrl, p.apiKey, (p.models || [])[0] || p.fallbackModel || '');
};

async function ujiKoneksi(baseUrl, apiKey, model) {
  if (!baseUrl) { showToast('Base URL kosong', 2000, 'warning'); return; }
  showToast('🧪 Menguji koneksi…', 3000, 'info');
  try {
    const res = await controlApi('/api/ai-test', { baseUrl, apiKey, model });
    const d = res.data || {};
    if (d.ok) {
      const models = Array.isArray(d.models) && d.models.length ? ` · ${d.models.length} model` : '';
      showToast(`✅ Koneksi OK (${d.ms}ms${models})${d.reply ? ' · ' + d.reply : ''}`, 4000, 'success');
    } else {
      showToast(`❌ Gagal ${d.step || ''}: ${d.detail || 'HTTP ' + d.status} (${d.ms || '?'}ms)`, 4500, 'error');
    }
  } catch (e) {
    console.error('ujiKoneksi', e);
    showToast('Gagal menguji koneksi', 2500, 'error');
  }
}
