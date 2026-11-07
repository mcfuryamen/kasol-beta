/**
 * Agent Draft Module — control/js/agent-draft.js
 * =============================================================================
 * Per-modul agent execution: drafting pesan contextual sesuai klien/prospek.
 *
 * Flow:
 *   1. User click "💬 Draft Pesan" di detail klien
 *   2. agentDraft(clientId) fetch:
 *      - Klien data (nama, status, pipeline stage, history)
 *      - Agent config tersimpan (model, persona, parameter)
 *   3. Call runner.mjs enqueue draft task → runner process → return 2 varian
 *   4. UI tampilkan varian → user pick → copy/send WA
 *
 * UI: memakai sheet eksisting #sheetAgentDraft di index.html (pola sheet
 * control) — dulu bikin modal sendiri (#agentDraftModal) sehingga dispatcher
 * closeAgentDraft di app.js menutup elemen yang salah. Kini satu UI saja.
 *
 * SECURITY: Semua request via /api/rest (service role key server-side)
 * =============================================================================
 */

import { supabaseFetch } from './api.js';
import { showToast } from './toast.js';
import { escapeHtml } from './utils.js';

let currentDraftClientId = null;

/**
 * Open drafting sheet — fetch klien + config, trigger AI draft
 */
export async function openAgentDraft(clientId) {
  currentDraftClientId = clientId;
  window.openSheet('sheetAgentDraft');
  renderDraftPanelLoading();

  try {
    // Fetch klien data
    const clientRes = await supabaseFetch(`/rest/v1/clients?id=eq.${encodeURIComponent(clientId)}&select=*&limit=1`);
    if (!clientRes.ok || !clientRes.data || !clientRes.data[0]) {
      showToast('Klien tidak ditemukan', 2500, 'error');
      closeAgentDraft();
      return;
    }
    const client = clientRes.data[0];

    // Fetch agent config
    const configRes = await supabaseFetch('/rest/v1/settings?key=eq.agent_config&select=value&limit=1');
    if (!configRes.ok || !configRes.data || !configRes.data[0]) {
      showToast('Agent config tidak tersimpan', 2500, 'error');
      closeAgentDraft();
      return;
    }
    const agentConfig = configRes.data[0].value || {};

    // Render drafting panel lalu trigger AI draft (UI sudah menampilkan loading)
    renderDraftPanel(client, agentConfig);
    draftAI(client, agentConfig);
  } catch (err) {
    console.error('[agent-draft] Error:', err);
    showToast(`Error: ${err.message}`, 2500, 'error');
    closeAgentDraft();
  }
}

/**
 * Call runner via agent task enqueue — generate 2 draft varian
 */
async function draftAI(client, config) {
  const draftBtn = document.querySelector('[data-draft-ai]');
  if (draftBtn) draftBtn.disabled = true;

  try {
    // Enqueue draft task ke runner
    const payload = {
      client_id: client.id,
      nama_usaha: client.nama_usaha || client.nama_warung || 'Klien',
      status: client.status || 'baru',
      app_type: client.app_type || 'retail',
      persona: config.persona || 'profesional', // dari agent_config
      model: config.model || '', // kosong → callAI pilih default provider aktif
      variasi: config.variasi || 2
    };

    const taskRes = await supabaseFetch('/rest/v1/agent_tasks', {
      method: 'POST',
      data: {
        agent: 'draft_klien',
        tipe: 'draft_pesan',
        status: 'pending',
        payload,
        created_at: new Date().toISOString()
      }
    });

    if (!taskRes.ok) {
      showToast('Gagal enqueue draft task', 2500, 'error');
      return;
    }

    const taskId = taskRes.data?.[0]?.id;
    if (!taskId) {
      showToast('Task ID tidak dikembalikan', 2500, 'error');
      return;
    }

    // Poll untuk hasil (max 30 detik)
    pollDraftResult(taskId, client);
  } catch (err) {
    console.error('[agent-draft] Draft AI error:', err);
    showToast(`Error draft: ${err.message}`, 2500, 'error');
  } finally {
    if (draftBtn) draftBtn.disabled = false;
  }
}

/**
 * Poll runner output — cek apakah sudah ada hasil
 */
async function pollDraftResult(taskId, client, attempt = 0) {
  const maxAttempts = 15; // 15 * 2s = 30 detik

  if (attempt >= maxAttempts) {
    showToast('Timeout menunggu draft AI', 2500, 'error');
    renderDraftLoadingDone();
    return;
  }

  await new Promise((r) => setTimeout(r, 2000));

  try {
    const outRes = await supabaseFetch(
      `/rest/v1/agent_outputs?ref_id=eq.${encodeURIComponent(taskId)}&select=isi,model,status&limit=2&order=created_at.desc`
    );

    if (!outRes.ok || !outRes.data || outRes.data.length === 0) {
      // Belum ada hasil, poll lagi
      pollDraftResult(taskId, client, attempt + 1);
      return;
    }

    // Ada hasil — extract varian
    const drafts = outRes.data;
    const varian = drafts.map((d) => ({
      text: String(d.isi || '').trim(),
      model: d.model || 'unknown'
    }));

    renderDraftResults(varian, client);
  } catch (err) {
    console.error('[agent-draft] Poll error:', err);
    showToast(`Error poll: ${err.message}`, 2500, 'error');
  }
}

function renderDraftPanelLoading() {
  const body = document.getElementById('draftDetailBody');
  if (!body) return;
  body.innerHTML = `
    <div class="agent-draft-panel" id="agentDraftPanel">
      <div id="draftLoadingContainer" style="display:block">
        <div class="adp-loading">
          <span>🔄 Memuat data klien & agent…</span>
        </div>
      </div>
      <div id="draftResultsContainer" style="display:none">
        <div class="adp-results"></div>
      </div>
    </div>
  `;
}

/**
 * Render drafting panel HTML (di dalam sheet eksisting #draftDetailBody)
 */
function renderDraftPanel(client, config) {
  const body = document.getElementById('draftDetailBody');
  if (!body) return;
  const nama = client.nama_usaha || client.nama_warung || 'Klien';
  const status = client.status || 'baru';
  document.getElementById('draftSheetTitle').textContent = `Draft Pesan — ${nama}`;
  body.innerHTML = `
    <div class="agent-draft-panel" id="agentDraftPanel">
      <div class="adp-head">
        <h4>💬 Draft Pesan — ${escapeHtml(nama)}</h4>
        <span class="adp-status" data-status="${escapeHtml(status)}">Status: ${escapeHtml(status)}</span>
      </div>

      <div class="adp-config">
        <div class="config-row">
          <span class="label">Model AI:</span>
          <span class="value">${escapeHtml(config.model || 'haiku')}</span>
        </div>
        <div class="config-row">
          <span class="label">Persona:</span>
          <span class="value">${escapeHtml(config.persona || 'profesional')}</span>
        </div>
      </div>

      <div id="draftResultsContainer" style="display:none">
        <div class="adp-results"></div>
      </div>

      <div id="draftLoadingContainer" style="display:block">
        <div class="adp-loading">
          <span>🔄 Generating drafts...</span>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render draft results (varian) — tiap varian diberi id varian_N agar tombol
 * Copy / Send WA bisa membaca teksnya (dulu id tak pernah dipasang → tombol mati)
 */
function renderDraftResults(varian, client) {
  const container = document.getElementById('draftResultsContainer');
  const loadingContainer = document.getElementById('draftLoadingContainer');
  const resultsDiv = container?.querySelector('.adp-results');

  if (!container || !resultsDiv) return;

  const phone = client.kontak_phone ? client.kontak_phone.replace(/\D/g, '') : '';

  let html = '<div class="adp-varian-list">';
  varian.forEach((v, idx) => {
    const varianId = `varian_${idx}`;
    html += `
      <div class="adp-varian" id="${varianId}">
        <div class="varian-header">
          <span class="varian-label">✏️ Varian ${idx + 1}</span>
          <span class="varian-model">${escapeHtml(v.model)}</span>
        </div>
        <div class="varian-text">${escapeHtml(v.text)}</div>
        <div class="varian-actions">
          <button type="button" class="btn btn-outline btn-sm" onclick="copyDraft('${varianId}')">📋 Copy</button>
          ${phone ? `<button type="button" class="btn btn-primary btn-sm" onclick="sendDraftWA('${varianId}','${phone}')">📱 Send WA</button>` : ''}
        </div>
      </div>
    `;
  });
  html += '</div>';

  resultsDiv.innerHTML = html;
  if (loadingContainer) loadingContainer.style.display = 'none';
  container.style.display = 'block';
}

/** Kosongkan indikator loading saat draft gagal/timeout (biar tidak muter terus) */
function renderDraftLoadingDone() {
  const loadingContainer = document.getElementById('draftLoadingContainer');
  if (loadingContainer) {
    loadingContainer.innerHTML = '<div class="adp-loading"><span>⚠️ Draft tidak tersedia. Coba lagi.</span></div>';
  }
}

/**
 * Close sheet draft — dipakai via import (clients.js/agent-draft-ui) &
 * dispatcher data-action di app.js; semuanya menutup sheet yang sama.
 */
export function closeAgentDraft() {
  currentDraftClientId = null;
  window.closeSheet('sheetAgentDraft');
}

/**
 * Global window functions
 */
window.openAgentDraft = openAgentDraft;
window.closeAgentDraft = closeAgentDraft;

window.copyDraft = function (varianId) {
  const text = document.getElementById(varianId)?.querySelector('.varian-text')?.textContent;
  if (text) {
    navigator.clipboard.writeText(text);
    showToast('✓ Copied to clipboard', 2000, 'success');
  }
};

window.sendDraftWA = function (varianId, phone) {
  const text = document.getElementById(varianId)?.querySelector('.varian-text')?.textContent;
  if (text && phone) {
    const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  }
};
