// ==================== LICENSE SYNC (ESM) ====================
// Supabase activation & status sync. NO DOM operations.
// Cloud-first: lisensi diaktifkan OTOMATIS oleh admin lewat edge function
// `activate-license` (PATCH clients.license_*) + Supabase Realtime push.
// User TIDAK perlu request serial manual — cukup beli (QRIS) & tunggu
// verifikasi admin. Input serial manual hanya fallback offline.
import { ensureSynced, pullCloudProfileTo, ensureAuthSession } from './sync.js';
import { getUnitId, getDeviceCode, getInstallId, getLicense, saveLicense, markLicenseRevoked, bumpClockAnchor, currentTxMonth, cloudProfileMatchesLocal } from './license.logic.js';
import { setSetting, getSetting } from './db.js';
import { rateLimiters } from './helpers.pure.js';

const LICENSE_SYNC_KEY = 'licenseSync';
const APP_TYPE = 'kaki5';
const PRODUCT_PREFIX = 'KK5';

// Cache for product salt (fetched once per session)
let _productSaltCache = null;

function classifyCloudError(error) {
  const status = Number(error?.status || error?.statusCode || 0);
  const code = String(error?.code || '').toUpperCase();
  if (status === 404 || code === 'PGRST116') return 'not-found';
  return 'network';
}

// Baca baris lisensi via unit_id — kunci natural yang stabil. (Dulu via
// device_code; fingerprint V3/T14 bisa mengubah device_code pada perangkat
// yang sama, sedangkan unit_id kekal — lihat getUnitId yang mempertahankan
// nilai tersimpan. tx_month/tx_used/tx_adjust ikut dibaca utk reconcile kuota.)
async function readLicenseRow(sb, unitId) {
  try {
    const { data, error } = await sb
      .from('clients')
      .select('license_status, license_serial, license_expires_at, first_seen, tx_month, tx_used, tx_adjust, tx_updated_at, nama_usaha, nama_pemilik, no_whatsapp, provinsi_id, provinsi, kabkota_id, kabkota, kecamatan_id, kecamatan, desa_id, desa, alamat_detail')
      .eq('unit_id', unitId)
      .eq('app_type', APP_TYPE)
      .maybeSingle();
    if (error) return { kind: classifyCloudError(error), error };
    if (!data) return { kind: 'not-found' };
    return { kind: 'ok', data };
  } catch (error) {
    return { kind: 'network', error };
  }
}

async function isKnownDevice(sb, deviceCode) {
  try {
    const unitId = await getUnitId();
    const { data, error } = await sb.rpc('device_known', {
      p_unit_id: unitId, p_device_code: deviceCode, p_app_type: APP_TYPE
    });
    return error ? null : data === true;
  } catch (_) {
    return null;
  }
}


// Placeholder anon key => JWT gagal auth => semua query reject RLS.
function isPlaceholderKey(k) {
  if (!k) return true;
  const s = String(k);
  return s.includes('***') || s.includes('...') || /^PASTE/i.test(s) || /^xxxx/i.test(s) || !s.includes('.');
}

function getSupabaseClient() {
  if (!window.supabase) return null;
  const url = window.KASIRSOLO_SUPABASE_URL;
  const anon = window.KASIRSOLO_SUPABASE_ANON_KEY;
  if (!url || isPlaceholderKey(anon)) return null;
  if (!window._ksrSupabaseClient) {
    window._ksrSupabaseClient = window.supabase.createClient(url, anon, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
  }
  return window._ksrSupabaseClient;
}

/** Export client supabase anon (dipakai modul lain seperti app-link). */
export { getSupabaseClient };

/**
 * Fetch product salt from Supabase products table.
 * Returns { salt, version } or null if failed.
 * Uses local fallback if fetch fails.
 */
export async function fetchProductSalt() {
  // Return cached if available
  if (_productSaltCache) return _productSaltCache;

  const sb = getSupabaseClient();
  if (!sb || !navigator.onLine) {
    return getLocalFallbackSalt();
  }

  try {
    // 2026-08-30: kolom asli tabel products = `kode_produk` & `salt` — filter
    // lama (`prefix`/`salt_hmac`/`salt_version`) selalu 400 sehingga fetch ini
    // diam-diam memakai salt fallback lokal selama ini (nilainya identik dengan
    // cloud, makanya validasi serial tak pernah bermasalah).
    const { data, error } = await sb
      .from('products')
      .select('salt')
      .eq('kode_produk', PRODUCT_PREFIX)
      .eq('app_type', APP_TYPE)
      .maybeSingle();

    if (error) {
      console.warn('[LICENSE] Failed to fetch product salt:', error.message);
      return getLocalFallbackSalt();
    }

    if (data && data.salt) {
      const result = { salt: data.salt, version: 2 };
      _productSaltCache = result;
      console.log('[LICENSE] Product salt fetched from Supabase:', result);
      return result;
    }

    console.warn('[LICENSE] No salt found in products table for', PRODUCT_PREFIX);
    return getLocalFallbackSalt();
  } catch (e) {
    console.warn('[LICENSE] Error fetching product salt:', e?.message || e);
    return getLocalFallbackSalt();
  }
}

function getLocalFallbackSalt() {
  // Local fallback for v2 (matches current buildProductSalt in license.logic.js)
  const fallback = { salt: 'KASIRSOLO-KAKI5-HMAC-V2', version: 2 };
  _productSaltCache = fallback;
  console.log('[LICENSE] Using local fallback salt:', fallback);
  return fallback;
}

// ===== Kuota transaksi global (products.tx_quota) =====
// Angka default tier gratis, diatur admin lewat kartu produk. Di-cache di
// memori + settings.trialConfig supaya app tetap tahu kuotanya saat offline.
// Kolom kosong/tidak ada → null (app memakai DEFAULT_TX_QUOTA).
let _txQuotaCache = null;
export async function fetchTxQuotaConfig() {
  if (_txQuotaCache != null) return _txQuotaCache;
  const sb = getSupabaseClient();
  if (!sb || !navigator.onLine) return null;
  try {
    const { data, error } = await sb
      .from('products')
      .select('tx_quota')
      .eq('kode_produk', PRODUCT_PREFIX)
      .eq('app_type', APP_TYPE)
      .maybeSingle();
    if (error || !data) return null;
    const q = Number(data.tx_quota);
    if (Number.isFinite(q) && q > 0) {
      _txQuotaCache = Math.floor(q);
      await setSetting('trialConfig', { txQuota: _txQuotaCache });
      return _txQuotaCache;
    }
    return null;
  } catch (e) {
    console.warn('fetchTxQuotaConfig:', e?.message || e);
    return null;
  }
}

/**
 * Clear salt cache (e.g., after manual rotation or for testing)
 */
export function clearProductSaltCache() {
  _productSaltCache = null;
}

/**
 * RE-ANCHOR unit_id (port rosok 2026-09-04). Pergantian fingerprint V3→V4
 * (sinyal `platform` dibuang) menggeser deviceCode → unit_id kanonik ikut
 * bergeser. Instalasi era V3 menyimpan 'K5-'+kodeV3 sementara browser baru
 * menghitung 'K5-'+kodeV4 → satu perangkat fisik dua baris cloud (lisensi
 * tidak ikut pindah, profil fragmentasi, kuota dobel-spend). Konvergensikan
 * ke kanonik — SEKALI, idempoten, dan HANYA untuk perangkat tanpa serial
 * aktif (aturan kaki5: unit terikat serial hanya boleh pindah via
 * device_assign di server).
 *   • Kanonik kosong     → PATCH unit_id+device_code baris sendiri ke kanonik
 *     (claim sesi lama membuat RLS mengizinkan), simpan unitId + claim baru.
 *   • Kanonik sudah ada, profil kosong/cocok → ADOPSI: unitId lokal dipindah
 *     ke kanonik (baris lama ditinggal; pembersihannya keputusan admin).
 *   • Kanonik sudah ada, profil tidak cocok → TOLAK; unit lama DIPERTAHANKAN
 *     dan hasil percobaan DIBLOKIR di settings supaya tidak diulang tiap boot.
 *   • Offline/gagal      → diam; dicoba lagi boot berikutnya.
 *
 * Dua keputusan desain (audit konsol beta 2026-09-04):
 *  1) BACA dulu, tulis kemudian. Respons 4xx dicetak DevTools oleh lapisan
 *     jaringan browser dan tidak bisa dibungkam dari kode — jadi jalur lama
 *     "PATCH lalu menangkan duplicate key" selalu meninggalkan garis merah
 *     tiap boot. Satu SELECT membuat kondisi itu terbaca tanpa menulis.
 *  2) Hasil "profil tidak cocok" disimpan (unitReanchorBlocked) beserta sidik
 *     profil lokal. Selama profil tidak diubah, percobaan tidak diulang —
 *     aplikasi berhenti bicara ke endpoint yang pasti menolak. Sidik berubah
 *     (user menyelaraskan Nama Usaha / No. WA) → blokir gugur, konvergensi
 *     jalan sendiri. Pengaturan → Cek Data Online memaksa ulang (force).
 *
 * CATATAN PESAN: dulu kondisi blokir dilabeli "profil asing". Itu menyesatkan
 * — guard hanya membuktikan profil TIDAK IDENTIK, bukan pemiliknya orang lain.
 * Dua instalasi browser di satu PC (profil awal diketik ulang dengan typo)
 * kena label yang sama. Pesan kini menyebut field yang beda.
 */
const REANCHOR_BLOCK_KEY = 'unitReanchorBlocked';

// Field profil lokal yang dipakai guard cloudProfileMatchesLocal — jangan
// menambah field lain ke sini, nanti sidiknya tidak mencerminkan keputusan
// adopsi (blokir bisa bertahan padahal guard sudah akan bilang "cocok").
async function localProfileFields() {
  const norm = async (k) => { try { return String(await getSetting(k, '') || '').trim().toLowerCase(); } catch (_) { return ''; } };
  const usaha = await norm('namaUsaha') || await norm('namaWarung');
  const wa = await norm('noWhatsapp');
  return { usaha, wa, sig: usaha + '|' + wa };
}

function profileDiff(cloud, local) {
  const cloudUsaha = String(cloud && cloud.nama_usaha || '').trim().toLowerCase();
  const cloudWa = String(cloud && cloud.no_whatsapp || '').trim().toLowerCase();
  const diff = [];
  if (cloudUsaha !== local.usaha) diff.push('nama usaha');
  if (cloudWa !== local.wa) diff.push('no. WhatsApp');
  return diff;
}

/** Status blokir re-anchor terakhir (null bila tidak ada) — untuk diagnostik. */
export async function getReanchorBlock() {
  try { return await getSetting(REANCHOR_BLOCK_KEY, null) || null; } catch (_) { return null; }
}

/** Paksa konvergensi dicoba lagi pada boot berikutnya. */
export async function clearReanchorBlock() {
  try { await setSetting(REANCHOR_BLOCK_KEY, null); return true; } catch (_) { return false; }
}

export async function reanchorUnitId({ force = false } = {}) {
  const sb = getSupabaseClient();
  if (!sb || !navigator.onLine) return { ok: false, reason: 'offline' };
  let unitId = null, lic = null, identity = null;
  try {
    unitId = await getUnitId();
    lic = await getLicense();
    identity = await getSetting('deviceIdentity', null);
  } catch (_) { return { ok: false, reason: 'storage' }; }
  if (!identity || !identity.deviceCode) return { ok: false, reason: 'no-identity' };
  const canonical = 'K5-' + identity.deviceCode;
  if (unitId === canonical) { await setSetting(REANCHOR_BLOCK_KEY, null); return { ok: true, reason: 'already' }; }
  if (lic && lic.status === 'active' && lic.serial) return { ok: false, reason: 'serial-bound' };
  const local = await localProfileFields();
  if (!force) {
    const blk = await getSetting(REANCHOR_BLOCK_KEY, null);
    if (blk && blk.from === unitId && blk.to === canonical && blk.sig === local.sig) {
      return { ok: false, reason: blk.reason || 'profile-mismatch', blocked: true, memo: blk };
    }
  }
  await ensureAuthSession(sb); // sesi anon dengan claim unit lama
  // (1) Baca dulu — claim dipindah sebentar ke kanonik supaya RLS mengizinkan.
  let existing = null;
  try {
    await sb.auth.updateUser({ data: { unit_id: canonical } });
    const { data } = await sb.from('clients')
      .select('unit_id, nama_usaha, no_whatsapp')
      .eq('unit_id', canonical).eq('app_type', APP_TYPE).maybeSingle();
    existing = data || null;
  } catch (_) { existing = null; }
  if (existing) {
    let adopt = false;
    try { adopt = await cloudProfileMatchesLocal(existing); } catch (_) { adopt = false; }
    if (adopt) {
      await setSetting('unitId', canonical);
      await setSetting('unitReanchor', { from: unitId, to: canonical, at: new Date().toISOString(), adopted: true });
      await setSetting(REANCHOR_BLOCK_KEY, null);
      console.log('[REANCHOR] baris kanonik cocok — unit_id diadopsi:', canonical);
      return { ok: true, reason: 'adopted' };
    }
    try { await sb.auth.updateUser({ data: { unit_id: unitId } }); } catch (_) {}
    const diff = profileDiff(existing, local);
    const memo = { from: unitId, to: canonical, at: new Date().toISOString(), sig: local.sig, reason: 'profile-mismatch', diff };
    await setSetting(REANCHOR_BLOCK_KEY, memo);
    console.warn('[REANCHOR] ' + canonical + ' sudah dipakai baris dengan profil TIDAK SAMA (beda: '
      + (diff.join(', ') || 'tidak terdeteksi') + ') — unit lama DIPERTAHANKAN. Selaraskan Nama Usaha / No. WA lalu jalankan Pengaturan → Cek Data Online.');
    return { ok: false, reason: 'profile-mismatch', blocked: true, memo };
  }
  // Bacaan di atas mengubah claim → kembalikan ke unit lama sebelum PATCH,
  // supaya RLS tetap mengizinkan tulis baris milik sesi ini.
  try { await sb.auth.updateUser({ data: { unit_id: unitId } }); } catch (_) {}
  // (2) Kanonik kosong → migrasi baris sendiri.
  const { error: migErr } = await sb.from('clients')
    .update({ unit_id: canonical, device_code: identity.deviceCode })
    .eq('unit_id', unitId).eq('app_type', APP_TYPE);
  if (!migErr) {
    await setSetting('unitId', canonical);
    await setSetting('unitReanchor', { from: unitId, to: canonical, at: new Date().toISOString() });
    try { await sb.auth.updateUser({ data: { unit_id: canonical } }); } catch (_) {}
    await setSetting(REANCHOR_BLOCK_KEY, null);
    console.log('[REANCHOR] unit_id V3→kanonik:', canonical);
    return { ok: true, reason: 'migrated' };
  }
  if (String(migErr.code || '') === '23505' || /duplicate key/i.test(String(migErr.message || ''))) {
    // Balapan dengan browser lain antara baca & tulis. Sama-sama blokir, tapi
    // alasannya berbeda — jangan ditulis sebagai "profil tidak cocok".
    try { await sb.auth.updateUser({ data: { unit_id: unitId } }); } catch (_) {}
    const memo = { from: unitId, to: canonical, at: new Date().toISOString(), sig: local.sig, reason: 'collision-race', diff: [] };
    await setSetting(REANCHOR_BLOCK_KEY, memo);
    console.warn('[REANCHOR] ' + canonical + ' baru saja diklaim browser lain — unit lama DIPERTAHANKAN; coba lagi dari Pengaturan → Cek Data Online.');
    return { ok: false, reason: 'collision-race', blocked: true, memo };
  }
  console.warn('[REANCHOR] gagal:', migErr.message || migErr);
  return { ok: false, reason: 'write', error: migErr.message };
}

/** Sync local license state to Supabase and apply only authoritative results. */
export async function syncLicenseStatus() {
  // Rate limit: 30 calls per minute
  if (!rateLimiters.syncLicense('sync-license-status')) {
    return { ok: false, reason: 'rate-limited' };
  }

  const sb = getSupabaseClient();
  if (!sb || !navigator.onLine) return { ok: false, reason: 'network' };
  const unitId = await getUnitId();
  const deviceCode = await getDeviceCode();
  let result = await readLicenseRow(sb, unitId);
  if (result.kind === 'not-found') {
    const known = await isKnownDevice(sb, deviceCode);
    const local = await getLicense();
    // A missing row is authoritative only for a device already known locally
    // or confirmed by the claim RPC; a first-ever device must not be revoked.
    if (known === true || local.status === 'active' || local.status === 'revoked') {
      // "Tidak terlihat oleh RLS" ≠ "terhapus". Coba lihat sebagai session
      // bermetadata unit_id dulu (baris user_id NULL / session lain); revoke
      // HANYA kalau setelah itu barisnya memang tidak ada.
      const recheck = await recheckRowWithSession(sb);
      if (recheck === 'found') {
        result = await readLicenseRow(sb, unitId);
      } else if (recheck === 'missing') {
        await markLicenseRevoked('not-found');
        return { ok: false, reason: 'not-found', revoked: true };
      } else {
        // recheck error (network dsb.) — JANGAN revoke dari ketidakpastian.
        return { ok: false, reason: 'network' };
      }
    } else {
      return { ok: false, reason: 'not-found' };
    }
  }
  if (result.kind !== 'ok') return { ok: false, reason: 'network' };

  const cloud = result.data;

  // ===== Reconcile kuota transaksi (cloud = sumber kebenaran) =====
  // (1) angka kuota global dari products.tx_quota → cache lokal (offline);
  // (2) penghitung: adopsi cloud bila lebih besar (hapus data / ganti browser
  //     tidak menurunkan counter), push lokal bila lebih besar (pemakaian
  //     offline yang belum terkirim); tx_adjust milik admin → selalu ikut cloud.
  await fetchTxQuotaConfig();
  try {
    const local = await getLicense();
    if (local.status === 'trial') {
      const month = currentTxMonth();
      const cloudMonth = cloud.tx_month || null;
      const cloudUsed = Number(cloud.tx_used) || 0;
      const cloudAdjust = Number(cloud.tx_adjust) || 0;
      const cloudT = cloud.tx_updated_at ? new Date(cloud.tx_updated_at).getTime() : 0;
      let myPushT = 0;
      try { myPushT = Number(await getSetting('txLastPushAt', 0)) || 0; } catch (_) { /* storage gagal */ }
      // Tulisan cloud yang lebih baru dari push terakhir KITA = berasal dari
      // admin/instance lain (jam perangkat beda → toleransi 5 detik).
      const cloudNewer = cloudT > myPushT + 5000;
      const adminReset = !cloudMonth && cloudNewer; // admin reset pakai (tx_month null)
      let lic = local;
      if ((Number(lic.txAdjust) || 0) !== cloudAdjust) lic = { ...lic, txAdjust: cloudAdjust };
      if (adminReset) {
        // Reset oleh admin → kuota segar bulan berjalan; hitungan lokal diabaikan.
        lic = { ...lic, txMonth: month, txUsed: 0 };
      } else if (cloudMonth && cloudMonth > (lic.txMonth || '')) {
        // Rollover tercatat di cloud / jam lokal mundur → ikut cloud.
        lic = { ...lic, txMonth: cloudMonth, txUsed: cloudUsed };
      } else if (cloudMonth === lic.txMonth && cloudUsed > (Number(lic.txUsed) || 0)) {
        // Hapus data / ganti browser tidak boleh menurunkan penghitung.
        lic = { ...lic, txUsed: cloudUsed };
      }
      if (lic !== local) await saveLicense(lic);
      const effUsed = lic.txMonth === month ? (Number(lic.txUsed) || 0) : 0;
      // Push lokal → cloud: rollover bulan, atau pemakaian offline bulan
      // berjalan yang belum terkirim (tidak pernah menimpa tulisan admin).
      if ((cloudMonth === month && cloudUsed < effUsed) || (cloudMonth !== month && (effUsed > 0 || !adminReset))) {
        const { error: txErr } = await sb.from('clients')
          .update({ tx_month: month, tx_used: effUsed, tx_updated_at: new Date().toISOString() })
          .eq('unit_id', unitId);
        if (!txErr) await setSetting('txLastPushAt', Date.now());
        else console.warn('sync tx_used:', txErr.message || txErr);
      }
    }
  } catch (e) {
    console.warn('reconcile kuota gagal:', e?.message || e);
  }

  const status = String(cloud.license_status || '').toLowerCase();
  if (status === 'batal' || status === 'nonaktif' || status === 'revoked') {
    await markLicenseRevoked('admin');
    return { ok: false, reason: 'revoked', revoked: true };
  }
  // 'belum' (atau kosong) = cloud TIDAK mencatat lisensi terjual untuk unit
  // ini. Cloud adalah sumber kebenaran: lokal yang masih 'active' adalah cache
  // basi (mis. baris cloud di-reset admin — insiden chip zombie v101,
  // 2026-08-29) dan WAJIB diturunkan ke tier gratis kuota transaksi agar
  // chip/gate kembali jujur. Bukan revoke — 'belum' artinya kembali ke tier
  // gratis, bukan hukuman.
  if (status === 'belum' || status === '') {
    const local = await getLicense();
    if (local.status === 'active') {
      const month = currentTxMonth();
      await saveLicense({
        status: 'trial',
        txMonth: month,
        txUsed: local.txMonth === month ? (Number(local.txUsed) || 0) : 0,
        txAdjust: Number(cloud.tx_adjust) || 0,
        deviceCode: local.deviceCode || (await getDeviceCode()),
        downgradedFrom: 'active',
        downgradedAt: new Date().toISOString(),
        downgradedReason: 'cloud-belum'
      });
      await refreshSettingsUI();
    }
    // trial/none/revoked lokal + cloud 'belum' → tier gratis; penghitung &
    // adjust sudah ditangani blok "Reconcile kuota" di atas.
  }
  // Pemulihan revoke palsu (H3): revoke bertanda 'not-found' yang ternyata
  // barisnya ADA dan tidak dicabut admin → hapus state revoked lokal supaya
  // perangkat bisa trial/aktivasi normal. Revoke admin asli tidak tersentuh
  // (mereka tertangani cabang status batal/nonaktif di atas).
  {
    const local = await getLicense();
    if (local.status === 'revoked' && local.revokedReason === 'not-found') {
      const { clearLocalLicense } = await import('./license.logic.js');
      await clearLocalLicense();
    }
  }
  if (status === 'aktif' && cloud.license_serial) {
    const local = await getLicense();
    // Guard tabrakan identitas (port rosok 2026-09-04): sesama model HP bisa
    // menghasilkan unit_id identik — jangan adopsi lisensi baris milik orang
    // lain. Baris kosong profil → boleh (perangkat baru); terisi → harus cocok.
    if (!(await cloudProfileMatchesLocal(cloud))) {
      console.warn('[LICENSE] adopsi cloud (blok A) DITOLAK — profil tidak cocok (indikasi tabrakan identitas)');
    } else {
    if (local.status !== 'active' || local.serial !== cloud.license_serial) {
      const { activateSerial } = await import('./license.logic.js');
      await activateSerial(cloud.license_serial);
    }
    // C2: saat lisensi aktif, pull profil cloud → lokal (menutup gap device baru
    // / install ulang yang kehilangan nama usaha, pemilik, dll).
    await pullCloudProfileTo(cloud);
    // Refresh UI agar profil yang baru di-pull langsung tampil (tanpa perlu navigasi ke Pengaturan)
    await refreshSettingsUI();
    }
  }
  await setSetting(LICENSE_SYNC_KEY, { lastSuccessfulSync: new Date().toISOString() });
  await bumpClockAnchor(); // T13: sync sukses = bukti app hidup di momen ini
  return { ok: true, cloud };
}

/**
 * Pastikan ada session anonim yang membawa claim unit_id di metadata, lalu
 * baca ulang baris clients. Return 'found' | 'missing' | 'error'.
 *
 * Latar (H3, kejadian nyata 2026-08-17): baris clients dengan user_id NULL /
 * milik session lain TIDAK terlihat oleh select RLS tanpa session bermetadata.
 * syncLicenseStatus dulu menyamakan "tidak terlihat" dengan "terhapus" lalu
 * me-revoke perangkat yang barinya sebenarnya ada — termasuk install baru.
 * Policy "clients hybrid" punya cabang kedua: jwt.user_metadata.unit_id =
 * unit_id, jadi setelah session dibuat dengan metadata yang benar, baris
 * harusnya terbaca. Kalau SETELAH itu masih hilang, baru boleh revoke.
 */
async function recheckRowWithSession(sb) {
  try {
    const unitId = await getUnitId();
    const { data: sessData } = await sb.auth.getSession();
    if (!sessData?.session?.user?.id) {
      const { error: auErr } = await sb.auth
        .signInAnonymously({ options: { data: { unit_id: unitId } } });
      if (auErr) return 'error';
    } else {
      const metaUnit = sessData.session.user.user_metadata?.unit_id;
      if (!metaUnit || metaUnit !== unitId) {
        try {
          await sb.auth.updateUser({ data: { unit_id: unitId } });
        } catch (_) { /* metadata opsional — cabang user_id policy masih jalan */ }
      }
    }
    const re = await readLicenseRow(sb, unitId);
    if (re.kind === 'ok') return 'found';
    if (re.kind === 'not-found') return 'missing';
    return 'error';
  } catch (_) {
    return 'error';
  }
}

/**
 * Baca profil klien lokal (sumber UI settings) untuk dicocokkan ke cloud.
 * @returns {{nama_usaha:string, nama_pemilik:string, no_whatsapp:string}}
 */
async function readLocalProfile() {
  const { getSetting } = await import('./db.js');
  let nama_usaha = await getSetting('namaUsaha', '');
  // Perangkat lama masih memakai kunci 'namaWarung'.
  if (!nama_usaha) nama_usaha = await getSetting('namaWarung', '');
  const [nama_pemilik, no_whatsapp] = await Promise.all([
    getSetting('namaPemilik', ''),
    getSetting('noWhatsapp', '')
  ]);
  return { nama_usaha, nama_pemilik, no_whatsapp };
}

/**
 * Verifikasi & assign serial (Opsi 3: 1 serial = 1 unit_id = 1 profil).
 *
 * Ketika user memasukkan sebuah serial di perangkat tertentu, alur ini
 * memintakan ke RPC `device_assign`:
 *   - profil lokal COCOK dengan cloud (nama usaha / no WA) → unit_id
 *     perangkat ini di-reassign ke baris milik serial tsb (perangkat jadi
 *     pemilik), lalu serial dipakai.
 *   - profil TIDAK cocok  → RPC menolak ('profile-mismatch'), aplikasi tidak
 *     boleh mengaktifkan — lock layar + hubungi admin.
 *   - serial tidak ada    → 'serial-not-found'.
 *
 * @param {string} serial Serial yang dimasukkan user.
 * @param {string} unitId unit_id perangkat (baru / kandidat).
 * @returns {Promise<{ok:boolean, reason?:string, message?:string}>}
 */
export async function verifyAndAssignSerial(serial, unitId) {
  const sb = getSupabaseClient();
  if (!sb) return { ok: false, reason: 'network' };
  try {
    const profile = await readLocalProfile();
    const deviceCode = await getDeviceCode();
    const installId = await getInstallId();
    const { data, error } = await sb.rpc('device_assign', {
      p_serial: serial,
      p_profile: profile,
      p_new_unit_id: unitId,
      p_new_device_code: deviceCode,
      p_new_install_id: installId,
      p_app_type: APP_TYPE
    });
    if (error) {
      console.warn('[ASSIGN] device_assign RPC error:', error?.message || error);
      throw error;
    }
    const res = data || {};
    if (!res.ok) {
      console.warn('[ASSIGN] ditolak:', res.reason);
      return { ok: false, reason: res.reason || 'rejected' };
    }
    return { ok: true, reason: res.reason || 'assigned' };
  } catch (e) {
    console.warn('[ASSIGN] gagal panggil device_assign:', e?.message || e);
    return { ok: false, reason: 'network' };
  }
}

// Lazy-export UI refresh (NO DOM in this module, but we need it post-pull)
async function refreshSettingsUI() {
  try {
    const { loadSettings } = await import('./settings.js');
    if (typeof loadSettings === 'function') await loadSettings();
  } catch (e) {
    console.warn('[C2] settings UI refresh skipped:', e?.message || e);
  }
}

/**
 * Cek apakah perangkat FISIK sudah pernah terdaftar di cloud (tabel `clients`).
 * Basis: unit_id = 'K5-' + deviceCode (deterministik per hardware), jadi sama
 * walau ganti browser/re-install → onboarding cukup sekali per perangkat.
 *
 * Memanggil RPC `device_known` (SECURITY DEFINER, lihat
 * supabase/migration-device-claim.sql) yang:
 *   - return true  → perangkat dikenal; baris `clients` di-claim ke anon ini
 *                    (user_id = auth.uid()), sehingga RLS select/update lokal
 *                    bekerja & lisensi cloud bisa di-unlock lintas browser.
 *   - return false → perangkat baru (belum ada baris).
 *   - null         → gagal/offline (tidak bisa dipastikan).
 */
export async function isDeviceKnownOnCloud() {
  const sb = getSupabaseClient();
  if (!sb) return null;
  try {
    // Pastikan ada session anon supaya auth.uid() terisi saat RPC transfer owner.
    const { data: sessData } = await sb.auth.getSession();
    if (!sessData?.session?.user?.id) {
      const { error: auErr } = await sb.auth.signInAnonymously();
      if (auErr) throw auErr;
    }
    const unit_id = await getUnitId();
    const device_code = await getDeviceCode();
    const { data, error } = await sb.rpc('device_known', {
      p_unit_id: unit_id,
      p_device_code: device_code,
      p_app_type: APP_TYPE
    });
    if (error) throw error;
    return data === true;
  } catch (e) {
    console.warn('isDeviceKnownOnCloud:', e?.message || e);
    return null;
  }
}

/**
 * Ambil nilai sebuah key dari tabel `settings` (key/value, lihat
 * migration-license-qris.sql). Nilai tersimpan sebagai jsonb; dikembalikan
 * sebagai objek/string hasil parse. Return null bila gagal/offline.
 * Dipakai utk hal-hal global seperti `app_links` (link per aplikasi klien).
 */
export async function fetchSetting(key) {
  const sb = getSupabaseClient();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from('settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    if (error || !data) return null;
    const v = data.value;
    if (typeof v === 'string') {
      try { return JSON.parse(v); } catch { return v; }
    }
    return v || null;
  } catch (e) {
    console.warn('fetchSetting:', e?.message || e);
    return null;
  }
}

/**
 * Cek status lisensi langsung ke Supabase (tabel `clients`), keyed by unit_id.
 * Mengembalikan { license_status, license_serial, license_expires_at,
 * tx_used/tx_month/tx_adjust } bila baris ditemukan, atau null bila gagal /
 * tidak ada. Field tx_* dipakai reconcile kuota transaksi oleh syncLicenseStatus.
 */
export async function fetchLicenseStatusFromCloud() {
  const sb = getSupabaseClient();
  if (!sb) return null;
  const unitId = await getUnitId();
  const result = await readLicenseRow(sb, unitId);
  if (result.kind === 'ok') return result.data;
  if (result.kind === 'not-found') return null;
  console.warn('fetchLicenseStatusFromCloud:', result.error?.message || result.error || result.kind);
  return null;
}