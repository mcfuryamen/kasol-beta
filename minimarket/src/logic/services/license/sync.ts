/**
 * minimarket/src/logic/services/license/sync.ts
 * Port minimarket (Preact) dari kaki5/js/license.sync.js — faithfully.
 *
 * Cloud-first. Cloud (tabel `clients`, keyed unit_id) = sumber kebenaran
 * untuk status + kuota + expiry. Read gagal / recheck 'unknown' → JANGAN
 * revoke; revoke hanya setelah recheck session memastikan baris 'missing'.
 *
 * ADAPTASI dari kaki5:
 *  - Client via `import { supabase } from '@/data/supabase'` (bukan window.supabase).
 *    isDemoMode / URL placeholder → sb null → sync skip tanpa revoke.
 *  - APP_TYPE 'minimarket' · PRODUCT_PREFIX 'MML' · unitId 'MML-'+deviceCode.
 *  - Toast/realtime/settings refresh kaki5 tidak ada di minimarket — diganti
 *    console.warn; keputusan state lokal tetap identik.
 *  - Rate limiter (createKeyedRateLimiter) dipindahkan ke sini — versi
 *    helpers.pure.js kaki5; tidak ada dependensi lain yang memakainya.
 */
import { supabase, isDemoMode } from '@/data/supabase';
import { db, getSetting, setSetting } from './db';
import { isPlaceholderKey } from './core';
import {
  getUnitId, getDeviceCode, getLicense, saveLicense, markLicenseRevoked,
  clearLocalLicense, bumpClockAnchor, currentTxMonth, cloudProfileMatchesLocal,
  activateSerial, hmacSignature, getDeviceIdentity
} from './logic';
import { quotaMarkOnline } from './quota';

const LICENSE_SYNC_KEY = 'licenseSync';
const APP_TYPE = 'minimarket';
const PRODUCT_PREFIX = 'MML';

// ===== Rate limiter (port kaki5 helpers.pure.js) =====
// 30 calls per minute for sync (per deviceCode key).
function createKeyedRateLimiter(maxCalls: number, windowMs: number) {
  const stores: Record<string, { calls: number[] }> = {};
  return (key: string): boolean => {
    const now = Date.now();
    if (!stores[key]) stores[key] = { calls: [] };
    const store = stores[key];
    store.calls = store.calls.filter((t: number) => now - t < windowMs);
    if (store.calls.length >= maxCalls) return false;
    store.calls.push(now);
    return true;
  };
}
const rateLimiters = {
  syncLicense: createKeyedRateLimiter(30, 60 * 1000),
};

// Cache for product salt (fetched once per session)
let _productSaltCache: { salt: string; version: number } | null = null;
let _txQuotaCache: number | null = null;

function classifyCloudError(error: any): 'not-found' | 'network' {
  const status = Number(error?.status || error?.statusCode || 0);
  const code = String(error?.code || '').toUpperCase();
  if (status === 404 || code === 'PGRST116') return 'not-found';
  return 'network';
}

// ===== Client accessor =====
function getSupabaseClient(): any {
  if (isDemoMode) return null;
  const sb = supabase as any;
  if (!sb || isPlaceholderKey(sb?.supabaseUrl)) return null;
  return sb;
}

/**
 * Baca baris lisensi via unit_id — kunci natural yang stabil. (Dulu via
 * device_code; fingerprint lama bisa mengubah device_code pada perangkat
 * yang sama, sedangkan unit_id kekal — lihat getUnitId yang mempertahankan
 * nilai tersimpan. tx_month/tx_used/tx_adjust ikut dibaca utk reconcile.)
 */
export type RowRead = { kind: 'ok'; data: any } | { kind: 'not-found'; error?: any } | { kind: 'network'; error?: any };

async function readLicenseRow(sb: any, unitId: string): Promise<RowRead> {
  try {
    const { data, error } = await sb
      .from('clients')
      .select('license_status, license_serial, license_expires_at, first_seen, tx_month, tx_used, tx_adjust, tx_updated_at, nama_usaha, no_whatsapp')
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

/** Cek apakah perangkat fisik sudah terdaftar di cloud. true/false/null(gagal). */
async function isKnownDevice(sb: any, deviceCode: string): Promise<boolean | null> {
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

/**
 * Pastikan ada session anonim yang membawa claim unit_id di metadata.
 * RLS clients: auth.uid() = user_id ATAU unit_id claim JWT = clients.unit_id.
 * Return { ok, userId? }; tidak pernah throw.
 */
export async function ensureAuthSession(sb: any): Promise<{ ok: boolean; reason?: string; userId?: string }> {
  try {
    if (!sb) return { ok: false, reason: 'no-client' };
    const unitId = await getUnitId();
    const { data: sessData } = await sb.auth.getSession();
    if (sessData?.session?.user?.id) {
      const metaUnit = sessData.session.user.user_metadata?.unit_id;
      if (!metaUnit || metaUnit !== unitId) {
        try { await sb.auth.updateUser({ data: { unit_id: unitId } }); } catch (_) { /* metadata opsional */ }
      }
      return { ok: true, userId: sessData.session.user.id };
    }
    const anon = await sb.auth.signInAnonymously({ options: { data: { unit_id: unitId } } } as any);
    if (anon?.error) {
      // Beberapa versi supabase-js tidak mendukung options.data → plain sign-in.
      const plain = await sb.auth.signInAnonymously();
      if (plain?.error) return { ok: false, reason: 'sign-in' };
      return { ok: true, userId: plain?.data?.session?.user?.id };
    }
    return { ok: true, userId: anon?.data?.session?.user?.id };
  } catch (_) {
    return { ok: false, reason: 'exception' };
  }
}

/**
 * 'found' | 'missing' | 'error'. Re-check definitif pakai session JWT —
 * baris tidak terlihat RLS ≠ terhapus. Kalau setelah ini masih hilang,
 * baru boleh revoke.
 */
export async function recheckRowWithSession(sb: any): Promise<'found' | 'missing' | 'error'> {
  try {
    const sess = await ensureAuthSession(sb);
    if (!sess.ok) return 'error';
    const re = await readLicenseRow(sb, await getUnitId());
    if (re.kind === 'ok') return 'found';
    if (re.kind === 'not-found') return 'missing';
    return 'error';
  } catch (_) {
    return 'error';
  }
}

// ===== Salt produk (products.salt — kolom asli `kode_produk` & `salt`) =====
export async function fetchProductSalt(): Promise<{ salt: string; version: number } | null> {
  if (_productSaltCache) return _productSaltCache;
  const sb = getSupabaseClient();
  if (!sb) return getLocalFallbackSalt();
  try {
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
      const result = { salt: String(data.salt), version: 2 };
      _productSaltCache = result;
      return result;
    }
    console.warn('[LICENSE] No salt found in products table for', PRODUCT_PREFIX);
    return getLocalFallbackSalt();
  } catch (e: any) {
    console.warn('[LICENSE] Error fetching product salt:', e?.message || e);
    return getLocalFallbackSalt();
  }
}

function getLocalFallbackSalt(): { salt: string; version: number } {
  const fallback = { salt: 'KASIRSOLO-MINIMARKET-HMAC-V1', version: 2 };
  _productSaltCache = fallback;
  return fallback;
}

/** Clear salt cache (rotasi manual / testing). */
export function clearProductSaltCache() {
  _productSaltCache = null;
}

// ===== Kuota transaksi global (products.tx_quota) =====
// Cache memori + settings.trialConfig → tetap tahu kuota saat offline.
export async function fetchTxQuotaConfig(): Promise<number | null> {
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
  } catch (e: any) {
    console.warn('fetchTxQuotaConfig:', e?.message || e);
    return null;
  }
}

/**
 * Sync local license state to Supabase and apply only authoritative results.
 * (Signature kaki5: tanpa opts; force = panggil ulang menembus rate limit
 * dengan kunci unik — dipakai ensureSynced boot.)
 */
export async function syncLicenseStatus(opts?: { force?: boolean }): Promise<{ ok: boolean; reason?: string; cloud?: any; revoked?: boolean }> {
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
    // Baris hilang hanya otoritatif bagi perangkat yang sudah dikenal lokal
    // atau dikonfirmasi RPC claim; perangkat baru pertama kali tidak di-revoke.
    if (known === true || local.status === 'active' || local.status === 'revoked') {
      const recheck = await recheckRowWithSession(sb);
      if (recheck === 'found') {
        result = await readLicenseRow(sb, unitId);
      } else if (recheck === 'missing') {
        await markLicenseRevoked('not-found');
        return { ok: false, reason: 'not-found', revoked: true };
      } else {
        return { ok: false, reason: 'network' };
      }
    } else {
      return { ok: false, reason: 'not-found' };
    }
  }
  if (result.kind !== 'ok') return { ok: false, reason: 'network' };

  const cloud = result.data;
  // Check-in online → budget offline tersetel ulang.
  try {
    const dc = await getDeviceCode();
    await quotaMarkOnline(getSetting, setSetting, hmacSignature, dc, Date.now());
  } catch (_) { /* non-kritikel */ }

  // ===== Reconcile kuota transaksi (cloud = sumber kebenaran) =====
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
      const cloudNewer = cloudT > myPushT + 5000;
      const adminReset = !cloudMonth && cloudNewer; // admin reset → tx_month null
      let lic = local;
      if ((Number(lic.txAdjust) || 0) !== cloudAdjust) lic = { ...lic, txAdjust: cloudAdjust };
      if (adminReset) {
        lic = { ...lic, txMonth: month, txUsed: 0 };
      } else if (cloudMonth && cloudMonth > (lic.txMonth || '')) {
        lic = { ...lic, txMonth: cloudMonth, txUsed: cloudUsed };
      } else if (cloudMonth === lic.txMonth && cloudUsed > (Number(lic.txUsed) || 0)) {
        lic = { ...lic, txUsed: cloudUsed };
      }
      if (lic !== local) await saveLicense(lic);
      const effUsed = lic.txMonth === month ? (Number(lic.txUsed) || 0) : 0;
      if ((cloudMonth === month && cloudUsed < effUsed) || (cloudMonth !== month && (effUsed > 0 || !adminReset))) {
        const { error: txErr } = await sb.from('clients')
          .update({ tx_month: month, tx_used: effUsed, tx_updated_at: new Date().toISOString() })
          .eq('unit_id', unitId);
        if (!txErr) await setSetting('txLastPushAt', Date.now());
        else console.warn('sync tx_used:', txErr.message || txErr);
      }
    }
  } catch (e: any) {
    console.warn('reconcile kuota gagal:', e?.message || e);
  }

  const status = String(cloud.license_status || '').toLowerCase();
  if (status === 'batal' || status === 'nonaktif' || status === 'revoked') {
    await markLicenseRevoked('admin');
    return { ok: false, reason: 'revoked', revoked: true };
  }
  // 'belum'/'' = cloud tidak mencatat lisensi terjual → cache aktif lokal
  // adalah basi; TURUNKAN ke tier gratis (bukan revoke).
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
      console.warn('[LICENSE] lisensi aktif lokal diturunkan ke trial (cloud=belum)');
    }
  }
  // Pemulihan revoke palsu: revoke 'not-found' padahal barisnya ADA → bersihkan.
  {
    const local = await getLicense();
    if (local.status === 'revoked' && local.revokedReason === 'not-found') {
      await clearLocalLicense();
    }
  }
  if (status === 'aktif' && cloud.license_serial) {
    // Guard tabrakan identitas — sesama HP bisa menghasilkan unit_id identik.
    if (await cloudProfileMatchesLocal(cloud)) {
      const local = await getLicense();
      if (local.status !== 'active' || local.serial !== cloud.license_serial) {
        await activateSerial(cloud.license_serial);
      }
    } else {
      console.warn('[LICENSE] adopsi cloud DITOLAK — profil tidak cocok (indikasi tabrakan identitas)');
    }
  }
  // Normalisasi deviceCode record (kode tercemat bisa basi pasca konvergensi).
  try {
    const licNow = await getLicense();
    const curDc = await getDeviceCode();
    if (licNow && licNow.status && licNow.deviceCode && licNow.deviceCode !== curDc) {
      await saveLicense({ ...licNow, deviceCode: curDc });
    }
  } catch (_) { /* tampilan tetap benar via getLicenseStatus */ }
  await setSetting(LICENSE_SYNC_KEY, { lastSuccessfulSync: new Date().toISOString() });
  await bumpClockAnchor(); // sync sukses = bukti app hidup di momen ini
  return { ok: true, cloud };
}

/**
 * Verifikasi & assign serial via RPC `device_assign` (1 serial = 1 unit_id =
 * 1 profil). Profil lokal dicocokkan (nama usaha / no WA) — mismatch ditolak.
 */
export async function verifyAndAssignSerial(serial: string, unitId?: string): Promise<{ ok: boolean; reason?: string; message?: string }> {
  const sb = getSupabaseClient();
  if (!sb) return { ok: false, reason: 'network' };
  try {
    const profile = await readLocalProfile();
    const deviceCode = await getDeviceCode();
    const installId = await getInstallIdSafe();
    const { data, error } = await sb.rpc('device_assign', {
      p_serial: serial,
      p_profile: profile,
      p_new_unit_id: unitId || (await getUnitId()),
      p_new_device_code: deviceCode,
      p_new_install_id: installId,
      p_app_type: APP_TYPE
    });
    if (error) {
      console.warn('[ASSIGN] device_assign RPC error:', error?.message || error);
      throw error;
    }
    const res: any = data || {};
    if (!res.ok) {
      console.warn('[ASSIGN] ditolak:', res.reason);
      return { ok: false, reason: res.reason || 'rejected' };
    }
    return { ok: true, reason: res.reason || 'assigned' };
  } catch (e: any) {
    console.warn('[ASSIGN] gagal panggil device_assign:', e?.message || e);
    return { ok: false, reason: 'network' };
  }
}

async function getInstallIdSafe(): Promise<string> {
  try {
    const id = await getDeviceIdentity();
    return id.installId || '';
  } catch (_) { return ''; }
}

/** Profil klien lokal (settings) untuk guard tabrakan identitas. */
async function readLocalProfile(): Promise<{ nama_usaha: string; nama_pemilik: string; no_whatsapp: string }> {
  const namaUsaha = String(await getSetting('namaUsaha', '') || '') || String(await getSetting('namaWarung', '') || '');
  const namaPemilik = String(await getSetting('namaPemilik', '') || '');
  const noWhatsapp = String(await getSetting('noWhatsapp', '') || '');
  return { nama_usaha: namaUsaha, nama_pemilik: namaPemilik, no_whatsapp: noWhatsapp };
}

/**
 * Gate boot: sinkronisasi awal yang awaited — layer UI tidak pernah
 * menampilkan state perangkat yang belum selesai diverifikasi. Kegagalan
 * (offline/demo/RLS) TIDAK memblokir boot: state lokal dipakai, keputusan
 * revoke hanya dari syncLicenseStatus yang otoritatif.
 */
export async function ensureSynced(): Promise<void> {
  try {
    await syncLicenseStatus({ force: true });
    // Bersihkan unitId legacy-format (pra 'MML-'/'K5-' canonical) bila cloud
    // sudah konfirmasi sinkron → bukan perangkat asing lagi.
    const last = await getSetting(LICENSE_SYNC_KEY, null) as any;
    if (last && last.lastSuccessfulSync) {
      try { await db.settings.where('key').equals('legacyUnitId').delete(); } catch (_) { /* noop */ }
    }
  } catch (e) {
    console.warn('[LICENSE] ensureSynced gagal (lanjut state lokal):', e);
  }
}

/** Baca status lisensi langsung dari cloud (null bila gagal/tidak ada). */
export async function fetchLicenseStatusFromCloud(): Promise<any | null> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  const unitId = await getUnitId();
  const result = await readLicenseRow(sb, unitId);
  if (result.kind === 'ok') return result.data;
  if (result.kind === 'not-found') return null;
  console.warn('fetchLicenseStatusFromCloud:', (result as any).error?.message || (result as any).error || result.kind);
  return null;
}

/** Ambil nilai key dari tabel `settings` cloud (jsonb); null bila gagal. */
export async function fetchSetting(key: string): Promise<any> {
  const sb = getSupabaseClient();
  if (!sb) return null;
  try {
    const { data, error } = await sb.from('settings').select('value').eq('key', key).maybeSingle();
    if (error || !data) return null;
    const v = data.value;
    if (typeof v === 'string') { try { return JSON.parse(v); } catch { return v; } }
    return v || null;
  } catch (e) {
    console.warn('fetchSetting:', e);
    return null;
  }
}
