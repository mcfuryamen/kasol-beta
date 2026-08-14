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
import { showToast, getDeviceInfo } from './helpers.js';
import { getUnitId, getDeviceCode, getInstallId } from './license.js';

const APP_TYPE = 'kaki5';

// Placeholder anon key menghasilkan JWT yang gagal auth → semua sync/purchase
// reject RLS. Deteksi pola placeholder umum (bintang, 'PASTE_', '...', 'xxxx').
function isPlaceholderKey(k) {
  if (!k) return true;
  const s = String(k);
  return (
    s.includes('***') ||
    s.includes('...') ||
    /^PASTE/i.test(s) ||
    /^xxxx/i.test(s) ||
    !s.includes('.') // JWT anon asli selalu punya 3 segmen bertitik
  );
}

function getClient() {
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

export function isSyncConfigured() {
  return !!getClient();
}

async function getSyncState() {
  return (await getSetting('sync', null)) || { status: 'none' };
}

async function buildPayload(unitId) {
  const [namaWarung, pemilik, wa, provId, prov, kabId, kab, kecId, kec, desaId, desa, alamat] =
    await Promise.all([
      getSetting('namaWarung', ''), getSetting('namaPemilik', ''),
      getSetting('noWhatsapp', ''), getSetting('provinsiId', ''),
      getSetting('provinsi', ''),  getSetting('kabkotaId', ''),
      getSetting('kabkota', ''),   getSetting('kecamatanId', ''),
      getSetting('kecamatan', ''), getSetting('desaId', ''),
      getSetting('desa', ''),      getSetting('alamat', '')
    ]);
  const payload = {
    unit_id:      unitId,
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

  // Capture tipe browser & jenis perangkat -> update di tiap sync (bukan cuma
  // onboarding), jadi info di CRM selalu fresh walau user pindah browser/device.
  try {
    const dev = getDeviceInfo();
    payload.browser = dev.browser;
    payload.os = dev.os;
    payload.device_type = dev.deviceType;
    payload.user_agent = dev.userAgent;
    // Simpan lokal juga biar terakhir-terlihat (tanpa nunggu sync berikutnya)
    await setSetting('deviceInfo', dev).catch(() => {});
  } catch (_devErr) {
    // detection gagal -> biarkan kosong, jangan blokir sync
  }
  return payload;
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
    const unitId = await getUnitId();
    let userId = null;
    const { data: sessData } = await sb.auth.getSession();
    if (sessData?.session?.user?.id) {
      userId = sessData.session.user.id;
      // Sesi lama tanpa claim unit_id di user_metadata: update metadata biar
      // claim refresh & jalur policy 'unit_id' aktif walau anon session ganti.
      const metaUnit = sessData.session.user.user_metadata?.unit_id;
      if (!metaUnit || metaUnit !== unitId) {
        try {
          await sb.auth.updateUser({ data: { unit_id: unitId } });
        } catch (_claimErr) {
          console.warn('claim unit_id skipped:', _claimErr?.message || _claimErr);
        }
      }
    } else {
      const { data: anon, error: auErr } = await sb.auth
        .signInAnonymously({ options: { data: { unit_id: unitId } } });
      if (auErr) throw auErr;
      userId = anon?.user?.id;
    }
    const payload = await buildPayload(unitId);
    // Klaim device lama lebih dulu agar update profil tidak mentok RLS
    // saat browser/storage anonim berubah.
    const { error: claimErr } = await sb.rpc('device_known', {
      p_unit_id: unitId,
      p_device_code: payload.device_code,
      p_app_type: APP_TYPE
    });
    if (claimErr) throw claimErr;
    const { data: existing } = await sb
      .from('clients')
      .select('unit_id')
      .eq('unit_id', unitId)
      .maybeSingle();
    const { error: upErr } = existing
      ? await sb.from('clients').update({ ...payload, user_id: userId }).eq('unit_id', unitId)
      : await sb.from('clients').insert({ ...payload, user_id: userId });
    if (upErr) throw upErr;
    // Pipeline marketing kini ada DI clients (leads/pembelian lama sudah
    // dikonsolidasi). Profil tidak boleh me-reset status yang sudah dimajukan
    // admin, jadi `source` & `status` hanya di-set saat baris masih baru
    // (status null/'' ) lewat PATCH selektif — bukan lewat upsert profil.
    try {
      const { data: cur } = await sb
        .from('clients')
        .select('status, source')
        .eq('unit_id', payload.unit_id)
        .maybeSingle();
      const needSeed = !cur || !cur.status || cur.status === '' || cur.status === null;
      if (needSeed) {
        await sb.from('clients').update({
          source: 'app-' + payload.app_type,
          status: 'baru'
        }).eq('unit_id', payload.unit_id);
      } else if (!cur.source) {
        await sb.from('clients').update({
          source: 'app-' + payload.app_type
        }).eq('unit_id', payload.unit_id);
      }
    } catch (_leadErr) {
      console.warn('pipeline seed skipped (clients):', _leadErr?.message || _leadErr);
    }
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
