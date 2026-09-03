/* =========================================================================
   KASIR SOLO - ROSOK
   license.sync.js — Sinkronisasi lisensi & kuota via Supabase. NO DOM.
   Cloud = sumber kebenaran pengaturan kuota: admin mengatur tx_quota lewat
   kartu produk (tabel products) di aplikasi admin. Client menariknya dan
   meng-cache ke settings.trialConfig supaya tetap jalan offline.

   RLS "clients hybrid" (terverifikasi 2026-09-03): akses anon diberikan ke
   baris milik sendiri setelah signInAnonymously dengan metadata
   { unit_id } — pola sama dengan kaki5. Tanpa JWT, anon tak bisa apa-apa.
   ========================================================================= */
import { setSetting, getSetting, getDeviceInfo } from './utils.js';

const APP_TYPE = 'rosok';
const PRODUCT_PREFIX = 'KSR';

// Placeholder anon key => JWT gagal auth => semua query reject RLS.
// Placeholder = key buatan/dev (bukan JWT asli). Anon key asli SELALU diawali
// 'eyJ' (JWT) — JANGAN menolaknya (bug lama: semua fitur cloud mati diam-diam).
function isPlaceholderKey(k) {
  if (!k) return true;
  const s = String(k);
  return s.includes('***') || s.includes('...') || /^PASTE/i.test(s) || /^xxxx/i.test(s) || !s.includes('.');
}

export function getSupabaseClient() {
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

// ── Infrastruktur sync (adopsi kaki5 sync.js/license.sync.js 2026-09-04) ──

// Bedakan "baris tidak ada" (404/PGRST116) dari kegagalan jaringan — revoke
// /insert hanya boleh diputuskan dari kepastian, bukan dari ketidakjelasan.
function classifyCloudError(error) {
  const status = Number(error?.status || error?.statusCode || 0);
  const code = String(error?.code || '').toUpperCase();
  if (status === 404 || code === 'PGRST116') return 'not-found';
  return 'network';
}

// Klaim kepemilikan baris clients via RPC device_known (SECURITY DEFINER,
// app_type-aware — dipakai bersama lintas aplikasi kasirsolo). Memindahkan
// user_id baris ke sesi anon aktif saat browser/storage berganti, idempoten:
// duplicate-key (23505) = baris sudah ada → anggap sukses.
export async function claimDevice(sb, unitId, deviceCode) {
  try {
    const { error } = await sb.rpc('device_known', {
      p_unit_id: unitId, p_device_code: deviceCode, p_app_type: APP_TYPE
    });
    if (error && error.code !== '23505') {
      console.warn('[CLAIM] device_known:', error.message || error);
      return false;
    }
    return true;
  } catch (e) { console.warn('[CLAIM] device_known gagal:', e?.message || e); return false; }
}

// Salt produk utk validasi serial V2 — sumber kebenaran cloud (products.salt,
// dikelola admin di kartu produk KSR), fallback konstanta build (identik
// historis) bila cloud belum berisi/offline. Port fetchProductSalt kaki5.
const FALLBACK_PRODUCT_SALT = 'KASIRSOLO-ROSOK-HMAC-V2';
let _productSaltCache = null;
export async function fetchProductSalt() {
  if (_productSaltCache) return _productSaltCache;
  const sb = getSupabaseClient();
  if (!sb || !navigator.onLine) return { salt: FALLBACK_PRODUCT_SALT, version: 2 };
  try {
    const { data, error } = await sb
      .from('products')
      .select('salt')
      .eq('kode_produk', PRODUCT_PREFIX)
      .eq('app_type', APP_TYPE)
      .maybeSingle();
    if (!error && data && data.salt) {
      _productSaltCache = { salt: data.salt, version: 2 };
      return _productSaltCache;
    }
  } catch (e) { console.warn('[LICENSE] fetchProductSalt:', e?.message || e); }
  _productSaltCache = { salt: FALLBACK_PRODUCT_SALT, version: 2 };
  return _productSaltCache;
}

export function clearProductSaltCache() { _productSaltCache = null; }

// Baca satu key dari tabel `settings` cloud (jsonb/string) — port fetchSetting
// kaki5. Dipakai app-link (app_links) & purchase (qris_url, bank_info).
export async function fetchSetting(key) {
  const sb = getSupabaseClient();
  if (!sb) return null;
  try {
    const { data, error } = await sb.from('settings').select('value').eq('key', key).maybeSingle();
    if (error || !data) return null;
    const v = data.value;
    if (typeof v === 'string') { try { return JSON.parse(v); } catch { return v; } }
    return v || null;
  } catch (e) { console.warn('fetchSetting:', e?.message || e); return null; }
}

// Observabilitas kegagalan (port reportSyncError kaki5): 5 error terakhir
// disimpan lokal (dipakai panel Diagnosa) DAN dikirim ke tabel sync_errors
// (insert-only via RLS) supaya pola kegagalan lintas perangkat terlihat dari
// dashboard admin. Tidak pernah melempar.
export async function reportSyncError(stage, err) {
  const message = String(err?.message || err || 'unknown');
  try {
    const st = (await getSetting('syncState', null)) || { status: 'none' };
    const errs = Array.isArray(st.recentErrors) ? st.recentErrors : [];
    errs.unshift({ stage, message, at: new Date().toISOString() });
    await setSetting('syncState', { ...st, lastError: message, lastStage: stage, lastTryAt: new Date().toISOString(), recentErrors: errs.slice(0, 5) });
  } catch (_) { /* storage gagal — tak ada yang bisa dilakukan */ }
  try {
    const sb = getSupabaseClient();
    if (!sb || !navigator.onLine) return;
    const unitId = await getSetting('unitId', null);
    if (!unitId) return;
    await sb.from('sync_errors').insert({
      unit_id: unitId, app_type: APP_TYPE, stage,
      error: message.slice(0, 500),
      user_agent: String(navigator.userAgent || '').slice(0, 300)
    });
  } catch (_) { /* server tak terjangkau — sudah tercatat lokal */ }
}

// ── Baca status lisensi cloud (clients) — dipakai purchase.js polling ─────
export async function getCloudLicenseStatus(unitId) {
  const sb = getSupabaseClient();
  if (!sb) return null;
  const s = await ensureSession(sb, unitId).catch(() => null);
  if (!s) return null;
  const { data, error } = await sb.from('clients')
    .select('license_status, license_serial, license_expires_at, status, bukti_url')
    .eq('unit_id', unitId).eq('app_type', APP_TYPE).maybeSingle();
  if (error) { console.warn('getCloudLicenseStatus:', error.message || error); return null; }
  return data || null;
}

// ── Adopsi lisensi cloud → lokal (dipakai realtime/polling purchase.js) ───
export async function persistCloudLicense(cloud) {
  if (!cloud || String(cloud.license_status || '').toLowerCase() !== 'aktif'
      && String(cloud.license_status || '').toLowerCase() !== 'active') return false;
  const local = await getSetting('license', null) || {};
  if (local.status === 'active') return true; // sudah aktif
  const serial = (cloud.license_serial || '').trim().toUpperCase();
  const m = serial.match(/-([A-Z0-9]{2})-[A-Z0-9]{6}$/);
  const lic = {
    status: 'active',
    startedAt: local.startedAt || new Date().toISOString(),
    serial: serial || '',
    deviceCode: local.deviceCode || '',
    expCode: m ? m[1] : (cloud.license_expires_at ? null : '99'),
    expiryDate: cloud.license_expires_at || null,
    expiryLabel: '',
    source: 'cloud'
  };
  await setSetting('license', lic);
  await setSetting('purchaseStatus', '');
  return true;
}

// ===== Kuota transaksi global (products.tx_quota) =====
// Diatur admin lewat kartu produk. Di-cache di memori (sekali per sesi) +
// settings.trialConfig supaya app tetap tahu kuotanya saat offline.
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
    if (error) { console.warn('fetchTxQuotaConfig:', error.message || error); return null; }
    if (!data) return null;
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

// Reset cache kuota transaksi (nama lama `clearProductSaltCache` adalah
// sisa salinan kaki5 yang salah nama — fungsi ini membersihkan _txQuotaCache).
export function clearTxQuotaCache() {
  _txQuotaCache = null;
}

// Segarkan cache kuota dari cloud paling cepat sekali per 15 menit
// (dipanggil dari checkLicenseGate yang jalan tiap 60 detik).
const QUOTA_REFRESH_MS = 15 * 60 * 1000;
let _txQuotaLastFetch = 0;

export async function refreshTxQuotaConfig() {
  const now = Date.now();
  if (now - _txQuotaLastFetch < QUOTA_REFRESH_MS) return null;
  _txQuotaLastFetch = now;
  return await fetchTxQuotaConfig();
}

// Kembalikan kuota efektif dari cache lokal (untuk tampilan saat offline).
export async function getCachedTxQuota() {
  try { return await getSetting('trialConfig', null); } catch (_) { return null; }
}

// ===== Sesi anon per-perangkat (pola kaki5) =====
// unitId identitas stabil di IndexedDB. Pastikan session anon membawa
// metadata unit_id supaya policy hybrid clients mengizinkan baca/tulis
// baris milik perangkat ini. Return sb client (atau null bila offline).
export async function ensureSession(sb, unitId) {
  try {
    const { data: sessData } = await sb.auth.getSession();
    if (!sessData?.session?.user?.id) {
      const { error } = await sb.auth.signInAnonymously({ options: { data: { unit_id: unitId } } });
      if (error) { console.warn('anon sign-in:', error.message || error); return null; }
    } else {
      const metaUnit = sessData.session.user.user_metadata?.unit_id;
      if (!metaUnit || metaUnit !== unitId) {
        try { await sb.auth.updateUser({ data: { unit_id: unitId } }); } catch (_) { /* opsional */ }
      }
    }
    return sb;
  } catch (e) {
    console.warn('ensureSession:', e?.message || e);
    return null;
  }
}

// Baca baris clients milik perangkat ini (termasuk kolom profil & wilayah).
async function readClientRow(sb, unitId) {
  const { data, error } = await sb
    .from('clients')
    .select('license_status, license_serial, license_expires_at, first_seen, tx_month, tx_used, tx_adjust, tx_updated_at, nama_usaha, nama_pemilik, no_whatsapp, provinsi_id, provinsi, kabkota_id, kabkota, kecamatan_id, kecamatan, desa_id, desa, alamat_detail')
    .eq('unit_id', unitId)
    .eq('app_type', APP_TYPE)
    .maybeSingle();
  if (error) return { kind: 'network', error };
  if (!data) return { kind: 'not-found' };
  return { kind: 'ok', data };
}

// ── Peta kolom clients (snake_case) → key settings lokal (camelCase) ──────
// Dipakai pull (cloud → lokal) dan push (lokal → cloud).
const PROFILE_FIELD_MAP = {
  nama_usaha: 'bizName', nama_pemilik: 'ownerName', no_whatsapp: 'bizPhone',
  provinsi_id: 'bizProvinsiId', provinsi: 'bizProvinsi',
  kabkota_id: 'bizKabkotaId', kabkota: 'bizKabkota',
  kecamatan_id: 'bizKecamatanId', kecamatan: 'bizKecamatan',
  desa_id: 'bizDesaId', desa: 'bizDesa',
  alamat_detail: 'alamatDetail'
};

// Tulis profil cloud → lokal. Aturan pemilik (2026-09-04): begitu data ada di
// Supabase, cloud = SUMBER KEBENARAN MUTLAK untuk profil (sama seperti lisensi)
// — nilai cloud MENIMPA lokal, termasuk string kosong (cloud bisa saja sengaja
// membersihkan field). Pengecualian: NULL/undefined = kolom belum pernah
// di-push (baris lama rosok sparse) → jangan sentuh lokal. Ini persis semantik
// pullCloudProfileTo kaki5 (C2v2).
// Penjagaan: bila ada editan user yang BELUM terkirim ke cloud
// (profileSyncPending — mis. simpan saat offline), pull DILEWATI; user-intent
// lokal itulah yang harus sampai ke cloud lebih dulu (pola flag sync kaki5).
async function applyCloudProfile(cloud) {
  if (!cloud) return 0;
  let pending = false;
  try { pending = !!(await getSetting('profileSyncPending', false)); } catch (_) {}
  if (pending) { console.log('[PROFILE] pull dilewati — ada perubahan lokal belum terkirim'); return 0; }
  let changed = 0;
  for (const [col, key] of Object.entries(PROFILE_FIELD_MAP)) {
    const val = cloud[col];
    if (val === null || val === undefined) continue;
    let local;
    try { local = await getSetting(key, undefined); } catch (_) { continue; }
    if (local === val) continue; // cegah write IndexedDB sia-sia (pola kaki5)
    try { await setSetting(key, val); changed++; } catch (_) { /* storage gagal */ }
  }
  if (changed > 0) {
    console.log(`[PROFILE] pull cloud → lokal: ${changed} field disinkron (cloud = kebenaran)`);
    try { if (window._ksr_profilePulled) window._ksr_profilePulled(); } catch (_) {}
  }
  return changed;
}

// Pull mandiri — dipakai saat halaman Pengaturan dibuka (pola kaki5
// loadSettings: tarik dulu, render kemudian). Fire-safe & cepat bila offline.
export async function pullCloudProfile() {
  const sb = getSupabaseClient();
  if (!sb || !navigator.onLine) return { ok: false, reason: 'offline' };
  let unitId = null;
  try { unitId = await getSetting('unitId', null); } catch (_) { return { ok: false, reason: 'storage' }; }
  if (!unitId) return { ok: false, reason: 'no-unit' };
  let s = null;
  try { s = await ensureSession(sb, unitId); } catch (_) {}
  if (!s) return { ok: false, reason: 'session' };
  const r = await readClientRow(sb, unitId);
  if (r.kind !== 'ok') return { ok: false, reason: r.kind };
  const changed = await applyCloudProfile(r.data);
  return { ok: true, changed };
}

// Tulis profil usaha (nama, pemilik, telepon, wilayah) ke baris clients
// (RLS hybrid: baris milik sendiri). Dipanggil tanpa argumen dari app.js
// setelah "Simpan Identitas" = jalur user-intent (setara force kaki5):
// baris ada → update penuh; baris belum ada → insert (bukan update 0-baris
// diam-diam — pelajaran audit P3 2026-09-04).
// Flag profileSyncPending (pola flag `sync` kaki5): dipasang di awal, baru
// dilepas setelah cloud mengonfirmasi tulis — selama terpasang, pull cloud
// ke lokal DILEWATI supaya editan yang belum sampai cloud tidak tertimpa.
export async function pushProfile() {
  try { await setSetting('profileSyncPending', true); } catch (_) {}
  const fail = (res) => ({ ...res, pending: true });
  const sb = getSupabaseClient();
  if (!sb || !navigator.onLine) return fail({ ok: false, reason: 'offline' });
  let unitId = null;
  try { unitId = await getSetting('unitId', null); } catch (_) { return fail({ ok: false, reason: 'storage' }); }
  if (!unitId) return fail({ ok: false, reason: 'no-unit' });
  let s;
  try { s = await ensureSession(sb, unitId); } catch (_) { return fail({ ok: false, reason: 'session' }); }
  if (!s) return fail({ ok: false, reason: 'session' });
  const g = async (k) => { try { return await getSetting(k, ''); } catch (_) { return ''; } };
  let userId = null;
  try { const sess = await sb.auth.getSession(); userId = sess?.data?.session?.user?.id || null; } catch (_) {}
  const deviceCode = await g('deviceCode');
  // Klaim kepemilikan baris lebih dulu (pola kaki5): tanpa ini, update bisa
  // mentok RLS saat baris masih milik sesi anon lama (ganti browser/storage).
  await claimDevice(sb, unitId, deviceCode);
  const payload = {};
  for (const [col, key] of Object.entries(PROFILE_FIELD_MAP)) payload[col] = await g(key);
  // Identitas & telemetri perangkat (kolom CRM clients — port buildPayload kaki5):
  // device_code, install_id, last_seen, browser/os/device_type/user_agent.
  payload.device_code = deviceCode;
  payload.install_id = await g('deviceId');
  payload.last_seen = new Date().toISOString();
  try {
    const dev = getDeviceInfo();
    payload.browser = dev.browser; payload.os = dev.os;
    payload.device_type = dev.deviceType; payload.user_agent = dev.userAgent;
  } catch (_) { /* deteksi gagal → biarkan kosong, jangan blokir sync */ }
  try {
    const { data: existing, error: selErr } = await sb
      .from('clients').select('unit_id')
      .eq('unit_id', unitId).eq('app_type', APP_TYPE).maybeSingle();
    if (selErr) { console.warn('pushProfile select:', selErr.message || selErr); return fail({ ok: false, error: selErr.message }); }
    let error = null;
    if (existing) {
      ({ error } = await sb.from('clients').update(payload)
        .eq('unit_id', unitId).eq('app_type', APP_TYPE));
    } else {
      let deviceCode = '';
      try { deviceCode = await getSetting('deviceCode', ''); } catch (_) {}
      ({ error } = await sb.from('clients').insert({
        unit_id: unitId, app_type: APP_TYPE, device_code: deviceCode,
        user_id: userId, tx_used: 0, tx_adjust: 0, ...payload
      }));
    }
    if (error) { console.warn('pushProfile:', error.message || error); await reportSyncError('write', error); return fail({ ok: false, error: error.message }); }
    // Seed pipeline (pola kaki5): `source`/`status` HANYA diisi saat baris masih
    // kosong status — tidak pernah me-reset status yang sudah dimajukan admin.
    try {
      const { data: cur } = await sb.from('clients').select('status, source')
        .eq('unit_id', unitId).eq('app_type', APP_TYPE).maybeSingle();
      if (cur && (!cur.status || String(cur.status).trim() === '')) {
        await sb.from('clients').update({ source: 'app-' + APP_TYPE, status: 'baru' }).eq('unit_id', unitId).eq('app_type', APP_TYPE);
      } else if (cur && !cur.source) {
        await sb.from('clients').update({ source: 'app-' + APP_TYPE }).eq('unit_id', unitId).eq('app_type', APP_TYPE);
      }
    } catch (e) { console.warn('seed pipeline skipped:', e?.message || e); }
    // Readback (pola kaki5): tulis "sukses" tapi baris tak terbaca kembali =
    // RLS write dibuang diam-diam / race → JANGAN anggap tersinkron.
    {
      const { data: back } = await sb.from('clients').select('unit_id')
        .eq('unit_id', unitId).eq('app_type', APP_TYPE).maybeSingle();
      if (!back) {
        const err = new Error('baris tidak terbaca setelah tulis (RLS?)');
        await reportSyncError('readback', err);
        return fail({ ok: false, error: err.message });
      }
    }
    // Cloud sudah menerima → flag dilepas, pull cloud-ke-lokal boleh jalan lagi.
    try {
      await setSetting('profileSyncPending', false);
      const st = (await getSetting('syncState', null)) || {};
      await setSetting('syncState', { ...st, status: 'synced', syncedAt: new Date().toISOString(), recentErrors: [] });
    } catch (_) {}
    return { ok: true };
  } catch (e) { console.warn('pushProfile:', e?.message || e); await reportSyncError('push', e); return fail({ ok: false, error: e?.message || e }); }
}

// ===== Sinkron dua-arah penghitung kuota + adopsi lisensi cloud =====
// Reconcile (cloud = sumber kebenaran angka ADMIN; penghitung = max):
// - tx_adjust milik admin → selalu ikut cloud.
// - cloud tx_used lebih besar → adopsi (hapus data/ganti browser tak
//   menurunkan penghitung); lokal lebih besar → push (pemakaian offline).
// - tulisan cloud lebih baru dari push terakhir KITA = aktivasi/reset admin.
// - lisensi aktif di cloud (admin aktivasi manual) → diadopsi lokal.
// Semua failure non-fatal: app tetap jalan offline pakai data lokal.
export async function syncLicenseStatus(unitId, licenseApi) {
  const sb = getSupabaseClient();
  if (!sb || !navigator.onLine) return { ok: false, reason: 'offline' };
  let sessionSb;
  try {
    sessionSb = await ensureSession(sb, unitId);
  } catch (e) {
    return { ok: false, reason: 'session', error: e?.message || e };
  }
  if (!sessionSb) return { ok: false, reason: 'session' };

  // User-intent yang belum terkirim (mis. simpan profil saat offline) →
  // push DULU, baru pull/adopsi. Cloud baru menjadi kebenaran setelah data
  // user benar-benar sampai ke sana (pola flag pending kaki5).
  try { if (await getSetting('profileSyncPending', false)) await pushProfile(); } catch (_) {}

  // Klaim kepemilikan baris sebelum baca (pola kaki5 C2v3): memindahkan
  // user_id ke sesi anon aktif bila perlu, supaya select/update lolos RLS
  // walau perangkat pindah browser.
  try { await claimDevice(sessionSb, unitId, licenseApi.getDeviceCode()); } catch (_) {}

  let result;
  try { result = await readClientRow(sessionSb, unitId); }
  catch (e) { return { ok: false, reason: 'network', error: e?.message || e }; }
  if (result.kind === 'not-found') {
    // Perangkat belum dikenal cloud → daftarkan baris baru (self-insert).
    // user_id = auth.uid() sesi anon ini (policy storage & policy kaki5 mengikat lewat ini).
    try {
      let _uid = null;
      try { const sess = await sessionSb.auth.getSession(); _uid = sess?.data?.session?.user?.id || null; } catch (_) {}
      const ins = await sessionSb.from('clients')
        .insert({ unit_id: unitId, app_type: APP_TYPE, device_code: licenseApi.getDeviceCode(), user_id: _uid, tx_used: 0, tx_adjust: 0 });
      if (ins.error) return { ok: false, reason: 'insert', error: ins.error.message };
      result = await readClientRow(sessionSb, unitId);
      if (result.kind !== 'ok') return { ok: false, reason: 'after-insert-' + result.kind };
    } catch (e) {
      return { ok: false, reason: 'insert', error: e?.message || e };
    }
  } else if (result.kind !== 'ok') {
    return { ok: false, reason: result.kind, error: result.error?.message };
  }

  const cloud = result.data;

  // (A) Adopsi lisensi aktif dari cloud (admin aktivasi manual tanpa serial
  //     lokal — sumber kebenaran = server, pembayaran sudah diverifikasi).
  try {
    const cloudActive = String(cloud.license_status || '').toLowerCase() === 'aktif'
      || String(cloud.license_status || '').toLowerCase() === 'active';
    const local = await licenseApi.getLicense();
    if (cloudActive && local.status !== 'active') {
      const expCode = (cloud.license_serial || '').trim().toUpperCase().match(/-([A-Z0-9]{2})-[A-Z0-9]{6}$/);
      await licenseApi.saveLicense({
        status: 'active',
        startedAt: (await getSetting('licenseActivatedAt', null)) || new Date().toISOString(),
        serial: (cloud.license_serial || '').trim().toUpperCase(),
        deviceCode: licenseApi.getDeviceCode(),
        expCode: expCode ? expCode[1] : (cloud.license_expires_at ? null : '99'),
        expiryLabel: '',
        expiryDate: cloud.license_expires_at || null,
        source: 'cloud'
      });
    }
  } catch (e) { console.warn('adopsi lisensi cloud:', e?.message || e); }

  // (A1) Cloud = kebenaran mutlak utk lisensi (aturan pemilik 2026-09-04;
  //      port kaki5 pasca-insiden "chip zombie" v101): status cloud mencabut
  //      atau BELUM mencatat lisensi terjual → lokal 'active' adalah cache
  //      basi dan WAJIB diturunkan ke tier gratis kuota. 'belum'/'' = kembali
  //      ke gratis (bukan hukuman); 'batal/nonaktif/revoked' = pencabutan admin.
  try {
    const stCloud = String(cloud.license_status || '').toLowerCase();
    const revoked = stCloud === 'batal' || stCloud === 'nonaktif' || stCloud === 'revoked';
    const belum = stCloud === 'belum' || stCloud === '';
    if (revoked || belum) {
      const local = await licenseApi.getLicense();
      if (local.status === 'active') {
        const month = licenseApi.currentTxMonth();
        await licenseApi.saveLicense({
          status: 'trial',
          txMonth: month,
          txUsed: local.txMonth === month ? (Number(local.txUsed) || 0) : 0,
          txAdjust: Number(cloud.tx_adjust) || 0,
          deviceCode: local.deviceCode || licenseApi.getDeviceCode(),
          downgradedFrom: 'active',
          downgradedAt: new Date().toISOString(),
          downgradedReason: revoked ? 'cloud-' + stCloud : 'cloud-belum'
        });
        console.warn('[LICENSE] Lisensi lokal diturunkan — cloud:', stCloud || '(kosong)');
      }
    }
  } catch (e) { console.warn('downgrade lisensi cloud:', e?.message || e); }

  // (A2) Adopsi profil (nama/pemilik/telepon/wilayah) dari cloud bila lokal
  //      masih kosong (pull ala kaki5, diperluas — lihat applyCloudProfile).
  try { await applyCloudProfile(cloud); } catch (e) { console.warn('adopsi profil:', e?.message || e); }

  // (B) Reconcile penghitung kuota (hanya relevan saat tier gratis).
  try {
    const local = await licenseApi.getLicense();
    if (local.status === 'trial') {
      const month = licenseApi.currentTxMonth();
      const cloudMonth = cloud.tx_month || null;
      const cloudUsed = Number(cloud.tx_used) || 0;
      const cloudAdjust = Number(cloud.tx_adjust) || 0;
      const cloudT = cloud.tx_updated_at ? new Date(cloud.tx_updated_at).getTime() : 0;
      let myPushT = 0;
      try { myPushT = Number(await getSetting('txLastPushAt', 0)) || 0; } catch (_) { /* storage gagal */ }
      const cloudNewer = cloudT > myPushT + 5000;
      const adminReset = !cloudMonth && cloudNewer; // admin reset pakai (tx_month null)
      let lic = local;
      if ((Number(lic.txAdjust) || 0) !== cloudAdjust) lic = { ...lic, txAdjust: cloudAdjust };
      if (adminReset) {
        lic = { ...lic, txMonth: month, txUsed: 0 };
      } else if (cloudMonth && cloudMonth > (lic.txMonth || '')) {
        // Rollover tercatat di cloud / jam lokal mundur → ikut cloud.
        lic = { ...lic, txMonth: cloudMonth, txUsed: cloudUsed };
      } else if (cloudMonth === lic.txMonth && cloudUsed > (Number(lic.txUsed) || 0)) {
        // Hapus data / ganti browser tidak boleh menurunkan penghitung.
        lic = { ...lic, txUsed: cloudUsed };
      }
      if (lic !== local) await licenseApi.saveLicense(lic);
      const effUsed = lic.txMonth === month ? (Number(lic.txUsed) || 0) : 0;
      // Push lokal → cloud: rollover bulan, atau pemakaian offline bulan
      // berjalan yang belum terkirim (tidak pernah menimpa tulisan admin).
      if ((cloudMonth === month && cloudUsed < effUsed) || (cloudMonth !== month && (effUsed > 0 || !adminReset))) {
        const { error: txErr } = await sessionSb.from('clients')
          .update({ tx_month: month, tx_used: effUsed, tx_updated_at: new Date().toISOString() })
          .eq('unit_id', unitId);
        if (!txErr) await setSetting('txLastPushAt', Date.now());
        else console.warn('sync tx_used:', txErr.message || txErr);
      }
    }
  } catch (e) {
    console.warn('reconcile kuota gagal:', e?.message || e);
  }

  // Sync penuh sukses = bukti app hidup di momen ini (T13 kaki5): majukan
  // anchor jam anti-rollback + catat waktu sync sukses utk panel Diagnosa.
  try {
    await setSetting('licenseSync', { lastSuccessfulSync: new Date().toISOString() });
    if (licenseApi.bumpClockAnchor) await licenseApi.bumpClockAnchor();
  } catch (_) { /* storage gagal */ }

  return { ok: true, cloud };
}

// Verifikasi & assign serial manual (Opsi 3 kaki5: 1 serial = 1 unit = 1
// profil) via RPC `device_assign` (app_type-aware, proyek Supabase bersama).
// Untuk rosok bersifat PERKUAT, bukan gerbang: serial V2 sudah terikat
// perangkat lewat HMAC lokal, dan aktivasi manual adalah fallback OFFLINE —
// maka kegagalan jaringan/null TIDAK memblokir aktivasi. Penolakan eksplisit
// dari cloud ('profile-mismatch'/'serial-not-found') dilaporkan ke pemanggil.
export async function verifyAndAssignSerial(serial, unitId) {
  const sb = getSupabaseClient();
  if (!sb || !navigator.onLine) return { ok: false, reason: 'network' };
  try {
    const g = async (k) => { try { return await getSetting(k, ''); } catch (_) { return ''; } };
    const deviceCode = await g('deviceCode');
    const installId = await g('deviceId');
    let userId = null;
    try { const sess = await sb.auth.getSession(); userId = sess?.data?.session?.user?.id || null; } catch (_) {}
    if (!userId) { await ensureSession(sb, unitId).catch(() => {}); }
    const { data, error } = await sb.rpc('device_assign', {
      p_serial: serial,
      p_profile: { nama_usaha: await g('bizName'), nama_pemilik: await g('ownerName'), no_whatsapp: await g('bizPhone') },
      p_new_unit_id: unitId,
      p_new_device_code: deviceCode,
      p_new_install_id: installId,
      p_app_type: APP_TYPE
    });
    if (error) { console.warn('[ASSIGN] device_assign error:', error?.message || error); return { ok: false, reason: 'network' }; }
    const res = data || {};
    if (!res.ok) { console.warn('[ASSIGN] ditolak cloud:', res.reason); return { ok: false, reason: res.reason || 'rejected', cloud: true }; }
    return { ok: true, reason: res.reason || 'assigned' };
  } catch (e) {
    console.warn('[ASSIGN] gagal panggil device_assign:', e?.message || e);
    return { ok: false, reason: 'network' };
  }
}

// Rate limit sync penuh: paling cepat sekali per 5 menit (boot & gate 60s
// memanggil; yang melampaui budget hanya refresh kuota ringan).
const FULL_SYNC_MS = 5 * 60 * 1000;
let _lastFullSync = 0;

export async function syncLicenseStatusThrottled(unitId, licenseApi) {
  const now = Date.now();
  if (now - _lastFullSync < FULL_SYNC_MS) return { ok: false, reason: 'throttled' };
  _lastFullSync = now;
  return await syncLicenseStatus(unitId, licenseApi);
}
