// ==================== SINKRONISASI PROFIL KLIEN → SUPABASE (CRM) ====================
// Mengirim profil identitas outlet (nama usaha, pemilik, WA, wilayah, device code)
// dari Dexie lokal ke tabel `clients` di Supabase.
//
// Fitur:
//  * OFFLINE-FIRST — app tetap jalan tanpa internet. Sync hanya dicoba saat online.
//  * DUA SKENARIO:
//     - User BARU → dipanggil setelah selesai onboarding / aktivasi.
//     - User LAMA (data cuma lokal, belum pernah sync) → di boot otomatis di-push
//       lewat flag lokal `sync` (none → synced / pending). Inilah "backfill".
//  * SELF-HEALING (T29, 2026-08-17): flag `synced` TIDAK dipercaya buta. Minimal
//    1x/hari flag diverifikasi ke server (select murah); kalau baris ternyata
//    tidak ada (mis. pernah "sukses" di era pipeline lama), profil di-push ulang
//    otomatis. Ini menutup kasus "perangkat online tapi profil tak pernah masuk".
//  * OBSERVABILITY: tiap kegagalan nyata dicatat lokal (maks 5 terakhir, untuk
//    panel Diagnosa) DAN dikirim ke tabel `sync_errors` (insert-only via RLS)
//    supaya pola kegagalan lintas perangkat kelihatan dari dashboard.
//  * Dedupe: baris dikenali lewat unit_id; update bila sudah ada, insert bila baru.
//  * Keamanan: pakai Supabase anonymous sign-in; baris `clients` dimiliki user
//    anonim tsb (RLS auth.uid() = user_id). Tiap device cuma bisa ubah barisnya.

import { getSetting, setSetting } from './db.js';
import { showToast, getDeviceInfo } from './helpers.js';
import { getUnitId, getDeviceCode, getInstallId } from './license.js';

const APP_TYPE = 'kaki5';
// Flag "synced" di-cache selama ini lama; lewat dari itu WAJIB verifikasi server.
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;

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

/** Snapshot konfigurasi untuk panel Diagnosa (tanpa menjalankan sync). */
export function getSyncClientDebug() {
  return {
    globalLoaded: !!window.supabase,
    url: window.KASIRSOLO_SUPABASE_URL || null,
    keyPresent: !!window.KASIRSOLO_SUPABASE_ANON_KEY,
    keyLooksReal: !isPlaceholderKey(window.KASIRSOLO_SUPABASE_ANON_KEY),
    clientReady: !!getClient(),
    online: navigator.onLine
  };
}

export async function getSyncState() {
  return (await getSetting('sync', null)) || { status: 'none' };
}

/**
 * Catat kegagalan sync: lokal (untuk panel Diagnosa) + kirim ke `sync_errors`
 * (fire-and-forget). Tidak boleh melempar — pelaporan tidak boleh bikin sync crash.
 */
async function reportSyncError(stage, err) {
  const message = String(err?.message || err || 'unknown');
  try {
    const st = await getSyncState();
    const errs = Array.isArray(st.recentErrors) ? st.recentErrors : [];
    errs.unshift({ stage, message, at: new Date().toISOString() });
    await setSetting('sync', { ...st, recentErrors: errs.slice(0, 5) });
  } catch (_) { /* penyimpanan lokal gagal — tidak ada yang bisa dilakukan */ }
  try {
    const sb = getClient();
    if (!sb || !navigator.onLine) return;
    const unitId = await getUnitId();
    await sb.from('sync_errors').insert({
      unit_id: unitId,
      app_type: APP_TYPE,
      stage,
      error: message.slice(0, 500),
      user_agent: String(navigator.userAgent || '').slice(0, 300)
    });
  } catch (_) { /* server tak terjangkau — sudah tercatat lokal */ }
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

/** Verifikasi murah: apakah baris unit ini memang ada di server? */
async function serverRowExists(sb, unitId) {
  const { data, error } = await sb
    .from('clients')
    .select('unit_id')
    .eq('unit_id', unitId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

/**
 * Sinkronkan profil ke Supabase.
 * @returns Promise<{ok, reason?, stage?, error?}>
 */
export async function ensureSynced({ force = false, silent = false } = {}) {
  const sb = getClient();
  if (!sb) {
    // Komponen/config tidak termuat — kegagalan struktural, hanya catat lokal
    // (tidak bisa kirim ke server karena client-nya memang tidak ada).
    reportSyncError('config', new Error('supabase client tidak tersedia (script/key)'));
    if (!silent) showToast('Komponen sinkronisasi tidak termuat — muat ulang halaman.', 'warning');
    return { ok: false, reason: 'no-config', stage: 'config' };
  }
  if (!navigator.onLine) {
    return { ok: false, reason: 'offline', stage: 'online' };
  }

  const state = await getSyncState();
  if (!force && state.status === 'synced') {
    // SELF-HEALING: flag lokal hanya cache. Kalau belum diverifikasi >24 jam,
    // cek ke server — baris hilang = push ulang, jangan percaya flag buta.
    const verifiedAtMs = state.verifiedAt ? new Date(state.verifiedAt).getTime() : 0;
    if (Date.now() - verifiedAtMs < VERIFY_TTL_MS) {
      return { ok: true, reason: 'already-synced' };
    }
    try {
      const unitId = await getUnitId();
      if (await serverRowExists(sb, unitId)) {
        await setSetting('sync', { ...state, verifiedAt: new Date().toISOString() });
        return { ok: true, reason: 'already-synced' };
      }
      // Baris tidak ada padahal flag bilang synced → lanjut push (self-heal).
      console.warn('[SYNC] Flag lokal "synced" tetapi baris tidak ada di server — push ulang.');
    } catch (e) {
      // Verifikasi gagal (network/RLS) — biarkan proses push di bawah yang bicara.
      await reportSyncError('verify', e);
    }
  }

  // jangan push kalau profil belum diisi
  if (!(await getSetting('namaWarung', ''))) {
    return { ok: false, reason: 'no-profile', stage: 'profile' };
  }

  let stage = 'session';
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
    stage = 'claim';
    const { error: claimErr } = await sb.rpc('device_known', {
      p_unit_id: unitId,
      p_device_code: payload.device_code,
      p_app_type: APP_TYPE
    });
    if (claimErr) throw claimErr;
    stage = 'write';
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
    stage = 'readback';
    if (!(await serverRowExists(sb, unitId))) {
      // Tulis "sukses" tapi baris tak terbaca (indikasi RLS write silently
      // dibuang atau race) — jangan tandai synced.
      throw new Error('baris tidak terbaca setelah tulis (RLS?)');
    }
    await setSetting('sync', {
      status: 'synced',
      syncedAt: new Date().toISOString(),
      verifiedAt: new Date().toISOString(),
      recentErrors: []
    });
    if (!silent) showToast('✅ Profil tersinkron ke server');
    return { ok: true };
  } catch (e) {
    const message = String(e?.message || e);
    await setSetting('sync', {
      status: 'pending',
      lastError: message,
      lastStage: stage,
      lastTryAt: new Date().toISOString()
    });
    await reportSyncError(stage, e);
    if (!silent) showToast('Gagal sinkron (' + stage + '): ' + message.slice(0, 120), 'error', { duration: 5000 });
    return { ok: false, reason: 'error', stage, error: message };
  }
}

// ── Retry otomatis (T29): pending dicoba ulang berkala selama online ──
let _retryTimer = null;
const RETRY_INTERVAL_MS = 5 * 60 * 1000;

export function startSyncRetryLoop() {
  if (_retryTimer) return;
  _retryTimer = setInterval(async () => {
    try {
      if (!navigator.onLine) return;
      const st = await getSyncState();
      if (st.status === 'pending') {
        await ensureSynced({ silent: true });
      }
    } catch (_) { /* retry loop tidak boleh crash */ }
  }, RETRY_INTERVAL_MS);
}
