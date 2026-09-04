// ==================== DIAGNOSA SINKRONISASI (T29) ====================
// Panel per-langkah untuk menjawab: "perangkat online, kenapa profil tidak
// masuk ke server?" Setiap langkah diberi status ✅/⚠️/❌ + pesan asli,
// jadi kegagalan senyap (silent catch) jadi terbaca. Hasil bisa disalin
// dan dikirim ke admin via WhatsApp.
// Dipanggil dari Pengaturan → Data & Cadangan → "Cek Data Online".

import { getSyncClientDebug, getSyncState, ensureSynced } from './sync.js';
import { getSupabaseClient, reanchorUnitId } from './license.sync.js';
import { getUnitId, getDeviceCode } from './license.js';
import { escapeHtml } from './helpers.js';
import { openModal, closeModal } from './modal.js';

const OK = 'ok', WARN = 'warn', FAIL = 'fail';
const ICON = { ok: '✅', warn: '⚠️', fail: '❌' };

function step(name, status, detail, label) {
  // label = diksi klien (non-teknikal) yang tampil di layar; name+detail
  // tetap teknikal — dipakai saat hasil disalin ke admin via WhatsApp.
  return { name, status, detail: String(detail ?? ''), label: label || name };
}

/**
 * Jalankan seluruh rantai pemeriksaan sinkronisasi secara berurutan.
 * Mengembalikan array langkah {name, status, detail} + ringkasan.
 */
export async function runSyncDiagnostics() {
  const steps = [];
  const dbg = getSyncClientDebug();

  steps.push(step('1. Skrip supabase.min.js termuat', dbg.globalLoaded ? OK : FAIL,
    dbg.globalLoaded ? 'window.supabase tersedia' : 'window.supabase TIDAK ada — skrip gagal dimuat. Muat ulang halaman; kalau tetap, versi app lama masih ter-cache.',
    'Aplikasi siap terhubung'));

  steps.push(step('2. Konfigurasi URL & kunci anon', (dbg.url && dbg.keyPresent && dbg.keyLooksReal) ? OK : FAIL,
    `URL: ${dbg.url || '—'} · kunci: ${!dbg.keyPresent ? 'tidak ada' : (dbg.keyLooksReal ? 'format benar' : 'masih placeholder')}`,
    'Pengaturan server benar'));

  steps.push(step('3. Koneksi internet', dbg.online ? OK : FAIL,
    dbg.online ? 'navigator.onLine = true' : 'Perangkat sedang offline.',
    'Koneksi internet aktif'));

  const sb = dbg.globalLoaded && dbg.url && dbg.keyLooksReal ? getSupabaseClient() : null;
  steps.push(step('4. Client Supabase siap', sb ? OK : FAIL,
    sb ? 'createClient berhasil' : 'Client tidak bisa dibuat (lihat langkah 1–2).',
    'Jalur data ke server siap'));

  let unitId = null;
  let deviceCode = null;
  if (sb) {
    try {
      unitId = await getUnitId();
      deviceCode = await getDeviceCode();
      steps.push(step('5. Identitas perangkat (lokal)', OK, `unit_id: ${unitId} · device_code: ${deviceCode}`,
        `ID Perangkat: ${unitId || deviceCode || '—'}`));
    } catch (e) {
      steps.push(step('5. Identitas perangkat (lokal)', FAIL, 'Gagal membaca identitas dari IndexedDB: ' + (e?.message || e),
        'ID Perangkat belum terpasang'));
    }

    // Sesi anonim
    try {
      const { data: sessData } = await sb.auth.getSession();
      const uid = sessData?.session?.user?.id;
      const metaUnit = sessData?.session?.user?.user_metadata?.unit_id;
      if (uid) {
        steps.push(step('6. Sesi anonim aktif', metaUnit === unitId ? OK : WARN,
          `uid: ${uid.slice(0, 8)}… · claim unit_id: ${metaUnit || 'belum ada'}${metaUnit !== unitId ? ' (akan diperbarui otomatis saat sync)' : ''}`,
          'Koneksi aman untuk perangkat ini'));
      } else {
        steps.push(step('6. Sesi anonim aktif', WARN, 'Belum ada session — akan sign-in otomatis saat sync.',
          'Sesi akan dibuat otomatis saat data tersinkron'));
      }
    } catch (e) {
      steps.push(step('6. Sesi anonim aktif', FAIL, 'Gagal membaca session: ' + (e?.message || e),
        'Koneksi aman belum siap'));
    }

    // RPC device_known
    try {
      if (deviceCode) {
        const { data, error } = await sb.rpc('device_known', {
          p_unit_id: unitId, p_device_code: deviceCode, p_app_type: 'kaki5'
        });
        if (error) steps.push(step('7. Klaim perangkat (RPC device_known)', FAIL, 'RPC error: ' + error.message,
          'Perangkat belum dikenali server'));
        else steps.push(step('7. Klaim perangkat (RPC device_known)', data === true ? OK : WARN,
          data === true ? 'Perangkat dikenal server' : 'Server belum mengenal perangkat ini (baru) — normal untuk install pertama.',
          data === true ? 'Server mengenali perangkat ini' : 'Perangkat baru — server akan mengenalinya otomatis'));
      }
    } catch (e) {
      steps.push(step('7. Klaim perangkat (RPC device_known)', FAIL, 'RPC gagal dijalankan: ' + (e?.message || e),
        'Pemeriksaan perangkat gagal dijalankan'));
    }

    // Baris clients sekarang
    try {
      const { data, error } = await sb.from('clients').select('unit_id, nama_usaha, last_seen').eq('unit_id', unitId).maybeSingle();
      if (error) steps.push(step('8. Baris profil di server (sebelum sync)', FAIL, 'Select error: ' + error.message,
        'Profil usaha belum bisa diperiksa'));
      else steps.push(step('8. Baris profil di server (sebelum sync)', data ? OK : WARN,
        data ? `Ada: ${data.nama_usaha || '(tanpa nama)'} · last_seen ${data.last_seen || '—'}` : 'Belum ada baris untuk unit ini.',
        data ? `Profil usaha tersimpan: ${data.nama_usaha || '(tanpa nama)'}` : 'Profil usaha belum tersimpan di server'));
    } catch (e) {
      steps.push(step('8. Baris profil di server (sebelum sync)', FAIL, 'Select gagal: ' + (e?.message || e),
        'Profil usaha belum bisa diperiksa'));
    }
  }

  // Sinkron penuh (inti masalah: ini yang selama ini gagal senyap)
  try {
    const res = await ensureSynced({ force: true, silent: true });
    if (res.ok) {
      steps.push(step('9. UJI SYNC PENUH (force)', OK, 'Profil berhasil dikirim & terbaca kembali.',
        'Tes kirim & terima data: berhasil'));
    } else if (res.reason === 'no-profile') {
      steps.push(step('9. UJI SYNC PENUH (force)', WARN, 'Dilewati: Nama Usaha belum diisi di profil.',
        'Belum bisa dites — isi Nama Usaha dulu di profil'));
    } else if (res.reason === 'offline') {
      steps.push(step('9. UJI SYNC PENUH (force)', FAIL, 'Dilewati: perangkat offline.',
        'Belum bisa dites — perangkat sedang offline'));
    } else if (res.reason === 'no-config') {
      steps.push(step('9. UJI SYNC PENUH (force)', FAIL, 'Dilewati: konfigurasi tidak lengkap (langkah 1–2).',
        'Belum bisa dites — pengaturan server belum lengkap'));
    } else {
      steps.push(step('9. UJI SYNC PENUH (force)', FAIL, `Gagal di tahap "${res.stage}": ${res.error || 'tanpa pesan'}`,
        'Tes kirim & terima data: gagal'));
    }
  } catch (e) {
    steps.push(step('9. UJI SYNC PENUH (force)', FAIL, 'Exception: ' + (e?.message || e),
      'Tes kirim & terima data: gagal'));
  }

  // Riwayat error lokal
  try {
    const st = await getSyncState();
    const errs = Array.isArray(st.recentErrors) ? st.recentErrors : [];
    steps.push(step('10. Riwayat kegagalan (lokal, 5 terakhir)',
      errs.length ? WARN : OK,
      errs.length
        ? errs.map(x => `[${x.stage}] ${x.message} (${x.at})`).join(' · ')
        : `Tidak ada. Status lokal: ${st.status}${st.syncedAt ? ' sejak ' + st.syncedAt : ''}`,
      errs.length
        ? 'Ada catatan masalah sebelumnya — salin & kirim ke admin bila perlu bantuan'
        : 'Tidak ada masalah tersimpan — semua data sudah tersinkron'));
  } catch (e) {
    steps.push(step('10. Riwayat kegagalan (lokal)', WARN, 'Tidak terbaca: ' + (e?.message || e),
      'Riwayat masalah tidak bisa dibaca'));
  }

  // 11. Konsistensi identitas perangkat (re-anchor unit_id).
  // Dipanggil dengan force: langkah ini adalah satu-satunya jalur "coba lagi"
  // yang sah, karena boot normal sudah berhenti mengulang kondisi blokir
  // (lihat license.sync.js). Kalau user baru menyelaraskan Nama Usaha / No. WA
  // di profil, konvergensi terjadi di sini juga, bukan boot berikutnya.
  try {
    const res = await reanchorUnitId({ force: true });
    if (res.ok && (res.reason === 'migrated' || res.reason === 'adopted')) {
      steps.push(step('11. Konsistensi identitas perangkat', OK,
        `ID perangkat diselaraskan ke kanonik (${res.reason === 'migrated' ? 'baris lama dipindah' : 'baris kanonik diadopsi'}).`,
        'ID perangkat sudah diselaraskan'));
    } else if (res.ok) {
      steps.push(step('11. Konsistensi identitas perangkat', OK,
        `unit_id sudah kanonik (${res.reason || 'ok'}).`,
        'ID perangkat konsisten'));
    } else if (res.reason === 'serial-bound') {
      steps.push(step('11. Konsistensi identitas perangkat', OK,
        'Lisensi aktif terikat serial — ID perangkat memang tidak boleh pindah sendiri (butuh admin).',
        'ID perangkat terkunci lisensi (normal)'));
    } else if (res.reason === 'offline') {
      steps.push(step('11. Konsistensi identitas perangkat', WARN, 'Dilewati: perangkat offline.',
        'ID perangkat belum bisa diperiksa — sedang offline'));
    } else if (res.blocked) {
      const m = res.memo || {};
      const diff = Array.isArray(m.diff) && m.diff.length ? m.diff.join(', ') : 'tidak terdeteksi';
      steps.push(step('11. Konsistensi identitas perangkat', WARN,
        `Dua ID untuk perangkat ini: lokal ${m.from || '—'} vs kanonik ${m.to || '—'} — baris kanonik sudah dipakai profil dengan ${diff} berbeda. ID lama DIPERTAHANKAN, percobaan otomatis dihentikan sampai profil disamakan (atau admin menghapus salah satu baris).`,
        `Ada dua ID perangkat untuk usaha ini — data terbagi. Beda: ${diff}. Samakan Nama Usaha & No. WhatsApp di profil, lalu periksa ulang.`));
    } else {
      steps.push(step('11. Konsistensi identitas perangkat', WARN,
        `Pemeriksaan belum tuntas (${res.reason || 'tanpa alasan'}${res.error ? ': ' + res.error : ''}).`,
        'ID perangkat belum bisa dipastikan'));
    }
  } catch (e) {
    steps.push(step('11. Konsistensi identitas perangkat', WARN, 'Pemeriksaan gagal: ' + (e?.message || e),
      'ID perangkat belum bisa dipastikan'));
  }

  const failed = steps.some(s => s.status === FAIL);
  return { steps, summary: failed ? 'ADA MASALAH' : 'SEMUA BAIK' };
}

function renderDiag(result) {
  const box = document.getElementById('syncDiagContent');
  if (!box) return;

  const hasFail = result.steps.some(s => s.status === FAIL);
  const hasWarn = result.steps.some(s => s.status === WARN);

  // Ringkasan bahasa awam untuk user
  let summary;
  if (!hasFail && !hasWarn) {
    summary = `
      <div class="kinfo-card kcenter">
        <div class="kfs32 kmb8">✅</div>
        <div class="kfw700 kfs15 kgreen">Data Anda Aman &amp; Tersinkron</div>
        <div class="kfs13 ktext2 kmt8">Semua pemeriksaan berhasil. Data usaha Anda tersimpan dengan baik di server.</div>
      </div>`;
  } else if (!hasFail) {
    summary = `
      <div class="kwarn-card kcenter">
        <div class="kfs32 kmb8">⚠️</div>
        <div class="kfw700 kfs15">Ada Hal yang Perlu Diperhatikan</div>
        <div class="kfs13 ktext2 kmt8">Data Anda tersinkron, tapi ada beberapa catatan. Jika ada masalah, coba muat ulang aplikasi.</div>
      </div>`;
  } else {
    const offline = result.steps.find(s => s.name.includes('internet') && s.status === FAIL);
    summary = `
      <div class="kerr-card kcenter">
        <div class="kfs32 kmb8">❌</div>
        <div class="kfw700 kfs15 kred">Data Belum Tersinkron</div>
        <div class="kfs13 ktext2 kmt8">${offline ? 'Perangkat Anda sedang <b>tidak terhubung internet</b>. Data tetap aman di HP — akan otomatis tersinkron saat online.' : 'Ada masalah koneksi ke server. Data tetap aman di HP. Coba muat ulang aplikasi, atau kirim hasil pemeriksaan ke admin.'}</div>
      </div>`;
  }

  const rows = result.steps.map(s => `
    <div class="kflex-gap10 kpy4" style="border-bottom:1px solid var(--border)">
      <div class="kfs18 kflex-shrink0">${ICON[s.status]}</div>
      <div class="kmin-w0 kfw700 kfs13">${escapeHtml(s.label || s.name)}</div>
    </div>`).join('');

  box.innerHTML = `
    ${summary}
    <details class="kmt12">
      <summary class="kfs13 ktext2 kcursor-pointer" style="padding:8px 0">🔍 Hasil Pemeriksaan</summary>
      <div class="kmt8">${rows}</div>
    </details>`;
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
  await openModal('syncDiagModal');
  _running = true;
  box.innerHTML = '<div class="kcenter kp24 ktext2 kfs14">⏳ Memeriksa koneksi &amp; penyimpanan data…</div>';
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
    showToast('Hasil pemeriksaan disalin — kirim ke admin via WhatsApp jika perlu bantuan.');
  } catch (e) {
    const { showToast } = await import('./helpers.js');
    showToast('Gagal menyalin — screenshot layar ini saja.', 'error');
  }
}

export function closeSyncDiag() {
  closeModal('syncDiagModal');
}
