// ==================== SETTINGS ADAPTER (laundry) ====================
// license.sync.js & purchase.js memanggil loadSettings() (dynamic import)
// setelah pull profil cloud — cukup menyegarkan form Pengaturan laundry.

export async function loadSettings(){
  try {
    if (window.LaundryCore && typeof window.LaundryCore.fillSettingsForm === 'function'){
      window.LaundryCore.fillSettingsForm();
    }
  } catch (_){ /* non-kritikel */ }
}
