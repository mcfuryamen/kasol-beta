/**
 * Purchase License Module for Kaki5
 * Handles: QRIS display, upload bukti, realtime license activation
 */

import { getUnitId, getDeviceCode } from './license.js';
import { showToast } from './helpers.js';

const QRIS_BUCKET_URL = 'https://hhywrvedlwljawgxzpkq.supabase.co/storage/v1/object/public/qris/';
const BUKTI_BUCKET_URL = 'https://hhywrvedlwljawgxzpkq.supabase.co/storage/v1/object/bukti/';
const SUPABASE_URL = window.KASIRSOLO_SUPABASE_URL;
const ANON_KEY = window.KASIRSOLO_SUPABASE_ANON_KEY;
const APP_TYPE = 'kaki5';

// purchase.js tidak bergantung pada apakah sync.js sudah pernah inisialisasi
// client. Pastikan client ada (dibuat sekali), dan tolak placeholder key.
function getSupabaseClient() {
  if (!window.supabase || !SUPABASE_URL || isPlaceholderKey(ANON_KEY)) return null;
  if (!window._ksrSupabaseClient) {
    window._ksrSupabaseClient = window.supabase.createClient(SUPABASE_URL, ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
  }
  return window._ksrSupabaseClient;
}

function isPlaceholderKey(k) {
  if (!k) return true;
  const s = String(k);
  return s.includes('***') || s.includes('...') || /^PASTE/i.test(s) || !s.includes('.');
}

/** Tutup gate fullscreen + lockOverlay saat lisensi aktif (flow otomatis). */
function unlockGate() {
  const gate = document.getElementById('licenseGate');
  if (gate) gate.style.display = 'none';
  document.getElementById('lockOverlay')?.classList.remove('show');
}

/** Get current license status from Supabase */
export async function getCloudLicenseStatus() {
  const sb = getSupabaseClient();
  if (!SUPABASE_URL || !ANON_KEY || !sb) return null;
  
  const { unit_id } = await getUnitIdWithDevice();
  const { data, error } = await sb
    .from('clients')
    .select('license_status, license_serial, license_expires_at')
    .eq('unit_id', unit_id)
    .maybeSingle();
  
  if (error) return null;
  return data;
}

/** Get unit_id and device_code */
async function getUnitIdWithDevice() {
  const unitId = await getUnitId();
  const deviceCode = await getDeviceCode();
  return { unit_id: unitId, device_code: deviceCode };
}

/** Open purchase sheet with QRIS + bank account (Step 1) */
export async function openPurchaseSheet() {
  const { unit_id, device_code } = await getUnitIdWithDevice();
  const body = document.getElementById('purchaseSheetBody');
  if (!body) return;
  
  // Get payment info from Supabase `settings` (qris_url + bank_info) & `products` harga
  const sb = getSupabaseClient();
  let payInfo = { qrisUrl: '', bank: '', accountNumber: '', accountName: '', priceLabel: '' };

  try {
    const [qrisRes, bankRes, prodRes] = await Promise.all([
      sb.from('settings').select('value').eq('key', 'qris_url').maybeSingle(),
      sb.from('settings').select('value').eq('key', 'bank_info').maybeSingle(),
      sb.from('products').select('price_label').eq('app_type', APP_TYPE).maybeSingle()
    ]);

    const parseVal = (d) => {
      if (!d) return {};
      if (typeof d.value === 'string') {
        try { return JSON.parse(d.value); } catch { return {}; }
      }
      return d.value || {};
    };

    const qrisVal = parseVal(qrisRes.data);
    const bankVal = parseVal(bankRes.data);
    payInfo = {
      qrisUrl: qrisVal.url || '',
      bank: bankVal.bank || '',
      accountNumber: bankVal.account_number || '',
      accountName: bankVal.account_name || '',
      priceLabel: prodRes.data?.price_label || ''
    };
  } catch (e) { console.error('Failed to load payment info', e); }

  const hasQris = !!payInfo.qrisUrl;
  
  const qrisHtml = hasQris
    ? `<img src="${payInfo.qrisUrl}" style="width:100%;max-width:300px;border-radius:12px;margin-bottom:12px" alt="QRIS">
       <div style="text-align:center;margin-bottom:12px">
         <a href="${payInfo.qrisUrl}" download="qris-kasirsolo.png" class="btn btn-ghost btn-sm">⤓ Unduh QRIS</a>
       </div>`
    : `<div style="text-align:center;padding:20px;color:var(--text2)">
         QRIS sedang dalam konfigurasi. Hubungi admin untuk informasi pembayaran.
       </div>`;

  const bankHtml = (payInfo.bank || payInfo.accountNumber || payInfo.accountName)
    ? `
      <div style="background:var(--bg2);border-radius:12px;padding:14px;margin-bottom:16px">
        <div style="font-size:13px;color:var(--text2);margin-bottom:8px;font-weight:700">🏦 Rekening Pembayaran</div>
        <div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:6px;font-size:14px">
          <span style="color:var(--text2)">Bank</span><span style="font-weight:700">${payInfo.bank || '—'}</span>
        </div>
        <div style="display:flex;justify-content:space-between;gap:8px;margin-bottom:6px;font-size:14px">
          <span style="color:var(--text2)">No. Rekening</span><span style="font-weight:700;font-family:monospace">${payInfo.accountNumber || '—'}</span>
        </div>
        <div style="display:flex;justify-content:space-between;gap:8px;font-size:14px">
          <span style="color:var(--text2)">Atas Nama</span><span style="font-weight:700">${payInfo.accountName || '—'}</span>
        </div>
      </div>`
    : `
      <div style="background:var(--bg2);border-radius:12px;padding:12px;margin-bottom:16px;font-size:13px;color:var(--text2)">
        💳 Pembayaran bisa langsung ditransfer. No. rekening info akan tampil di sini setelah admin mengatur lewat dashboard.
      </div>`;

  const priceRow = payInfo.priceLabel
    ? `
      <div style="display:flex;justify-content:space-between;align-items:center;background:var(--bg2);border-radius:12px;padding:12px 14px;margin-bottom:16px">
        <span style="font-size:14px;color:var(--text2)">Harga Lisensi</span>
        <span style="font-size:18px;font-weight:800;color:var(--accent,var(--success,#16a34a))">${payInfo.priceLabel}</span>
      </div>`
    : '';

  // STEP 1 — info pembayaran + tombol "Kirim Bukti Bayar"
  body.innerHTML = `
    <div style="margin-bottom:16px">
      <h3 style="margin:0 0 8px 0;font-size:16px">💳 Beli Lisensi Kasir Solo</h3>
      <p style="margin:0;color:var(--text2);font-size:14px">
        Transfer sesuai nominal, lalu kirim bukti pembayaran. Admin akan memverifikasi & mengaktifkan lisensi secara otomatis.
      </p>
    </div>
    
    ${priceRow}
    <div style="text-align:center;margin-bottom:16px">${qrisHtml}</div>
    ${bankHtml}

    <div style="background:var(--bg2);border-radius:12px;padding:12px;margin-bottom:16px">
      <div style="font-size:13px;color:var(--text2);margin-bottom:4px">Unit ID</div>
      <div style="font-family:monospace;font-size:14px;font-weight:600">${unit_id}</div>
    </div>

    <button class="btn btn-primary" style="width:100%" onclick="window._ksr_purchaseShowUpload()">
      🧾 Kirim Bukti Bayar
    </button>

    <!-- STEP 2 — form upload bukti (tersembunyi sampai tombol Kirim Bukti diklik) -->
    <div id="purchaseUploadStep" style="display:none;margin-top:16px">
      <div style="margin-bottom:16px">
        <label style="font-size:13px;color:var(--text2);display:block;margin-bottom:4px">Upload Bukti Transfer</label>
        <input type="file" id="buktiInput" accept="image/*" style="display:none" onchange="window._ksr_handleBuktiUpload(event)">
        <button class="btn btn-primary" style="width:100%" onclick="document.getElementById('buktiInput').click()">
          📷 Pilih Foto Bukti
        </button>
        <div id="buktiPreview" style="margin-top:8px;text-align:center"></div>
      </div>

      <button class="btn btn-primary" style="width:100%" onclick="window._ksr_submitPurchase('${unit_id}', '${device_code}')" id="submitPurchaseBtn" disabled>
        🚀 Kirim Bukti Pembayaran
      </button>
    </div>

    <div style="margin-top:16px;padding:12px;background:var(--bg2);border-radius:8px;font-size:13px;color:var(--text2)">
      <strong>📋 Cara Pembayaran:</strong><br>
      1. Scan QRIS di atas atau transfer ke rekening yang tertera<br>
      2. Transfer sesuai nominal (${payInfo.priceLabel || 'lihat info harga'})<br>
      3. Klik "Kirim Bukti Bayar" lalu upload bukti transfer<br>
      4. Admin akan memverifikasi & mengaktifkan lisensi Anda
    </div>
  `;
  
  window._ksr_currentBuktiFile = null;
  window._ksr_currentPrice = parsePriceToNumber(payInfo.priceLabel) || null;
}

/** Parse "Rp 500.000" / "Rp500.000" menjadi angka 500000. */
function parsePriceToNumber(label) {
  if (!label) return 0;
  const cleaned = String(label).replace(/[^0-9]/g, '');
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? 0 : num;
}

/** Pindah dari Step 1 (info) ke Step 2 (form upload bukti). */
export function purchaseShowUpload() {
  const step = document.getElementById('purchaseUploadStep');
  if (step) step.style.display = 'block';
}

/** Handle bukti upload preview */
export async function handleBuktiUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  window._ksr_currentBuktiFile = file;
  
  const preview = document.getElementById('buktiPreview');
  if (preview) {
    const reader = new FileReader();
    reader.onload = (e) => {
      preview.innerHTML = `<img src="${e.target.result}" style="max-width:100%;max-height:200px;border-radius:8px">
                           <div style="font-size:12px;color:var(--text2);margin-top:4px">${file.name}</div>`;
    };
    reader.readAsDataURL(file);
  }
  
  // Enable submit button
  const btn = document.getElementById('submitPurchaseBtn');
  if (btn) btn.disabled = false;
}

/** Submit purchase to Supabase */
export async function submitPurchase(unitId, deviceCode) {
  const file = window._ksr_currentBuktiFile;
  if (!file) {
    showToast('Pilih foto bukti transfer terlebih dahulu', 'error');
    return;
  }
  
  showToast('⏳ Mengupload bukti...', 2000, 'info');
  
  try {
    const sb = getSupabaseClient();
    if (!sb) throw new Error('Supabase client belum siap (cek anon key)');

    // Upload to storage
    const timestamp = Date.now();
    const fileName = `${unitId}_${timestamp}.jpg`;
    const { data: uploadData, error: uploadError } = await sb.storage
      .from('bukti')
      .upload(fileName, file, { upsert: false });
    
    if (uploadError) throw uploadError;
    
    // Get public URL
    const { data: urlData } = sb.storage
      .from('bukti')
      .getPublicUrl(fileName);
    
    // Insert purchase record — pipeline kini di tabel `clients` (leads/pembelian
    // lama sudah dikonsolidasi). Update/Upsert baris clients supaya status
    // pipeline jadi 'menunggu_verifikasi' + simpan bukti_url + harga.
    const harga = window._ksr_currentPrice || null;
    const { error: insertError } = await sb
      .from('clients')
      .upsert({
        unit_id: unitId,
        app_type: APP_TYPE,
        device_code: deviceCode,
        status: 'menunggu_verifikasi',
        bukti_url: urlData?.publicUrl || '',
        harga,
        updated_at: new Date().toISOString()
      }, { onConflict: 'unit_id' });
    
    if (insertError) throw insertError;
    
    showToast('✅ Bukti pembayaran dikirim! Tunggu verifikasi admin.', 3000, 'success');
    window._ksr_closeSheet('sheetPurchase');

    // Refresh status card langsung → jadi "Menunggu Verifikasi Admin"
    try {
      const { renderLicenseStatusArea } = await import('./license.ui.js');
      await renderLicenseStatusArea('licenseInfoCard', 'licenseKeyInputSettings');
      await renderLicenseStatusArea('lockLicenseStatusArea', 'lockLicenseInput');
    } catch (e) { /* UI sudah ditutup — aman */ }
    
    // Start polling for license activation
    window._ksr_pollLicenseStatus(unitId);
    
  } catch (e) {
    console.error('Submit purchase error:', e);
    showToast('Gagal mengirim bukti: ' + e.message, 3000, 'error');
  }
}

/** Poll license status until activated */
export async function pollLicenseStatus(unitId) {
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes (30s intervals)
  
  const check = async () => {
    const status = await getCloudLicenseStatus();
    if (status?.license_status === 'aktif') {
      // License activated!
      showToast('🎉 Lisensi berhasil diaktifkan!', 3000, 'success');
      window._ksr_closeSheet('sheetPurchase');
      unlockGate();
      // Reload license info
      if (window._ksr_updateTrialChip) window._ksr_updateTrialChip();
      if (window._ksr_checkLicenseGate) window._ksr_checkLicenseGate();
      return true;
    }
    
    attempts++;
    if (attempts >= maxAttempts) {
      showToast('⏳ Verifikasi masih berlangsung. Kami akan mengaktifkan lisensi Anda segera.', 5000, 'info');
      return false;
    }
    
    // Poll again in 30 seconds
    setTimeout(check, 30000);
  };
  
  check();
}

/** Subscribe to realtime license updates */
export function subscribeToLicenseUpdates(unitId) {
  const sb = getSupabaseClient();
  if (!SUPABASE_URL || !ANON_KEY || !sb) return;
  
  const channel = sb.channel(`license:${unitId}`);
  
  channel.on('postgres_changes', 
    { event: 'UPDATE', schema: 'public', table: 'clients', filter: `unit_id=eq.${unitId}` },
    (payload) => {
      if (payload.new.license_status === 'aktif') {
        console.log('License activated via realtime!', payload.new);
        showToast('🎉 Lisensi berhasil diaktifkan!', 3000, 'success');
        unlockGate();
        // Update local license
        if (window._ksr_updateTrialChip) window._ksr_updateTrialChip();
        if (window._ksr_checkLicenseGate) window._ksr_checkLicenseGate();
        if (window._ksr_renderLicenseInfoCard) window._ksr_renderLicenseInfoCard();
      }
    }
  );
  
  channel.subscribe();
  console.log('Subscribed to license updates for', unitId);
}
