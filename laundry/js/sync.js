// ==================== SYNC ADAPTER (laundry) ====================
// Modul lisensi kaki5 mengimpor dari './sync.js':
//   • ensureSynced({force, silent}) — push profil (backfill-only; force = user-intent)
//   • pullCloudProfileTo(cloudRow)  — tarik profil cloud → lokal (C2v2: nilai
//     kosong dari cloud sengaja ikut menimpa — admin bisa membersihkan buffer)
//   • pullCloudProfileIfOnline({silent}) — P1 paritas kaki5 (2026-10-03):
//     tarik profil cloud SETIAP boot & saat halaman Pengaturan dibuka,
//     lengkap dengan klaim device (RPC device_known) + guard tabrakan identitas.
//   • ensureAuthSession(sb, unitId?) — sesi anonim dengan claim unit_id

// Klien supabase lokal (identik pola license.sync/purchase) — dibuat sekali,
// menolak placeholder key. Dipakai pullCloudProfileIfOnline; menghindari
// circular import ke license.sync.js.
function getClient() {
  if (!window.supabase) return null;
  const url = window.KASIRSOLO_SUPABASE_URL;
  const anon = window.KASIRSOLO_SUPABASE_ANON_KEY;
  if (!url || !anon || !anon.includes('.')) return null;
  if (!window._ksrSupabaseClient) {
    window._ksrSupabaseClient = window.supabase.createClient(url, anon, {
      auth: { persistSession: true, autoRefreshToken: true }
    });
  }
  return window._ksrSupabaseClient;
}

export async function ensureAuthSession(sb, unitId){
  try {
    const { data } = await sb.auth.getSession();
    const session = data && data.session;
    if (session && session.user){
      const cur = (session.user.user_metadata || {}).unit_id;
      if (unitId && cur !== unitId){
        try { await sb.auth.updateUser({ data: { unit_id: unitId } }); } catch (_){ }
      }
      return { ok: true, userId: session.user.id };
    }
    const opts = unitId ? { options: { data: { unit_id: unitId } } } : {};
    const { data: anon, error } = await sb.auth.signInAnonymously(opts);
    if (error) return { ok: false, error };
    return { ok: true, userId: anon && anon.user ? anon.user.id : null };
  } catch (e){ return { ok: false, error: e }; }
}

export async function ensureSynced(opts = {}){
  try {
    const c = window.LaundryCore;
    if (c && typeof c.ensureSyncedProfile === 'function'){
      return await c.ensureSyncedProfile(!!opts.force);
    }
  } catch (_){ /* offline — retry saat online */ }
  return { offline: true };
}

export async function pullCloudProfileTo(cloud){
  try {
    if (!cloud) return;
    const c = window.LaundryCore;
    if (!c) return;
    // Guard tabrakan identitas (paritas kaki5, port rosok 2026-09-04): sesama
    // model HP dapat menghasilkan unit_id identik — baris cloud yang sudah
    // diprofilkan usaha LAIN TIDAK boleh menimpa profil lokal. Dynamic import
    // menghindari circular import (license.logic ← license.sync ← sync.js).
    try {
      const { cloudProfileMatchesLocal } = await import('./license.logic.js');
      if (!(await cloudProfileMatchesLocal(cloud))) {
        console.warn('[C2] pull profil DILEWATI — baris cloud terisi profil asing (indikasi tabrakan identitas)');
        return;
      }
    } catch (_){ /* guard gagal (offline/storage) → lanjut, tidak blokir */ }
    const db = c.getDB();
    if (!db.settings) db.settings = {};
    if (cloud.nama_usaha != null) db.settings.namaToko = String(cloud.nama_usaha || '');
    if (cloud.no_whatsapp != null) db.settings.wa = String(cloud.no_whatsapp || '');
    if (cloud.alamat_detail != null) db.settings.alamat = String(cloud.alamat_detail || '');
    if (cloud.nama_pemilik != null) db.settings.namaPemilik = String(cloud.nama_pemilik || '');
    if (cloud.provinsi != null) db.settings.provinsi = String(cloud.provinsi || '');
    if (cloud.provinsi_id != null) db.settings.provinsiId = String(cloud.provinsi_id || '');
    if (cloud.kabkota != null) db.settings.kabkota = String(cloud.kabkota || '');
    if (cloud.kabkota_id != null) db.settings.kabkotaId = String(cloud.kabkota_id || '');
    if (cloud.kecamatan != null) db.settings.kecamatan = String(cloud.kecamatan || '');
    if (cloud.kecamatan_id != null) db.settings.kecamatanId = String(cloud.kecamatan_id || '');
    if (cloud.desa != null) db.settings.desa = String(cloud.desa || '');
    if (cloud.desa_id != null) db.settings.desaId = String(cloud.desa_id || '');
    c.saveDB();
    // Refresh UI: baris Pengaturan + header nama usaha mengikuti profil cloud
    // (N3 — paritas kaki5 2026-09-17: refresh TUNGGU saat pull di background).
    try { if (typeof c.fillSettingsForm === 'function') c.fillSettingsForm(); } catch (_){ }
    try { if (typeof window.applyHeaderBizName === 'function') window.applyHeaderBizName(); } catch (_){ }
  } catch (_){ /* non-kritikel */ }
}

/**
 * Tarik profil cloud → lokal (paritas kaki5 C2v2, 2026-10-03).
 * Setiap boot & setiap halaman Pengaturan dibuka: pastikan sesi anonim
 * ber-claim unit_id → klaim perangkat via RPC device_known (kunci RLS:
 * men-SET user_id = anon ini supaya SELECT lolos policy) → baca baris by
 * unit_id, fallback by device_code (unitId lokal ikut disamakan) →
 * pullCloudProfileTo (guard + mapping). Fire-and-forget di boot; silent=false
 * saat dibuka dari Pengaturan (gagal => toast).
 */
export async function pullCloudProfileIfOnline(silent = true) {
  const sb = getClient();
  if (!sb || !navigator.onLine) return;
  try {
    const api = window.LicenseAPI;
    if (!api) return;
    const auth = await ensureAuthSession(sb);
    if (!auth.ok) {
      console.warn('[C2v2] ensureAuthSession gagal:', auth.reason || auth.error?.message || '');
      return;
    }
    const unitId = await api.getUnitId();
    const deviceCode = (await api.getDeviceCode()) || '';

    // Klaim device dulu — RPC SECURITY DEFINER mencocokkan by unit_id ATAU
    // device_code lalu men-SET user_id = auth.uid(); tanpa ini semua SELECT
    // clients mentok RLS (claim unit_id JWT saja tidak cukup untuk baris tua).
    try {
      const { error: claimErr } = await sb.rpc('device_known', {
        p_unit_id: unitId, p_device_code: deviceCode, p_app_type: 'laundry'
      });
      if (claimErr) {
        console.warn('[C2v2] device_known gagal:', claimErr?.message || claimErr);
        return;
      }
    } catch (_claim) { return; }

    let { data: client } = await sb
      .from('clients')
      .select('*')
      .eq('unit_id', unitId)
      .eq('app_type', 'laundry')
      .maybeSingle();
    // Fallback by device_code bila unit_id mismatch (baris lama / re-install).
    if (!client && deviceCode) {
      const { data: byDevice } = await sb
        .from('clients')
        .select('*')
        .eq('device_code', deviceCode)
        .eq('app_type', 'laundry')
        .maybeSingle();
      if (byDevice) {
        client = byDevice;
        if (byDevice.unit_id && byDevice.unit_id !== unitId) {
          try {
            const { setSetting } = await import('./db.js');
            await setSetting('unitId', byDevice.unit_id);
            console.log('[C2v2] Unit ID disinkronkan dari cloud:', byDevice.unit_id);
          } catch (_){ /* non-kritikel */ }
        }
      }
    }
    if (!client) return;
    await pullCloudProfileTo(client);
  } catch (e) {
    console.warn('[C2v2] pullCloudProfileIfOnline gagal:', e?.message || e);
    // Audit toast 2026-09-07 (pola kaki5): buka Pengaturan = non-silent —
    // tampilan jangan diam-diam menunjuk data lokal basi seolah benar.
    if (!silent && !pullCloudProfileIfOnline._warned) {
      pullCloudProfileIfOnline._warned = true;
      try {
        const { showToast } = await import('./helpers.js');
        showToast('⚠️ Gagal menarik profil dari server — menampilkan data tersimpan 📴', 'warning', 5000);
      } catch (_){ }
    }
  }
}
