// ==================== LICENSE SYNC (ESM) ====================
// Supabase activation & status sync. NO DOM operations.
// Cloud-first: lisensi diaktifkan OTOMATIS oleh admin lewat edge function
// `activate-license` (PATCH clients.license_*) + Supabase Realtime push.
// User TIDAK perlu request serial manual — cukup beli (QRIS) & tunggu
// verifikasi admin. Input serial manual hanya fallback offline.
import { ensureSynced } from './sync.js';
import { getUnitId, getDeviceCode } from './license.logic.js';

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

/** Sync local license state to Supabase (cloud target). */
export async function syncLicenseStatus() {
  await ensureSynced({ force: true });
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
 * Cek status lisensi langsung ke Supabase (tabel `clients`).
 * Mengembalikan { license_status, license_serial, license_expires_at } bila
 * baris ditemukan, atau null bila gagal / tidak ada (pakai state lokal).
 */
export async function fetchLicenseStatusFromCloud() {
  const sb = getSupabaseClient();
  if (!sb) return null;
  try {
    // Match by device_code (fingerprint hardware stabil) — unit_id bisa
    // berubah antar-versi/browser, sedangkan device_code tetap & deterministik.
    const device_code = await getDeviceCode();
    const { data, error } = await sb
      .from('clients')
      .select('license_status, license_serial, license_expires_at')
      .eq('device_code', device_code)
      .maybeSingle();
    if (error || !data) return null;
    return data;
  } catch (e) {
    console.warn('fetchLicenseStatusFromCloud:', e?.message || e);
    return null;
  }
}
