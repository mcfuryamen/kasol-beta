/* =========================================================================
   KASIR SOLO - ROSOK
   settings-x.js — Fitur pengaturan adopsi kaki5 (mekanisme, visual rosok):
   1. Toggle 💳/⚙️ Fitur Aplikasi — metode bayar (Tunai/Transfer/Tempo) memfilter
      tombol metode di layar transaksi (jaring pengaman: minimal satu aktif);
      saklar "Kas & Shift Harian" (fiturKas) melepas gerbang buka-kas POS,
      menyembunyikan tombol Buka/Tutup Kas & kartu riwayat shift (pola v166).
   2. 📲 Pasang Aplikasi (PWA beforeinstallprompt, ala kaki5).
   3. 🩺 Cek Data Online — diagnosa rantai sync 11 langkah (port sync.health.js).
   ========================================================================= */
import { db } from './db.js';
import { SETTINGS } from './app-state.js';
import { getSetting, setSetting, openOverlay, closeSheet, toast } from './utils.js';
import { getLicenseStatus } from './license.js';

// ── 1. Metode Pembayaran (toggle) ─────────────────────────────────────────
export async function loadPayOptions(){
  const saved = await getSetting('payOptions', null) || {};
  const opts = { tunai: true, transfer: true, tempo: true, ...saved };
  if(!Object.values(opts).some(Boolean)) opts.tunai = true; // jaring pengaman
  const map = { Tunai: 'tunai', Transfer: 'transfer', Tempo: 'tempo' };
  for(const [suffix, key] of Object.entries(map)){
    const el = document.getElementById('payOpt' + suffix);
    if(el) el.checked = !!opts[key];
  }
  applyPayOptions(opts);
  // Saklar "Kas & Shift Harian" (⚙️ Fitur Aplikasi) — default aktif ('1').
  try {
    const kEl = document.getElementById('fiturKasToggle');
    if(kEl) kEl.checked = (await getSetting('fiturKas', '1')) !== '0';
  } catch(_) { /* storage gagal — biarkan checkbox pada keadaan default */ }
  return opts;
}

// Simpan saklar fitur kas/shift (pola kaki5 v166 saveFiturKas). Nilai dibaca
// SEGAR oleh kas.js.fiturKasAktif() di tiap gerbang — di sini kita hanya
// menyegarkan tampilan (tombol kas-bar & kartu riwayat shift) tanpa reload.
export async function saveFiturKas(){
  const el = document.getElementById('fiturKasToggle');
  const on = !!(el && el.checked);
  await setSetting('fiturKas', on ? '1' : '0');
  toast(on ? 'Fitur kas & shift aktif' : 'Fitur kas & shift dimatikan');
  try { if(typeof window.updateKasBarButtons === 'function') window.updateKasBarButtons(); } catch(_){}
  try { if(typeof window._ksr_renderLaporan === 'function') window._ksr_renderLaporan(); } catch(_){}
}

function readToggles(){
  return {
    tunai: !!(document.getElementById('payOptTunai') || {}).checked,
    transfer: !!(document.getElementById('payOptTransfer') || {}).checked,
    tempo: !!(document.getElementById('payOptTempo') || {}).checked
  };
}

export async function savePayOptions(){
  const opts = readToggles();
  if(!Object.values(opts).some(Boolean)){
    toast('Minimal satu metode pembayaran harus aktif');
    document.getElementById('payOptTunai').checked = true;
    opts.tunai = true;
  }
  await setSetting('payOptions', opts);
  applyPayOptions(opts);
  toast('Metode pembayaran disimpan');
}

// Saring tombol metode di layar transaksi + reset metode aktif bila nonaktif.
function applyPayOptions(opts){
  document.querySelectorAll('#metodeBayarTabs button[data-m]').forEach(b => {
    const m = b.dataset.m;
    if(m in opts) b.style.display = opts[m] ? '' : 'none';
  });
  const active = document.querySelector('#metodeBayarTabs button.active[data-m]');
  if(active && active.style.display === 'none'){
    const next = document.querySelector('#metodeBayarTabs button[data-m]:not([style*="none"])');
    if(next && typeof window.setMetodeBayar === 'function') window.setMetodeBayar(next.dataset.m);
  }
}

// ── 2. PWA: Pasang Aplikasi ───────────────────────────────────────────────
let _deferredPrompt = null;

export function initPwaInstall(){
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _deferredPrompt = e;
    const row = document.getElementById('rowInstallPwa');
    if(row) row.style.display = '';
  });
  // Sudah terpasang (mode standalone) → sembunyikan baris.
  if(window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone){
    const row = document.getElementById('rowInstallPwa');
    if(row) row.style.display = 'none';
  }
}

export async function installPwa(){
  if(!_deferredPrompt){ toast('Aplikasi belum siap dipasang — coba lagi sebentar'); return; }
  try {
    await _deferredPrompt.prompt();
    const { outcome } = await _deferredPrompt.userChoice;
    if(outcome === 'accepted'){
      toast('Aplikasi dipasang 🎉');
      _deferredPrompt = null;
      const row = document.getElementById('rowInstallPwa');
      if(row) row.style.display = 'none';
    }
    // outcome 'dismissed' (atau selain 'accepted'): biarkan baris instalasi tetap
    // tampil agar user bisa mencoba lagi — jangan sembunyikan barisnya.
  } catch (e) {
    console.warn('[PWA] Gagal memanggil prompt instalasi:', e);
    // Jangan sembunyikan baris pada error (mis. user membatalkan) — biarkan
    // user mencoba lagi nanti. _deferredPrompt tetap disimpan untuk percobaan berikutnya.
  }
}

// ── 3. Cek Data Online — diagnosa rantai sync 11 langkah (port sync.health.js
//      kaki5): setiap langkah diberi status ✅/⚠️/❌ + pesan asli, kegagalan
//      senyap jadi terbaca, hasil bisa disalin & dikirim ke admin. ──────────
import { getSupabaseClient, claimDevice, pushProfile, pullCloudProfile, reanchorUnitId } from './license.sync.js';
import { ensureUnitId } from './license.js';
import { escapeHtml } from './utils.js';

const D_OK = 'ok', D_WARN = 'warn', D_FAIL = 'fail';
const D_ICON = { ok: '✅', warn: '⚠️', fail: '❌' };
function dstep(status, title, detail, label){ return { status, title, detail: String(detail ?? ''), label: label || title }; }

async function runSyncDiagnostics(){
  const steps = [];
  const url = window.KASIRSOLO_SUPABASE_URL;
  const anon = window.KASIRSOLO_SUPABASE_ANON_KEY;
  steps.push(dstep(window.supabase ? D_OK : D_FAIL, '1. Skrip Supabase termuat',
    window.supabase ? 'window.supabase tersedia' : 'window.supabase TIDAK ada — muat ulang halaman.',
    'Aplikasi siap terhubung'));
  const keyReal = !!(anon && !String(anon).includes('***') && !String(anon).includes('...') && String(anon).includes('.'));
  steps.push(dstep(url && keyReal ? D_OK : D_FAIL, '2. Konfigurasi server',
    `URL: ${url || '—'} · kunci: ${!anon ? 'tidak ada' : (keyReal ? 'format benar' : 'masih placeholder')}`,
    'Pengaturan server benar'));
  steps.push(dstep(navigator.onLine ? D_OK : D_FAIL, '3. Koneksi internet',
    navigator.onLine ? 'Online' : 'Perangkat sedang offline.', 'Koneksi internet aktif'));
  const sb = getSupabaseClient();
  steps.push(dstep(sb ? D_OK : D_FAIL, '4. Client Supabase siap',
    sb ? 'createClient berhasil' : 'Client tidak bisa dibuat (lihat langkah 1–2).',
    'Jalur data ke server siap'));
  let unitId = null, deviceCode = '';
  if (sb) {
    try {
      unitId = await ensureUnitId();
      deviceCode = (await getSetting('deviceCode', '')) || '';
      steps.push(dstep(D_OK, '5. Identitas perangkat', `unit_id: ${unitId} · device_code: ${deviceCode}`, `ID Perangkat: ${deviceCode || '—'}`));
    } catch (e) {
      steps.push(dstep(D_FAIL, '5. Identitas perangkat', 'Gagal membaca dari IndexedDB: ' + (e?.message || e), 'ID Perangkat belum terpasang'));
    }
    try {
      const { data: sessData } = await sb.auth.getSession();
      const uid = sessData?.session?.user?.id;
      const metaUnit = sessData?.session?.user?.user_metadata?.unit_id;
      steps.push(uid
        ? dstep(metaUnit === unitId ? D_OK : D_WARN, '6. Sesi anonim', `uid ${String(uid).slice(0, 8)}… · claim unit_id: ${metaUnit || 'belum ada'}`, 'Koneksi aman untuk perangkat ini')
        : dstep(D_WARN, '6. Sesi anonim', 'Belum ada session — dibuat otomatis saat sync.', 'Sesi dibuat otomatis saat sync'));
    } catch (e) {
      steps.push(dstep(D_FAIL, '6. Sesi anonim', 'Gagal membaca session: ' + (e?.message || e), 'Koneksi aman belum siap'));
    }
    if (deviceCode) {
      const claimed = await claimDevice(sb, unitId, deviceCode);
      steps.push(dstep(claimed ? D_OK : D_WARN, '7. Klaim perangkat (device_known)',
        claimed ? 'Baris clients diklaim ke sesi ini (idempoten)' : 'Klaim gagal/ditolak — jalur hybrid policy tetap dicoba.',
        claimed ? 'Server mengenali perangkat ini' : 'Perangkat baru / klaim ditunda — normal saat install pertama'));
    }
    try {
      const { data: row, error } = await sb.from('clients')
        .select('unit_id, nama_usaha, last_seen, license_status')
        .eq('unit_id', unitId).eq('app_type', 'rosok').maybeSingle();
      steps.push(error
        ? dstep(D_FAIL, '8. Baris profil di server', 'Select error: ' + error.message, 'Profil usaha belum bisa diperiksa')
        : dstep(row ? D_OK : D_WARN, '8. Baris profil di server',
            row ? `Ada: ${row.nama_usaha || '(tanpa nama)'} · last_seen ${row.last_seen || '—'} · lisensi ${row.license_status || '—'}` : 'Belum ada baris untuk unit ini.',
            row ? `Profil usaha tersimpan: ${row.nama_usaha || '(tanpa nama)'}` : 'Profil usaha belum tersimpan di server'));
    } catch (e) {
      steps.push(dstep(D_FAIL, '8. Baris profil di server', 'Select gagal: ' + (e?.message || e), 'Profil usaha belum bisa diperiksa'));
    }
    if (navigator.onLine) {
      try {
        const res = await pushProfile(); // user-intent dari diagnosa (setara force kaki5)
        if (res.ok) steps.push(dstep(D_OK, '9. Uji sinkron penuh', 'Profil terkirim & terbaca kembali; cloud → lokal disegarkan.', 'Tes kirim & terima data: berhasil'));
        else if (res.reason === 'no-profile') steps.push(dstep(D_WARN, '9. Uji sinkron penuh', 'Dilewati: profil lokal masih kosong — isi Nama Usaha dulu (guard anti-hapus-cloud).', 'Belum bisa dites — isi profil dulu'));
        else steps.push(dstep(D_FAIL, '9. Uji sinkron penuh', `Gagal (${res.reason || '?'}): ${res.error || ''}`, 'Tes kirim & terima data: gagal'));
      } catch (e) {
        steps.push(dstep(D_FAIL, '9. Uji sinkron penuh', 'Exception: ' + (e?.message || e), 'Tes kirim & terima data: gagal'));
      }
      try { await pullCloudProfile(); } catch (_) {}
    } else {
      steps.push(dstep(D_FAIL, '9. Uji sinkron penuh', 'Dilewati: perangkat offline.', 'Belum bisa dites — perangkat offline'));
    }
  }
  try {
    const st = (await getSetting('syncState', null)) || { status: 'none' };
    const errs = Array.isArray(st.recentErrors) ? st.recentErrors : [];
    steps.push(errs.length
      ? dstep(D_WARN, '10. Riwayat kegagalan (5 terakhir)', errs.map(x => `[${x.stage}] ${x.message} (${x.at})`).join(' · '), 'Ada catatan masalah — salin & kirim ke admin bila perlu bantuan')
      : dstep(D_OK, '10. Riwayat kegagalan', `Tidak ada. Status lokal: ${st.status}${st.syncedAt ? ' sejak ' + st.syncedAt : ''}`, 'Tidak ada masalah tersimpan — data sudah tersinkron'));
  } catch (e) {
    steps.push(dstep(D_WARN, '10. Riwayat kegagalan', 'Tidak terbaca: ' + (e?.message || e), 'Riwayat masalah tidak bisa dibaca'));
  }
  // 11. Konsistensi identitas perangkat (re-anchor unit_id) — port kaki5
  //     sync.health.js. Dipanggil dengan force: ini satu-satunya jalur "coba
  //     lagi" yang sah, karena pagar anti-osilasi menghentikan percobaan boot
  //     otomatis ke kanonik yang berbeda (kasus satu perangkat dua deviceCode).
  try {
    const res = await reanchorUnitId({ force: true });
    if (res.ok && (res.reason === 'migrated' || res.reason === 'adopted')) {
      steps.push(dstep(D_OK, '11. Konsistensi identitas perangkat',
        `ID perangkat diselaraskan ke kanonik (${res.reason === 'migrated' ? 'baris lama dipindah' : 'baris kanonik diadopsi'}).`,
        'ID perangkat sudah diselaraskan'));
    } else if (res.ok) {
      steps.push(dstep(D_OK, '11. Konsistensi identitas perangkat', `unit_id sudah kanonik (${res.reason || 'ok'}).`, 'ID perangkat konsisten'));
    } else if (res.reason === 'serial-bound') {
      steps.push(dstep(D_OK, '11. Konsistensi identitas perangkat', 'Lisensi berbayar terikat serial — unit_id tidak digeser (aturan anti-copy).', 'ID perangkat konsisten'));
    } else if (res.reason === 'offline' || res.reason === 'session' || res.reason === 'no-identity') {
      steps.push(dstep(D_WARN, '11. Konsistensi identitas perangkat', `Dilewati (${res.reason}).`, 'ID perangkat belum bisa diperiksa'));
    } else {
      steps.push(dstep(D_WARN, '11. Konsistensi identitas perangkat', `Tidak diselaraskan (${res.reason || '?'}${res.error ? ': ' + res.error : ''}).`, 'ID perangkat perlu perhatian'));
    }
  } catch (e) {
    steps.push(dstep(D_WARN, '11. Konsistensi identitas perangkat', 'Gagal: ' + (e?.message || e), 'ID perangkat belum bisa diperiksa'));
  }
  return { steps, summary: steps.some(s => s.status === D_FAIL) ? 'ADA MASALAH' : 'SEMUA BAIK' };
}

let _lastDiag = null;

export async function openCekDataSheet(){
  const body = document.getElementById('cekDataBody');
  if(!body) return;
  openOverlay('sheetCekData');
  body.innerHTML = '<div class="hint">⏳ Memeriksa koneksi &amp; penyimpanan data…</div>';
  let result;
  try { result = await runSyncDiagnostics(); }
  catch (e) { body.innerHTML = '<div class="hint">Diagnosa crash: ' + escapeHtml(String(e?.message || e)) + '</div>'; return; }
  _lastDiag = result;
  const hasFail = result.steps.some(s => s.status === D_FAIL);
  const hasWarn = result.steps.some(s => s.status === D_WARN);
  const summaryHtml = !hasFail && !hasWarn
    ? '<div class="diag-card ok"><div style="font-size:28px">✅</div><b>Data Anda Aman &amp; Tersinkron</b><div class="s-desc">Semua pemeriksaan berhasil. Data usaha Anda tersimpan dengan baik di server.</div></div>'
    : !hasFail
    ? '<div class="diag-card warn"><div style="font-size:28px">⚠️</div><b>Ada Hal yang Perlu Diperhatikan</b><div class="s-desc">Data Anda tersinkron, tapi ada beberapa catatan. Jika ada masalah, coba muat ulang aplikasi.</div></div>'
    : '<div class="diag-card fail"><div style="font-size:28px">❌</div><b>Data Belum Tersinkron</b><div class="s-desc">Ada masalah koneksi ke server. Data tetap aman di perangkat. Coba muat ulang aplikasi, atau kirim hasil pemeriksaan ke admin.</div></div>';
  const rows = result.steps.map(s => `
    <div class="setting-row" style="cursor:default;">
      <span class="setting-ic ${s.status === D_OK ? 'ic-green' : (s.status === D_WARN ? 'ic-orange' : 'ic-red')}">${D_ICON[s.status]}</span>
      <div class="setting-txt"><div class="s-title">${escapeHtml(s.label)}</div><div class="s-desc">${escapeHtml(s.detail)}</div></div>
    </div>`).join('');
  // Info lisensi & kuota (khas rosok — melengkapi diagnosa kaki5).
  const lic = await getLicenseStatus().catch(() => null);
  let quotaLabel = '—';
  try {
    const cfg = await getSetting('trialConfig', null);
    const q = cfg && Number(cfg.txQuota);
    quotaLabel = q ? ('Kuota perangkat ini: ' + q + ' trx/bulan (cache)') : 'Belum pernah sinkron — pakai default';
  } catch (_) { quotaLabel = 'Cache kuota tak terbaca'; }
  const licRow = `
    <div class="setting-row" style="cursor:default;">
      <span class="setting-ic ${lic && (lic.status === 'trial' || lic.status === 'active') ? 'ic-green' : 'ic-red'}">${lic && (lic.status === 'trial' || lic.status === 'active') ? '✅' : '⚠️'}</span>
      <div class="setting-txt"><div class="s-title">Status Lisensi (lokal)</div><div class="s-desc">${lic ? (lic.status === 'active' ? 'Aktif ✓' : 'Tier gratis — sisa ' + (lic.txRemaining ?? 0) + ' trx') : 'Tidak terbaca'}</div></div>
    </div>
    <div class="setting-row" style="cursor:default;">
      <span class="setting-ic ${quotaLabel.includes('trx/bulan') ? 'ic-green' : 'ic-orange'}">${quotaLabel.includes('trx/bulan') ? '✅' : '⚠️'}</span>
      <div class="setting-txt"><div class="s-title">Kuota Cloud</div><div class="s-desc">${escapeHtml(quotaLabel)}</div></div>
    </div>`;
  body.innerHTML = summaryHtml + rows + licRow +
    '<p class="muted-note mt8">Data transaksi selalu aman di perangkat (offline-first). Diagnosa ini memeriksa jalur sinkron ke server.</p>' +
    '<button class="btn btn-outline mt12" style="width:100%" onclick="window._ksr_copyDiag()">📋 Salin Hasil — kirim ke admin bila perlu bantuan</button>';
}

export function copyDiag(){
  if(!_lastDiag) return;
  const text = '[Diagnosa Sinkronisasi Kasir Rosok ' + new Date().toISOString() + ']\n' +
    _lastDiag.steps.map(s => `${D_ICON[s.status]} ${s.title}\n    ${s.detail}`).join('\n') +
    '\n' + _lastDiag.summary;
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); } catch (_) {}
    ta.remove();
  };
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(
      () => toast('Hasil disalin — kirim ke admin via WhatsApp bila perlu bantuan.'),
      () => { fallback(); toast('Hasil disalin.'); }
    );
  } else { fallback(); toast('Hasil disalin.'); }
}

// Global exports utk onclick di HTML
window.savePayOptions = savePayOptions;
window.saveFiturKas = saveFiturKas;
window.installPwa = installPwa;
window.openCekDataSheet = openCekDataSheet;
window._ksr_copyDiag = copyDiag;
