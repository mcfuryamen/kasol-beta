// ==================== DIAGNOSA SINKRONISASI (T29) ====================
// Panel per-langkah untuk menjawab: "perangkat online, kenapa profil tidak
// masuk ke server?" Setiap langkah diberi status ✅/⚠️/❌ + pesan asli,
// jadi kegagalan senyap (silent catch) jadi terbaca. Hasil bisa disalin
// dan dikirim ke admin via WhatsApp.
// Dipanggil dari Pengaturan → Data & Cadangan → 🩺 Diagnosa Sinkronisasi.

import { getSyncClientDebug, getSyncState, ensureSynced } from './sync.js';
import { getSupabaseClient } from './license.sync.js';
import { getUnitId, getDeviceCode } from './license.js';
import { escapeHtml } from './helpers.js';

const OK = 'ok', WARN = 'warn', FAIL = 'fail';
const ICON = { ok: '✅', warn: '⚠️', fail: '❌' };

function step(name, status, detail) {
  return { name, status, detail: String(detail ?? '') };
}

/**
 * Jalankan seluruh rantai pemeriksaan sinkronisasi secara berurutan.
 * Mengembalikan array langkah {name, status, detail} + ringkasan.
 */
export async function runSyncDiagnostics() {
  const steps = [];
  const dbg = getSyncClientDebug();

  steps.push(step('1. Skrip supabase.min.js termuat', dbg.globalLoaded ? OK : FAIL,
    dbg.globalLoaded ? 'window.supabase tersedia' : 'window.supabase TIDAK ada — skrip gagal dimuat. Muat ulang halaman; kalau tetap, versi app lama masih ter-cache.'));

  steps.push(step('2. Konfigurasi URL & kunci anon', (dbg.url && dbg.keyPresent && dbg.keyLooksReal) ? OK : FAIL,
    `URL: ${dbg.url || '—'} · kunci: ${!dbg.keyPresent ? 'tidak ada' : (dbg.keyLooksReal ? 'format benar' : 'masih placeholder')}`));

  steps.push(step('3. Koneksi internet', dbg.online ? OK : FAIL,
    dbg.online ? 'navigator.onLine = true' : 'Perangkat sedang offline.'));

  const sb = dbg.globalLoaded && dbg.url && dbg.keyLooksReal ? getSupabaseClient() : null;
  steps.push(step('4. Client Supabase siap', sb ? OK : FAIL,
    sb ? 'createClient berhasil' : 'Client tidak bisa dibuat (lihat langkah 1–2).'));

  let unitId = null;
  let deviceCode = null;
  if (sb) {
    try {
      unitId = await getUnitId();
      deviceCode = await getDeviceCode();
      steps.push(step('5. Identitas perangkat (lokal)', OK, `unit_id: ${unitId} · device_code: ${deviceCode}`));
    } catch (e) {
      steps.push(step('5. Identitas perangkat (lokal)', FAIL, 'Gagal membaca identitas dari IndexedDB: ' + (e?.message || e)));
    }

    // Sesi anonim
    try {
      const { data: sessData } = await sb.auth.getSession();
      const uid = sessData?.session?.user?.id;
      const metaUnit = sessData?.session?.user?.user_metadata?.unit_id;
      if (uid) {
        steps.push(step('6. Sesi anonim aktif', metaUnit === unitId ? OK : WARN,
          `uid: ${uid.slice(0, 8)}… · claim unit_id: ${metaUnit || 'belum ada'}${metaUnit !== unitId ? ' (akan diperbarui otomatis saat sync)' : ''}`));
      } else {
        steps.push(step('6. Sesi anonim aktif', WARN, 'Belum ada session — akan sign-in otomatis saat sync.'));
      }
    } catch (e) {
      steps.push(step('6. Sesi anonim aktif', FAIL, 'Gagal membaca session: ' + (e?.message || e)));
    }

    // RPC device_known
    try {
      if (deviceCode) {
        const { data, error } = await sb.rpc('device_known', {
          p_unit_id: unitId, p_device_code: deviceCode, p_app_type: 'kaki5'
        });
        if (error) steps.push(step('7. Klaim perangkat (RPC device_known)', FAIL, 'RPC error: ' + error.message));
        else steps.push(step('7. Klaim perangkat (RPC device_known)', data === true ? OK : WARN,
          data === true ? 'Perangkat dikenal server' : 'Server belum mengenal perangkat ini (baru) — normal untuk install pertama.'));
      }
    } catch (e) {
      steps.push(step('7. Klaim perangkat (RPC device_known)', FAIL, 'RPC gagal dijalankan: ' + (e?.message || e)));
    }

    // Baris clients sekarang
    try {
      const { data, error } = await sb.from('clients').select('unit_id, nama_warung, last_seen').eq('unit_id', unitId).maybeSingle();
      if (error) steps.push(step('8. Baris profil di server (sebelum sync)', FAIL, 'Select error: ' + error.message));
      else steps.push(step('8. Baris profil di server (sebelum sync)', data ? OK : WARN,
        data ? `Ada: ${data.nama_warung || '(tanpa nama)'} · last_seen ${data.last_seen || '—'}` : 'Belum ada baris untuk unit ini.'));
    } catch (e) {
      steps.push(step('8. Baris profil di server (sebelum sync)', FAIL, 'Select gagal: ' + (e?.message || e)));
    }
  }

  // Sinkron penuh (inti masalah: ini yang selama ini gagal senyap)
  try {
    const res = await ensureSynced({ force: true, silent: true });
    if (res.ok) {
      steps.push(step('9. UJI SYNC PENUH (force)', OK, 'Profil berhasil dikirim & terbaca kembali.'));
    } else if (res.reason === 'no-profile') {
      steps.push(step('9. UJI SYNC PENUH (force)', WARN, 'Dilewati: Nama Usaha belum diisi di profil.'));
    } else if (res.reason === 'offline') {
      steps.push(step('9. UJI SYNC PENUH (force)', FAIL, 'Dilewati: perangkat offline.'));
    } else if (res.reason === 'no-config') {
      steps.push(step('9. UJI SYNC PENUH (force)', FAIL, 'Dilewati: konfigurasi tidak lengkap (langkah 1–2).'));
    } else {
      steps.push(step('9. UJI SYNC PENUH (force)', FAIL, `Gagal di tahap "${res.stage}": ${res.error || 'tanpa pesan'}`));
    }
  } catch (e) {
    steps.push(step('9. UJI SYNC PENUH (force)', FAIL, 'Exception: ' + (e?.message || e)));
  }

  // Riwayat error lokal
  try {
    const st = await getSyncState();
    const errs = Array.isArray(st.recentErrors) ? st.recentErrors : [];
    steps.push(step('10. Riwayat kegagalan (lokal, 5 terakhir)',
      errs.length ? WARN : OK,
      errs.length
        ? errs.map(x => `[${x.stage}] ${x.message} (${x.at})`).join(' · ')
        : `Tidak ada. Status lokal: ${st.status}${st.syncedAt ? ' sejak ' + st.syncedAt : ''}`));
  } catch (e) {
    steps.push(step('10. Riwayat kegagalan (lokal)', WARN, 'Tidak terbaca: ' + (e?.message || e)));
  }

  const failed = steps.some(s => s.status === FAIL);
  return { steps, summary: failed ? 'ADA LANGKAH YANG GAGAL — salin hasil ini dan kirim ke admin.' : 'Semua langkah sehat.' };
}

function renderDiag(result) {
  const box = document.getElementById('syncDiagContent');
  if (!box) return;
  const rows = result.steps.map(s => `
    <div style="display:flex;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);align-items:flex-start">
      <div style="font-size:18px;flex-shrink:0">${ICON[s.status]}</div>
      <div style="min-width:0">
        <div style="font-weight:700;font-size:13.5px">${escapeHtml(s.name)}</div>
        <div style="font-size:12px;color:var(--text2);word-break:break-word;margin-top:2px">${escapeHtml(s.detail)}</div>
      </div>
    </div>`).join('');
  box.innerHTML = `
    <div style="font-size:13px;color:var(--text2);margin-bottom:8px">${escapeHtml(result.summary)}</div>
    ${rows}`;
}

function diagPlainText(result) {
  return '[Diagnosa Sinkronisasi kaki5 ' + new Date().toISOString() + ']\n' +
    result.steps.map(s => `${ICON[s.status]} ${s.name}\n    ${s.detail}`).join('\n') +
    '\n' + result.summary;
}

let _running = false;

export async function openSyncDiag() {
  const modal = document.getElementById('syncDiagModal');
  const box = document.getElementById('syncDiagContent');
  if (!modal || !box || _running) return;
  modal.classList.add('show');
  _running = true;
  box.innerHTML = '<div style="text-align:center;padding:24px;color:var(--text2);font-size:14px">⏳ Memeriksa 10 langkah sinkronisasi…</div>';
  try {
    const result = await runSyncDiagnostics();
    renderDiag(result);
    modal._diagResult = result;
  } catch (e) {
    box.innerHTML = '<div style="color:var(--red);font-size:13px;padding:12px">Diagnosa crash: ' + escapeHtml(String(e?.message || e)) + '</div>';
  } finally {
    _running = false;
  }
}

export async function copySyncDiag() {
  const modal = document.getElementById('syncDiagModal');
  const result = modal?._diagResult;
  if (!result) return;
  try {
    const text = diagPlainText(result);
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove();
    }
    const { showToast } = await import('./helpers.js');
    showToast('Hasil diagnosa disalin — tempel di WhatsApp admin.');
  } catch (e) {
    const { showToast } = await import('./helpers.js');
    showToast('Gagal menyalin — screenshot layar ini saja.', 'error');
  }
}

export function closeSyncDiag() {
  document.getElementById('syncDiagModal')?.classList.remove('show');
}
