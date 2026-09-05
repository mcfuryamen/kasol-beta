/**
 * Purchase License Module for Kaki5
 * Handles: QRIS display, upload bukti, realtime license activation
 */

import { getUnitId, getDeviceCode } from './license.js';
import { showToast, escapeHtml } from './helpers.js';
import { pullCloudProfileTo } from './sync.js';
import { rateLimiters } from './helpers.pure.js';
import { openModal, closeModal } from './modal.js';

// Dev detection helper
function isDev() {
  return location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname.startsWith('192.168.') || location.hostname.startsWith('10.') || location.hostname.endsWith('.local') || !location.hostname.includes('.');
}

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

/** Tutup overlay terkunci saat lisensi aktif (flow otomatis). */
function unlockGate() {
  closeModal('lockOverlay');
  import('./license.js').then(m => m.hideQuotaBanner()).catch(() => {});
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
  let payInfo = { qrisUrl: '', bank: '', accountNumber: '', accountName: '', priceLabel: '', priceBeforeLabel: '', productName: '', kodeProduk: '', isDemo: false };
  const demoPayment = {
    bank: 'Belum dikonfigurasi',
    accountNumber: '—',
    accountName: 'Atur di Admin Console'
  };

  try {
    if (!sb) throw new Error('Supabase client belum siap');
    const [qrisRes, bankRes, prodRes] = await Promise.all([
      sb.from('settings').select('value').eq('key', 'qris_url').maybeSingle(),
      sb.from('settings').select('value').eq('key', 'bank_info').maybeSingle(),
      sb.from('products').select('app_type,kode_produk,name,price_label,price_before_label,visible').eq('app_type', APP_TYPE).eq('visible', true).limit(1).maybeSingle()
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
      priceLabel: prodRes.data?.price_label || '',
      priceBeforeLabel: prodRes.data?.price_before_label || '',
      productName: prodRes.data?.name || 'Kaki Lima',
      kodeProduk: prodRes.data?.kode_produk || ''
    };
    if (prodRes.error) console.warn('Harga produk Kaki5 tidak tersedia:', prodRes.error.message);
    payInfo.isDemo = !payInfo.qrisUrl && !payInfo.bank && !payInfo.accountNumber && !payInfo.accountName;
  } catch (e) { console.error('Failed to load payment info', e); }

  // M6 (audit 2026-09-05): qrisUrl admin bisa arbitrary — validasi https:// prefix.
  const safeQrisUrl = (typeof payInfo.qrisUrl === 'string' && /^https:\/\//.test(payInfo.qrisUrl)) ? payInfo.qrisUrl : '';
  const hasQris = !!safeQrisUrl;
  const qrisHtml = hasQris
    ? `<img src="${safeQrisUrl}" style="width:100%;max-width:300px;border-radius:12px;margin-bottom:12px" alt="QRIS">
       <div class="kcenter kmb12">
         <a href="${safeQrisUrl}" download="qris-kasirsolo.png" class="btn btn-outline btn-sm">⤓ Unduh QRIS</a>
       </div>`
    : `<div style="text-align:center;padding:20px;border:1px dashed var(--line,var(--border));border-radius:12px;color:var(--text2)">
         <div class="kfs30 kmb8">▦</div>
         <strong>Preview QRIS demo</strong>
         <div style="font-size:12px;margin-top:4px">QRIS asli belum diatur di Admin Console.</div>
       </div>`;

  // M6 (audit 2026-09-05): bank/rekening/nama admin — semua nilai dinamis di-escape.
  const bankHtml = (payInfo.bank || payInfo.accountNumber || payInfo.accountName)
    ? `
      <div style="background:var(--bg2);border-radius:12px;padding:14px;margin-bottom:16px">
        <div style="font-size:13px;color:var(--text2);margin-bottom:8px;font-weight:700">🏦 Rekening Pembayaran</div>
        <div class="kflex-between kgap8 kmb8 kfs14">
          <span class="ktext2">Bank</span><span class="kfw700">${escapeHtml(payInfo.bank || '—')}</span>
        </div>
        <div class="kflex-between kgap8 kmb8 kfs14">
          <span class="ktext2">No. Rekening</span><span style="font-size:18px;font-weight:800;font-family:monospace">${escapeHtml(payInfo.accountNumber || '—')}</span>
        </div>
        <div style="display:flex;justify-content:space-between;gap:8px;font-size:14px">
          <span class="ktext2">Atas Nama</span><span class="kfw700">${escapeHtml(payInfo.accountName || '—')}</span>
        </div>
      </div>`
    : `
      <div style="background:var(--bg2);border-radius:12px;padding:12px;margin-bottom:16px;font-size:13px;color:var(--text2)">
        💳 <strong>Mode demo:</strong> detail pembayaran belum dikonfigurasi. Jangan transfer sebelum admin mengisi QRIS dan rekening di Admin Console.
      </div>`;

  const productCode = payInfo.kodeProduk || APP_TYPE.toUpperCase();
  const priceRow = payInfo.priceLabel
    ? `
      <div style="background:var(--bg2);border-radius:12px;padding:12px 14px;margin-bottom:16px">
        <div class="kflex-between kgap8 kmb8 kfs14">
          <span class="ktext2">Produk</span><span class="kfw700">Kasir Solo - Kaki Lima | ${productCode}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span class="kfs14 ktext2">Harga Lisensi</span>
          <!-- Harga lama (opsional) dicoret + oranye; HARGA NORMAL TIDAK dicoret.
               NB: <s> WAJIB ditutup di sini — kalau tidak, seluruh konten di
               bawahnya (QRIS, rekening, cara pembayaran) ikut tercoret. -->
          <span style="display:inline-flex;align-items:baseline;gap:8px">
            ${payInfo.priceBeforeLabel ? `<s style="font-size:13px;color:var(--primary);font-weight:600">${escapeHtml(payInfo.priceBeforeLabel)}</s>` : ''}
            <span style="font-size:18px;font-weight:800;color:var(--accent,var(--success,#16a34a))">${escapeHtml(payInfo.priceLabel || '')}</span>
          </span>
        </div>
      </div>`
    : '';

  // STEP 1 — info pembayaran + tombol "Kirim Bukti Pembayaran"
  body.innerHTML = `
    <div class="kmb16">
      <p class="ktext2 kfs14">
        Transfer sesuai nominal, lalu kirim bukti pembayaran. Admin akan memverifikasi & mengaktifkan lisensi secara otomatis.
      </p>
    </div>

    ${priceRow}
    <div class="kcenter kmb16">${qrisHtml}</div>
    ${bankHtml}

    <!-- Blok visual "Unit ID" dihapus (permintaan pemilik 2026-08-26) —
         logika unit_id TETAP jalan: dikirim ke cloud saat kirim bukti &
         dipakai polling realtime (window._ksr_purchaseUnitId). -->

    <div id="purchaseUploadStep" class="kmt16">
      <input type="file" id="buktiInput" accept="image/png,image/jpeg,image/webp" capture="environment" style="display:none" data-action="handle-bukti-upload">
      <!-- Placeholder "📎 Lampirkan foto..." dihapus (permintaan pemilik 2026-08-26) —
           state foto kini cukup terlihat dari warna/label tombol + preview di bawah. -->
      <div id="buktiPreview" style="margin-bottom:10px;text-align:center"></div>
      <!-- Dua state (permintaan pemilik 2026-08-26): foto belum terpilih → HIJAU
           "Lampirkan Bukti Pembayaran"; foto sudah terpilih → ORANYE "Kirim Sekarang".
           Switch state dilakukan di handleBuktiUpload(). -->
      <button class="btn btn-green kw-full" data-action="trigger-bukti-input" ${payInfo.isDemo ? 'disabled title="Menunggu konfigurasi pembayaran admin"' : ''} id="submitPurchaseBtn">
        ${payInfo.isDemo ? 'Pembayaran belum siap' : '📎 Lampirkan Bukti Pembayaran'}
      </button>
    </div>

    <div style="margin-top:16px;padding:12px;background:rgba(250,204,21,0.15);border-radius:8px;font-size:13px;color:var(--text2)">
      <strong>📋 Cara Pembayaran:</strong><br>
      1. Scan QRIS di atas atau transfer ke rekening yang tertera<br>
      2. Transfer sesuai nominal (${payInfo.priceLabel || 'lihat info harga'})<br>
      3. Klik "Lampirkan Bukti Pembayaran" untuk memilih foto, lalu klik "Kirim Sekarang" untuk mengirim<br>
      4. Admin akan memverifikasi & mengaktifkan lisensi Anda
    </div>
  `;

  window._ksr_currentBuktiFile = null;
  window._ksr_purchaseUnitId = unit_id;
  window._ksr_purchaseDeviceCode = device_code;
  window._ksr_currentPrice = parsePriceToNumber(payInfo.priceLabel) || null;

  // Tampilkan sheet via modal system (focus trap + a11y)
  await openModal('sheetPurchase');
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
      preview.innerHTML = `<img src="${e.target.result}" alt="Preview bukti pembayaran" style="max-width:100%;max-height:200px;border-radius:8px">
                           <div style="font-size:12px;color:var(--text2);margin-top:4px">Siap dikirim</div>`;
    };
    reader.readAsDataURL(file);
  }

  // Switch state tombol (permintaan pemilik 2026-08-26):
  // HIJAU "Lampirkan Bukti Pembayaran" → ORANYE "Kirim Sekarang".
  // Aksi klik tetap lewat dispatcher data-action="trigger-bukti-input" (app.js)
  // — JANGAN pasang btn.onclick lagi (dulu klik kedua membuka file picker
  // DAN submit bersamaan).
  const btn = document.getElementById('submitPurchaseBtn');
  if (btn) {
    btn.disabled = false;
    btn.classList.remove('btn-green');
    btn.classList.add('btn-primary');
    btn.textContent = '🚀 Kirim Sekarang';
  }
}

/** Submit purchase to Supabase */
export async function submitPurchase(unitId, deviceCode) {
  // Rate limit: 3 calls per minute
  if (!rateLimiters.submitPurchase('submit-purchase')) {
    showToast('Terlalu banyak percobaan kirim bukti. Tunggu sebentar.', 'error');
    return;
  }

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

    // Insert purchase record — pipeline kini di tabel `clients` (leads/pembelian lama sudah
    // dikonsolidasi). Update/Upsert baris clients supaya status
    // pipeline jadi 'menunggu_verifikasi' + simpan bukti_url + harga.
    // RLS clients: auth.uid() = user_id → pastikan ada session anon & kirim user_id.
    let { data: sessData } = await sb.auth.getSession();
    let userId = sessData?.session?.user?.id || null;
    if (!userId) {
      const { data: anon, error: auErr } = await sb.auth
        .signInAnonymously({ options: { data: { unit_id: unitId } } });
      if (auErr) throw auErr;
      userId = anon?.user?.id;
    }

    // Klaim ulang baris perangkat lama sebelum upsert. RLS mengizinkan update
    // hanya untuk owner saat ini; device_known memindahkan owner secara aman
    // setelah sesi anonim tersedia (termasuk saat browser/storage berganti).
    const { error: claimError } = await sb.rpc('device_known', {
      p_unit_id: unitId,
      p_device_code: deviceCode,
      p_app_type: APP_TYPE
    });
    // Idempotent: kalau device_known INSERT gagal karena unit_id sudah ada
    // (Postgres 23505 duplicate key), anggap sukses — baris sudah ada, klaim
    // owner dianggap done. Update berikutnya akan update baris yang sama.
    if (claimError && claimError.code !== '23505') throw claimError;

    const { error: insertError } = await sb
      .from('clients')
      .update({
        app_type: APP_TYPE,
        device_code: deviceCode,
        user_id: userId,
        status: 'menunggu_verifikasi',
        bukti_url: urlData?.publicUrl || '',
        updated_at: new Date().toISOString()
      })
      .eq('unit_id', unitId);

    if (insertError) throw insertError;

    showToast('✅ Bukti pembayaran dikirim! Tunggu verifikasi admin.', 3000, 'success');
    closeModal('sheetPurchase');

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
    showToast('Gagal mengirim bukti', 'error', { duration: 3000 });
  }
}

/** Poll license status until activated.
 * T16 (audit 2026-08-17/M6): memulai poll baru membatalkan rantai lama —
 * submit berulang tidak lagi menumpuk beberapa timer paralel (request &
 * toast ganda). */
let _pollTimer = null;

export async function pollLicenseStatus(unitId) {
  let attempts = 0;
  const maxAttempts = 60; // 5 minutes (30s intervals)
  if (_pollTimer) { clearTimeout(_pollTimer); _pollTimer = null; }

  const check = async () => {
    const status = await getCloudLicenseStatus();
    if (status?.license_status === 'aktif') {
      // License activated!
      _pollTimer = null;
      showToast('🎉 Lisensi berhasil diaktifkan!', 3000, 'success');
      closeModal('sheetPurchase');
      unlockGate();
      // Persist lisensi cloud → lokal dulu, supaya chip & gate (yang membaca
      // data lokal IndexedDB) langsung ikut aktif — bukan cuma kartu status
      // yang membaca cloud. Dulu chip tetap "TRIAL" sampai reload.
      try {
        const { persistCloudLicense } = await import('./license.logic.js');
        await persistCloudLicense(status);
      } catch (e) { console.warn('Persist lisensi lokal gagal:', e); }
      // Reload license info
      if (window._ksr_updateTrialChip) window._ksr_updateTrialChip();
      if (window._ksr_checkLicenseGate) window._ksr_checkLicenseGate();
      return true;
    }

    attempts++;
    if (attempts >= maxAttempts) {
      _pollTimer = null;
      showToast('⏳ Verifikasi masih berlangsung. Kami akan mengaktifkan lisensi Anda segera.', 5000, 'info');
      return false;
    }

    // Poll again in 30 seconds
    _pollTimer = setTimeout(check, 30000);
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
        // C2: pull profil cloud → lokal saat lisensi aktif (device baru / install ulang)
        pullCloudProfileTo(payload.new).catch(e => console.warn('[C2] realtime pull profil gagal:', e));
        // Refresh UI agar profil yang baru di-pull langsung tampil
        (async () => {
          try {
            const { loadSettings } = await import('./settings.js');
            if (typeof loadSettings === 'function') await loadSettings();
          } catch (_) { /* abaikan */ }
        })();
        // Update local license: persist cloud → lokal dulu (chip & gate membaca
        // data lokal — tanpa ini chip tetap "TRIAL" walau server sudah aktif).
        (async () => {
          try {
            const { persistCloudLicense } = await import('./license.logic.js');
            await persistCloudLicense(payload.new);
          } catch (e) { console.warn('Persist lisensi lokal gagal:', e); }
          if (window._ksr_updateTrialChip) window._ksr_updateTrialChip();
          if (window._ksr_checkLicenseGate) window._ksr_checkLicenseGate();
          if (window._ksr_renderLicenseInfoCard) window._ksr_renderLicenseInfoCard();
        })();
      } else if (payload.new.license_status === 'batal' || payload.new.license_status === 'nonaktif') {
        // Realtime revoke: kunci app segera tanpa menunggu reload.
        console.warn('License revoked via realtime!', payload.new);
        if (window._ksr_enforceRevoked) window._ksr_enforceRevoked();
        else if (window._ksr_checkLicenseGate) window._ksr_checkLicenseGate();
      }
    }
  );

  channel.subscribe();
  console.log('Subscribed to license updates for', unitId);
}