// ==================== LICENSE SYNC (ESM) ====================
// Supabase activation & status sync. NO DOM operations.
// Cloud-first: lisensi diaktifkan OTOMATIS oleh admin lewat edge function
// `activate-license` (PATCH clients.license_*) + Supabase Realtime push.
// User TIDAK perlu request serial manual — cukup beli (QRIS) & tunggu
// verifikasi admin. Input serial manual hanya fallback offline.
import { ensureSynced } from './sync.js';
import { getUnitId, getDeviceCode, getLicense, markLicenseRevoked, bumpClockAnchor } from './license.logic.js';
import { getSetting, setSetting } from './db.js';

const LICENSE_SYNC_KEY = 'licenseSync';
const NETWORK_GRACE_DAYS = 3;

function classifyCloudError(error) {
  const status = Number(error?.status || error?.statusCode || 0);
  const code = String(error?.code || '').toUpperCase();
  if (status === 404 || code === 'PGRST116') return 'not-found';
  return 'network';
}

// Baca baris lisensi via unit_id — kunci natural yang stabil. (Dulu via
// device_code; fingerprint V3/T14 bisa mengubah device_code pada perangkat
// yang sama, sedangkan unit_id kekal — lihat getUnitId yang mempertahankan
// nilai tersimpan. first_seen ikut dibaca untuk jangkar trial T12.)
async function readLicenseRow(sb, unitId) {
  try {
    const { data, error } = await sb
      .from('clients')
      .select('license_status, license_serial, license_expires_at, first_seen')
      .eq('unit_id', unitId)
      .eq('app_type', 'kaki5')
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
      p_unit_id: unitId, p_device_code: deviceCode, p_app_type: 'kaki5'
    });
    return error ? null : data === true;
  } catch (_) {
    return null;
  }
}

export { NETWORK_GRACE_DAYS };

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

/** Sync local license state to Supabase and apply only authoritative results. */
export async function syncLicenseStatus() {
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
  const status = String(cloud.license_status || '').toLowerCase();
  if (status === 'batal' || status === 'nonaktif' || status === 'revoked') {
    await markLicenseRevoked('admin');
    return { ok: false, reason: 'revoked', revoked: true };
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
    if (local.status !== 'active' || local.serial !== cloud.license_serial) {
      const { activateSerial } = await import('./license.logic.js');
      await activateSerial(cloud.license_serial);
    }
  }
  await setSetting(LICENSE_SYNC_KEY, { lastSuccessfulSync: new Date().toISOString() });
  await bumpClockAnchor(); // T13: sync sukses = bukti app hidup di momen ini
  return { ok: true, cloud };
}

export async function getLicenseSyncState() {
  return (await getSetting(LICENSE_SYNC_KEY, null)) || {};
}

export async function isWithinLicenseGracePeriod() {
  const state = await getLicenseSyncState();
  if (!state.lastSuccessfulSync) return false;
  return Date.now() - new Date(state.lastSuccessfulSync).getTime() <= NETWORK_GRACE_DAYS * 86400000;
}

/**
 * Activate license via Supabase (cloud target).
 * Aktivasi resmi dilakukan admin dari sisi server (edge fn activate-license).
 * Di klien: simpan serial yang diberikan lewat validasi HMAC lokal sebagai
 * otorisasi offline fallback (mis. admin sudah mengirim kode via WA).
 * Catatan: jalur normal = beli QRIS -> admin verifikasi -> realtime auto-aktif.
 */
export async function activateLicenseCloud(serial, db) {
  const { activateSerial } = await import('./license.logic.js');
  return activateSerial(serial);
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
      p_app_type: 'kaki5'
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
 * first_seen } bila baris ditemukan, atau null bila gagal / tidak ada.
 * first_seen dipakai sebagai jangkar trial (T12) oleh continueKnownDevice.
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
