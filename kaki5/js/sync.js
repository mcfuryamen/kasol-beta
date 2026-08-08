// ==================== SINKRONISASI PROFIL KLIEN → SUPABASE (CRM) ====================
// Mengirim profil identitas outlet (nama usaha, pemilik, WA, wilayah, device code)
// dari Dexie lokal ke tabel `clients` di Supabase.
//
// Fitur:
//  * OFFLINE-FIRST — app tetap jalan tanpa internet. Sync hanya dicoba saat online.
//  * DUA SKENARIO:
//     - User BARU → dipanggil setelah selesai onboarding / aktivasi.
//     - User LAMA (data cuma lokal, belum pernah sync) → di boot otomatis di-push
//       SEKALI lewat flag lokal `sync` (none → synced / pending). Inilah "backfill".
//  * Dedupe: ON CONFLICT (unit_id) DO UPDATE → sync ulang = update, bukan duplikat.
//  * Keamanan: pakai Supabase anonymous sign-in; baris `clients` dimiliki user
//    anonim tsb (RLS auth.uid() = user_id). Tiap device cuma bisa ubah barisnya.

import { getSetting, setSetting } from './db.js';
import { showToast } from './helpers.js';
import { getUnitId, getDeviceCode, getInstallId } from './license.js';

const APP_TYPE = 'kaki5';

function getClient() {
  if (!window.supabase) return null;
  const url = window.KASIRSOLO_SUPABASE_URL;
  const anon = window.KASIRSOLO_SUPABASE_ANON_KEY;
  if (!url || !anon || anon === 'PASTE_ANON_KEY_DISINI' || anon.includes('...')) return null;
  if (!window._ksrSupabaseClient) {
    window._ksrSupabaseClient = window.supabase.createClient(url, anon, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
  }
  return window._ksrSupabaseClient;
}

export function isSyncConfigured() {
  return !!getClient();
}

async function getSyncState() {
  return (await getSetting('sync', null)) || { status: 'none' };
}

async function buildPayload() {
  const [namaWarung, pemilik, wa, provId, prov, kabId, kab, kecId, kec, desaId, desa, alamat] =
    await Promise.all([
      getSetting('namaWarung', ''), getSetting('namaPemilik', ''),
      getSetting('noWhatsapp', ''), getSetting('provinsiId', ''),
      getSetting('provinsi', ''),  getSetting('kabkotaId', ''),
      getSetting('kabkota', ''),   getSetting('kecamatanId', ''),
      getSetting('kecamatan', ''), getSetting('desaId', ''),
      getSetting('desa', ''),      getSetting('alamat', '')
    ]);
  return {
    unit_id:      await getUnitId(),
    app_type:     APP_TYPE,
    device_code:  await getDeviceCode(),
    install_id:   await getInstallId(),
    nama_warung:  namaWarung,
    nama_pemilik: pemilik,
    no_whatsapp:  wa,
    provinsi_id:  provId,  provinsi:  prov,
    kabkota_id:   kabId,   kabkota:   kab,
    kecamatan_id: kecId,   kecamatan: kec,
    desa_id:      desaId,  desa:      desa,
    alamat_detail: alamat,
    last_seen:    new Date().toISOString()
  };
}

/**
 * Sinkronkan profil ke Supabase.
 * @returns Promise<{ok, reason}>
 */
export async function ensureSynced({ force = false, silent = false } = {}) {
  const sb = getClient();
  if (!sb) {
    if (!silent) showToast('Sinkronisasi belum dikonfigurasi (isip anon key)', 'warning');
    return { ok: false, reason: 'no-config' };
  }
  const state = await getSyncState();
  if (!force && state.status === 'synced') {
    return { ok: true, reason: 'already-synced' };
  }
  // jangan push kalau profil belum diisi
  if (!(await getSetting('namaWarung', ''))) {
    return { ok: false, reason: 'no-profile' };
  }

  try {
    // Pakai session yang sudah ada kalau ada (persistSession=true di client config),
    // jangan signIn baru tiap kali — itu bikin user anonim baru & RLS auth.uid() mismatch.
    let userId = null;
    const { data: sessData } = await sb.auth.getSession();
    if (sessData?.session?.user?.id) {
      userId = sessData.session.user.id;
    } else {
      const { data: anon, error: auErr } = await sb.auth.signInAnonymously();
      if (auErr) throw auErr;
      userId = anon?.user?.id;
    }
    const payload = await buildPayload();
    const { error: upErr } = await sb
      .from('clients')
      .upsert({ ...payload, user_id: userId }, { onConflict: 'unit_id' });
    if (upErr) throw upErr;
    await setSetting('sync', { status: 'synced', syncedAt: new Date().toISOString() });
    if (!silent) showToast('✅ Profil tersinkron ke server');
    return { ok: true };
  } catch (e) {
    await setSetting('sync', {
      status: 'pending',
      lastError: String(e?.message || e),
      lastTryAt: new Date().toISOString()
    });
    if (!silent) showToast('Gagal sinkron (cek internet)', 'error');
    return { ok: false, reason: 'offline' };
  }
}
