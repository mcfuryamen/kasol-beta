/* =========================================================================
   KASIR SOLO - ROSOK
   purchase.js — Modal beli lisensi (implementasi kaki5 disalin betul).
   SATU tombol dua-state (permintaan pemilik kaki5 2026-08-26):
   foto belum terpilih → HIJAU "📎 Lampirkan Bukti Pembayaran" (klik =
   buka file picker); foto sudah terpilih → "🚀 Kirim Sekarang" (klik =
   submit). Klik TIDAK pernah dua aksi sekaligus — JANGAN pasang
   btn.onclick di handleBuktiUpload (pelajaran H1 kaki5).
   ========================================================================= */
import { getSupabaseClient, ensureSession, getCloudLicenseStatus, persistCloudLicense, claimDevice } from './license.sync.js';
import { getSetting, setSetting, toast, openOverlay, closeSheet, showLoading, hideLoading } from './utils.js';

const APP_TYPE = 'rosok';
const RATE_MS = 20000; // anti double-submit (kaki5: rate limit 3/menit)
let _lastSubmit = 0;
let _pollTimer = null;
let _pollCount = 0;

// ── Unit + device ─────────────────────────────────────────────────────────
async function getUnitIdWithDevice(){
  const unitId = await getSetting('unitId', null);
  const deviceCode = await getSetting('deviceCode', '') || '';
  return { unit_id: unitId, device_code: deviceCode };
}

// ── Sheet pembelian ───────────────────────────────────────────────────────
export async function openPurchaseSheet(){
  const body = document.getElementById('purchaseSheetBody');
  if(!body) return;
  body.innerHTML = '<div class="hint">Memuat info pembayaran…</div>';

  // Info pembayaran dari Supabase: settings.qris_url + settings.bank_info +
  // harga dari products (dikelola aplikasi admin — input pemilik).
  const sb = getSupabaseClient();
  let pay = { qrisUrl:'', bank:'', accountNumber:'', accountName:'', priceLabel:'', priceBeforeLabel:'', isDemo:true };
  if(sb && navigator.onLine){
    try {
      const [qrisRes, bankRes, prodRes] = await Promise.all([
        sb.from('settings').select('value').eq('key','qris_url').maybeSingle(),
        sb.from('settings').select('value').eq('key','bank_info').maybeSingle(),
        sb.from('products').select('name,price_label,price_before_label').eq('kode_produk','KSR').eq('app_type',APP_TYPE).eq('visible', true).limit(1).maybeSingle()
      ]);
      const parseVal = (d) => { if(!d) return {}; if(typeof d.value === 'string'){ try{ return JSON.parse(d.value); }catch(_){ return {}; } } return d.value || {}; };
      const qrisVal = parseVal(qrisRes.data), bankVal = parseVal(bankRes.data);
      pay = {
        qrisUrl: qrisVal.url || '',
        bank: bankVal.bank || '',
        accountNumber: bankVal.account_number || '',
        accountName: bankVal.account_name || '',
        priceLabel: prodRes.data?.price_label || '',
        priceBeforeLabel: prodRes.data?.price_before_label || '',
        isDemo: false
      };
      if(!pay.qrisUrl && !pay.bank) pay.isDemo = true;
    } catch(e){ console.warn('[PURCHASE] info pembayaran gagal:', e?.message || e); }
  }

  const qrisHtml = pay.qrisUrl
    ? `<img src="${pay.qrisUrl}" style="width:100%;max-width:280px;border-radius:12px;margin-bottom:10px" alt="QRIS">
       <div style="text-align:center;margin-bottom:12px"><a href="${pay.qrisUrl}" download="qris-kasirrosok.png" class="btn btn-outline">⤓ Unduh QRIS</a></div>`
    : `<div style="text-align:center;padding:18px;border:1px dashed var(--line);border-radius:12px;color:var(--ink-soft);margin-bottom:12px">
         <div style="font-size:28px">▦</div><b>QRIS belum diatur</b>
         <div style="font-size:12px;margin-top:4px">Detail pembayaran menunggu konfigurasi admin.</div>
       </div>`;
  const bankHtml = (pay.bank || pay.accountNumber || pay.accountName)
    ? `<div style="background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:12px;margin-bottom:12px">
         <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px"><span style="color:var(--ink-soft)">Bank</span><b>${pay.bank || '—'}</b></div>
         <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px"><span style="color:var(--ink-soft)">No. Rekening</span><span style="font-weight:800;font-family:monospace">${pay.accountNumber || '—'}</span></div>
         <div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:var(--ink-soft)">Atas Nama</span><b>${pay.accountName || '—'}</b></div>
       </div>`
    : '';
  const priceRow = pay.priceLabel
    ? `<div style="background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin-bottom:12px">
         <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:6px"><span style="color:var(--ink-soft)">Produk</span><b>Kasir Rosok · KSR</b></div>
         <div style="display:flex;justify-content:space-between;align-items:center">
           <span style="font-size:13px;color:var(--ink-soft)">Harga Lisensi</span>
           <span style="display:inline-flex;align-items:baseline;gap:8px">
             ${pay.priceBeforeLabel ? `<s style="font-size:13px;color:var(--brand);font-weight:600">${pay.priceBeforeLabel}</s>` : ''}
             <span style="font-size:18px;font-weight:800;color:var(--green)">${pay.priceLabel}</span>
           </span>
         </div>
       </div>`
    : '';

  body.innerHTML = `
    <p style="font-size:14px;color:var(--ink-soft);margin-bottom:12px">Transfer sesuai nominal, lalu kirim bukti pembayaran. Admin akan memverifikasi &amp; mengaktifkan lisensi otomatis.</p>
    ${priceRow}
    <div style="text-align:center;margin-bottom:12px">${qrisHtml}</div>
    ${bankHtml}
    <div id="purchaseUploadStep" style="margin-bottom:12px">
      <input type="file" id="buktiInput" accept="image/png,image/jpeg,image/webp" capture="environment" style="display:none" onchange="window._ksr_handleBuktiUpload(event)">
      <div id="buktiPreview" style="margin-bottom:10px;text-align:center"></div>
      <button class="btn btn-success" id="submitPurchaseBtn" style="width:100%" ${pay.isDemo ? 'disabled title="Menunggu konfigurasi pembayaran admin"' : ''} onclick="window._ksr_triggerBukti()">
        ${pay.isDemo ? 'Pembayaran belum siap' : '📎 Lampirkan Bukti Pembayaran'}
      </button>
    </div>
    <div style="padding:10px 12px;background:#FFF3E3;border-radius:10px;font-size:12.5px;color:var(--ink)">
      <b>📋 Cara Pembayaran:</b><br>
      1. Scan QRIS di atas atau transfer ke rekening yang tertera<br>
      2. Transfer sesuai nominal (${pay.priceLabel || 'lihat info harga'})<br>
      3. Klik "Lampirkan Bukti Pembayaran" untuk memilih foto, lalu klik "Kirim Sekarang"<br>
      4. Admin akan memverifikasi & mengaktifkan lisensi Anda
    </div>`;

  window._ksr_currentBuktiFile = null;
  const { unit_id, device_code } = await getUnitIdWithDevice();
  window._ksr_purchaseUnitId = unit_id;
  window._ksr_purchaseDeviceCode = device_code;
  openOverlay('sheetPurchase');
}

// ── Tombol dua-state: klik = SATU aksi sesuai state (kaki5 dispatcher) ────
export function triggerBukti(){
  const btn = document.getElementById('submitPurchaseBtn');
  if(btn && btn.disabled){ toast('Pembayaran belum siap — tunggu konfigurasi admin'); return; }
  if(window._ksr_currentBuktiFile){
    submitPurchase();
  } else {
    document.getElementById('buktiInput')?.click();
  }
}

// Preview + switch tombol hijau → oranye. TANPA btn.onclick (anti double-fire).
export function handleBuktiUpload(event){
  const file = event.target.files[0];
  if(!file) return;
  window._ksr_currentBuktiFile = file;
  const preview = document.getElementById('buktiPreview');
  if(preview){
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.innerHTML = `<img src="${e.target.result}" alt="Preview bukti" style="max-width:100%;max-height:180px;border-radius:10px">
                           <div style="font-size:12px;color:var(--ink-soft);margin-top:4px">Siap dikirim</div>`;
    };
    reader.readAsDataURL(file);
  }
  const btn = document.getElementById('submitPurchaseBtn');
  if(btn){
    btn.disabled = false;
    btn.classList.remove('btn-success');
    btn.classList.add('btn-warning');
    btn.textContent = '🚀 Kirim Sekarang';
  }
}

// ── Submit: upload bukti → clients.menunggu_verifikasi ────────────────────
export async function submitPurchase(){
  if(Date.now() - _lastSubmit < RATE_MS){ toast('Tunggu sebentar sebelum kirim ulang'); return; }
  const file = window._ksr_currentBuktiFile;
  if(!file){ toast('Pilih foto bukti transfer terlebih dahulu'); return; }
  _lastSubmit = Date.now();
  toast('⏳ Mengupload bukti...');
  const sb = getSupabaseClient();
  if(!sb){ toast('Supabase belum siap — muat ulang halaman'); return; }
  const { unit_id, device_code } = await getUnitIdWithDevice();
  if(!unit_id){ toast('Unit perangkat belum siap — muat ulang halaman'); return; }

  showLoading('Mengirim bukti...');
  try {
    const fileName = `${unit_id}_${Date.now()}.jpg`;
    const { error: upErr } = await sb.storage.from('bukti').upload(fileName, file, { upsert: false });
    if(upErr) throw upErr;
    const { data: urlData } = sb.storage.from('bukti').getPublicUrl(fileName);

    let userId = null;
    try { const sess = await sb.auth.getSession(); userId = sess?.data?.session?.user?.id || null; } catch(_){}

    // Klaim kepemilikan baris sebelum update (pola kaki5): pindahkan user_id ke
    // sesi anon aktif bila perangkat pindah browser/storage; idempoten.
    await claimDevice(sb, unit_id, device_code || '');

    // PATCH baris perangkat (eksis dari self-insert boot; RLS hybrid via sesi anon).
    const payload = {
      user_id: userId,
      status: 'menunggu_verifikasi',
      bukti_url: urlData?.publicUrl || '',
      updated_at: new Date().toISOString()
    };
    const { error: upRowErr } = await sb.from('clients').update(payload)
      .eq('unit_id', unit_id).eq('app_type', APP_TYPE);
    if(upRowErr) throw upRowErr;

    await setSetting('purchaseStatus', 'menunggu_verifikasi');
    hideLoading();
    toast('✅ Bukti pembayaran dikirim! Tunggu verifikasi admin.');
    closeSheet('sheetPurchase');
    if(typeof window.renderLicenseInfoCard === 'function') window.renderLicenseInfoCard();
    startPollLicenseStatus(unit_id);
  } catch (e) {
    hideLoading();
    console.error('[PURCHASE] submit gagal:', e);
    toast('Gagal mengirim bukti: ' + String(e?.message || e).slice(0, 80));
  }
}

// ── Polling + realtime (kaki5) ────────────────────────────────────────────
export function startPollLicenseStatus(unitId){
  _pollCount = 0;
  if(_pollTimer) clearTimeout(_pollTimer);
  const check = async () => {
    const cloud = await getCloudLicenseStatus(unitId).catch(() => null);
    if(cloud && String(cloud.license_status || '').toLowerCase() === 'aktif'){
      _pollTimer = null;
      await applyActivation(cloud);
      return;
    }
    _pollCount++;
    if(_pollCount >= 60){ _pollTimer = null; toast('⏳ Verifikasi masih berlangsung — lisensi aktif otomatis saat disetujui'); return; }
    _pollTimer = setTimeout(check, 30000);
  };
  check();
}

async function applyActivation(cloud){
  toast('🎉 Lisensi berhasil diaktifkan!');
  await persistCloudLicense(cloud);
  if(typeof window.checkLicenseGate === 'function') window.checkLicenseGate();
  if(typeof window.renderLicenseInfoCard === 'function') window.renderLicenseInfoCard();
}

// Realtime: UPDATE baris clients perangkat ini → langsung diterapkan.
export function subscribeToLicenseUpdates(unitId){
  const sb = getSupabaseClient();
  if(!sb) return;
  try {
    const channel = sb.channel(`license:${unitId}`);
    channel.on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'clients', filter: `unit_id=eq.${unitId}` },
      async (payload) => {
        const st = String(payload?.new?.license_status || '').toLowerCase();
        if(st === 'aktif' || st === 'active'){
          await applyActivation(payload.new);
        } else if(st === 'batal' || st === 'nonaktif'){
          try { const { getLicense, saveLicense } = await import('./license.js'); const lic = await getLicense(); if(lic.status === 'active') await saveLicense({ status:'trial', txMonth:'', txUsed:0, txAdjust:0, deviceCode: lic.deviceCode }); } catch(_){}
          if(typeof window.checkLicenseGate === 'function') window.checkLicenseGate();
        }
      }
    );
    channel.subscribe();
  } catch(e){ console.warn('[PURCHASE] realtime gagal:', e?.message || e); }
}

// Global exports utk onclick/onchange di HTML
window._ksr_openPurchaseSheet = openPurchaseSheet;
window._ksr_triggerBukti = triggerBukti;
window._ksr_handleBuktiUpload = handleBuktiUpload;
