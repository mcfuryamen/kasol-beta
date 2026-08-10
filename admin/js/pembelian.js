/**
 * Admin Marketing KASIRSOLO — Pembelian Module
 * Mengelola pembelian lisensi: list, verifikasi, dan aktivasi otomatis.
 */

import { showToast } from './toast.js';
import { escapeHtml, formatDate } from './utils.js';
import { STATE, setState } from './app-state.js';
import { supabaseFetch } from './api.js';

let pembelian = [];
let currentPembelian = null;

/** Init module */
export async function initPembelian() {
  // Filter
  document.getElementById('pembelianStatusFilter')?.addEventListener('change', renderPembelianList);
  document.getElementById('refreshPembelianBtn')?.addEventListener('click', loadPembelian);

  // Tab switch event
  window.addEventListener('screen:change', (e) => {
    if (e.detail?.screen === 'klien') {
      const tab = document.querySelector('.tab-btn.active')?.dataset.tab || 'outlet';
      if (tab === 'pembelian') loadPembelian();
    }
  });

  await loadPembelian();
}

/** Load semua pembelian dari Supabase */
async function loadPembelian() {
  try {
    const res = await supabaseFetch('/rest/v1/pembelian?order=created_at.desc&limit=100');
    pembelian = res.ok ? (res.data || []) : [];
  } catch (e) {
    pembelian = [];
    console.error('load pembelian', e);
  }
  renderPembelianList();
}

/** Render list pembelian */
function renderPembelianList() {
  const host = document.getElementById('pembelianList');
  const empty = document.getElementById('pembelianEmpty');
  const filter = document.getElementById('pembelianStatusFilter')?.value || '';
  
  if (!host) return;

  const filtered = pembelian.filter(p => {
    if (!filter) return true;
    return p.status === filter;
  });

  if (empty) empty.hidden = filtered.length > 0;
  
  if (filtered.length === 0) {
    host.innerHTML = '';
    return;
  }

  host.innerHTML = filtered.map((p, i) => pembelianCardHtml(p, i)).join('');
  
  // Bind events
  host.querySelectorAll('.btn-verify').forEach(btn => {
    btn.addEventListener('click', () => verifyPembelian(btn.dataset.id));
  });
  host.querySelectorAll('.btn-activate').forEach(btn => {
    btn.addEventListener('click', () => activatePembelian(btn.dataset.id));
  });
  host.querySelectorAll('.btn-reject').forEach(btn => {
    btn.addEventListener('click', () => rejectPembelian(btn.dataset.id));
  });
  host.querySelectorAll('.btn-view-bukti').forEach(btn => {
    btn.addEventListener('click', () => viewBukti(btn.dataset.url));
  });
}

/** HTML untuk card pembelian */
function pembelianCardHtml(p, i) {
  const statusBadge = getStatusBadge(p.status);
  const buktiBtn = p.bukti_url 
    ? `<button class="btn btn-ghost btn-sm btn-view-bukti" data-url="${escapeHtml(p.bukti_url)}">👁️ Lihat Bukti</button>`
    : '<span class="hint">Belum ada bukti</span>';
  
  const actionBtns = getActionButtons(p);

  return `
    <div class="pembelian-card" data-index="${i}">
      <div class="pembelian-header">
        <div class="pembelian-info">
          <strong>${escapeHtml(p.unit_id || '—')}</strong>
          <span class="pembelian-meta">${escapeHtml(p.app_type || '?')} · ${formatDate(p.created_at)}</span>
        </div>
        ${statusBadge}
      </div>
      <div class="pembelian-body">
        <div class="pembelian-row">
          <span class="label">Harga:</span>
          <span class="value">${p.harga ? 'Rp ' + Number(p.harga).toLocaleString('id-ID') : '—'}</span>
        </div>
        <div class="pembelian-row">
          <span class="label">Serial:</span>
          <span class="value mono">${escapeHtml(p.serial || '—')}</span>
        </div>
        <div class="pembelian-row">
          <span class="label">Bukti:</span>
          <span>${buktiBtn}</span>
        </div>
      </div>
      <div class="pembelian-actions">
        ${actionBtns}
      </div>
    </div>
  `;
}

/** Status badge */
function getStatusBadge(status) {
  const map = {
    'menunggu_verifikasi': { text: '⏳ Menunggu', class: 'warning' },
    'aktif': { text: '✅ Aktif', class: 'success' },
    'ditolak': { text: '❌ Ditolak', class: 'error' }
  };
  const cfg = map[status] || { text: status, class: '' };
  return `<span class="badge ${cfg.class}">${cfg.text}</span>`;
}

/** Action buttons berdasarkan status */
function getActionButtons(p) {
  if (p.status === 'menunggu_verifikasi') {
    return `
      <button class="btn btn-primary btn-sm btn-verify" data-id="${escapeHtml(p.id)}">✓ Verifikasi</button>
      <button class="btn btn-danger btn-sm btn-reject" data-id="${escapeHtml(p.id)}">✗ Tolak</button>
    `;
  }
  if (p.status === 'aktif') {
    return `<button class="btn btn-ghost btn-sm" disabled>Aktif</button>`;
  }
  return '';
}

/** Verifikasi pembelian */
async function verifyPembelian(id) {
  try {
    const res = await supabaseFetch(`/rest/v1/pembelian?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      data: {
        status: 'verified',
        verified_at: new Date().toISOString()
      },
      headers: { Prefer: 'return=representation' }
    });
    
    if (!res.ok) throw new Error('Failed to verify');
    
    showToast('✅ Pembelian diverifikasi!', 2000, 'success');
    await loadPembelian();
  } catch (e) {
    console.error(e);
    showToast('Gagal memverifikasi', 2000, 'error');
  }
}

/** Aktifkan lisensi via Edge Function */
async function activatePembelian(id) {
  const p = pembelian.find(x => x.id === id);
  if (!p) return;

  showToast('⏳ Mengaktifkan lisensi...', 3000, 'info');
  
  try {
    // Call edge function via proxy (service key server-side)
    const res = await supabaseFetch('/functions/v1/activate-license', {
      method: 'POST',
      data: {
        unit_id: p.unit_id,
        app_type: p.app_type,
        device_code: p.device_code || ''
      }
    });
    
    const data = res.data;
    
    if (!res.ok || !data?.ok) throw new Error((data && data.error) || 'Activation failed');
    
    showToast(`✅ Lisensi aktif! Serial: ${data.serial}`, 3000, 'success');
    await loadPembelian();
  } catch (e) {
    console.error(e);
    showToast('Gagal mengaktifkan: ' + e.message, 3000, 'error');
  }
}

/** Tolak pembelian */
async function rejectPembelian(id) {
  if (!confirm('Tolak pembelian ini? User akan diminta upload ulang bukti.')) return;
  
  try {
    const res = await supabaseFetch(`/rest/v1/pembelian?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      data: {
        status: 'ditolak',
        verified_at: new Date().toISOString()
      },
      headers: { Prefer: 'return=representation' }
    });
    
    if (!res.ok) throw new Error('Failed to reject');
    
    showToast('❌ Pembelian ditolak', 2000, 'warning');
    await loadPembelian();
  } catch (e) {
    console.error(e);
    showToast('Gagal menolak', 2000, 'error');
  }
}

/** Preview bukti pembayaran */
function viewBukti(url) {
  if (!url) return;
  window.open(url, '_blank');
}
