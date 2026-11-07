// ==================== SETTINGS ADAPTER (laundry) ====================
// license.sync.js & purchase.js memanggil loadSettings() (dynamic import)
// setelah pull profil cloud — cukup menyegarkan form Pengaturan laundry.
// P1 paritas kaki5 (2026-10-03): tiap loadSettings TARIK profil cloud dulu
// (silent=false → kegagalan dikabari, bukan diam), baru render baris lokal.

export async function loadSettings(){
  try {
    const { pullCloudProfileIfOnline } = await import('./sync.js');
    try { await pullCloudProfileIfOnline(false); } catch (_){ /* non-kritikel */ }
  } catch (_){ /* modul sync belum siap — render lokal saja */ }
  try {
    if (window.LaundryCore && typeof window.LaundryCore.fillSettingsForm === 'function'){
      window.LaundryCore.fillSettingsForm();
    }
  } catch (_){ /* non-kritikel */ }
}
