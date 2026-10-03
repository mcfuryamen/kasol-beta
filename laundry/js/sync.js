// ==================== SYNC ADAPTER (laundry) ====================
// Modul lisensi kaki5 mengimpor dari './sync.js':
//   • ensureSynced({force, silent}) — push profil (backfill-only; force = user-intent)
//   • pullCloudProfileTo(cloudRow)  — tarik profil cloud → lokal (C2v2: nilai
//     kosong dari cloud sengaja ikut menimpa — admin bisa membersihkan buffer)
//   • ensureAuthSession(sb, unitId?) — sesi anonim dengan claim unit_id

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
    const db = c.getDB();
    if (!db.settings) db.settings = {};
    if (cloud.nama_usaha != null) db.settings.namaToko = String(cloud.nama_usaha || '');
    if (cloud.no_whatsapp != null) db.settings.wa = String(cloud.no_whatsapp || '');
    if (cloud.alamat_detail != null) db.settings.alamat = String(cloud.alamat_detail || '');
    if (cloud.nama_pemilik != null) db.settings.namaPemilik = String(cloud.nama_pemilik || '');
    c.saveDB();
    if (typeof c.fillSettingsForm === 'function') c.fillSettingsForm();
  } catch (_){ /* non-kritikel */ }
}
