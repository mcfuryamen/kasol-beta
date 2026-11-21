// ==================== DB ADAPTER (laundry ⇄ modul lisensi kaki5) ====================
// Modul lisensi kaki5 berbicara lewat getSetting/setSetting (di kaki5: tabel
// `settings` di Dexie). Di laundry:
//   • Kunci PROFIL (namaUsaha/noWhatsapp/namaPemilik) dipetakan ke DB.settings
//     aplikasi (namaToko/wa) supaya profil satu sumber kebenaran.
//   • Kunci TEKNIS lisensi (license/deviceIdentity/unitId/installId/clockAnchor/
//     trialConfig/quotaMeta/unitReanchor/txLastPushAt/licenseSync/...) disimpan
//     di localStorage TERPISAH (ksldry_license_settings_v1) agar tidak terseret
//     backup data bisnis & tidak ikut restore.
const STORE_KEY = 'ksldry_license_settings_v1';
const PROFILE_MAP = { namaUsaha: 'namaToko', namaWarung: 'namaToko', noWhatsapp: 'wa', namaPemilik: 'namaPemilik' };
const MIGRATED_KEY = 'licenseModuleMigrated';

function core(){ return window.LaundryCore || null; }
function loadStore(){ try { return JSON.parse(localStorage.getItem(STORE_KEY) || '{}') || {}; } catch (_){ return {}; } }
function saveStore(s){ try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (_){} }

export async function getSetting(key, def = null){
  try {
    const c = core();
    if (c && Object.prototype.hasOwnProperty.call(PROFILE_MAP, key)){
      const db = c.getDB();
      const v = db && db.settings ? db.settings[PROFILE_MAP[key]] : null;
      return (v === null || v === undefined || v === '') ? def : v;
    }
    const s = loadStore();
    return (key in s) ? s[key] : def;
  } catch (_){ return def; }
}

export async function setSetting(key, value){
  try {
    const c = core();
    if (c && Object.prototype.hasOwnProperty.call(PROFILE_MAP, key)){
      const db = c.getDB();
      if (!db.settings) db.settings = {};
      db.settings[PROFILE_MAP[key]] = value == null ? '' : String(value);
      c.saveDB();
      return;
    }
    const s = loadStore();
    if (value === null || value === undefined) delete s[key]; else s[key] = value;
    saveStore(s);
  } catch (_){}
}

/* ===== MIGRASI SEKALI: state lisensi lama (DB.license v2 inline) → modul kaki5 =====
   Peta status: 'free' (kuota) → 'trial' (tier gratis kaki5); 'active' → 'active'.
   deviceCode LAMA DIPERTAHANKAN (fpVersion 'KSL-IMPORT' → getDeviceIdentity
   membeku tanpa konvergensi ke fingerprint kaki5) supaya unitId & baris cloud
   pemilik tidak berubah. */
export async function migrateLegacyLicenseState(){
  try {
    if (await getSetting(MIGRATED_KEY, null)) return;
    const c = core();
    if (!c) return;
    const db = c.getDB();
    const old = (db && db.license) || {};
    if (old.status && old.status !== 'none'){
      if (old.status === 'active'){
        await setSetting('license', {
          status: 'active',
          startedAt: old.activatedAt ? new Date(old.activatedAt).toISOString() : new Date().toISOString(),
          serial: old.serial || '',
          deviceCode: old.deviceCode || '',
          expCode: '99',
          expiryLabel: 'Seumur Hidup',
          source: 'migrated'
        });
      } else {
        const d = new Date();
        const nowMonth = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
        await setSetting('license', {
          status: 'trial',
          txMonth: old.txMonth || (Number(old.txCount) > 0 ? nowMonth : null),
          txUsed: Number(old.txCount) || 0,
          txAdjust: 0,
          deviceCode: old.deviceCode || ''
        });
      }
      if (old.deviceCode){
        await setSetting('deviceIdentity', { deviceCode: old.deviceCode, installId: old.installId || null, fingerprint: null, fpVersion: 'KSL-IMPORT' });
        await setSetting('unitId', 'KSL-' + old.deviceCode);
        if (old.installId) await setSetting('installId', old.installId);
      }
    }
    /* Penanda WAJIB lewat setSetting — jangan saveStore(salinan lama),
       itu akan menimpa hasil setSetting di atas (bug store stale). */
    await setSetting(MIGRATED_KEY, Date.now());
  } catch (_){ /* migrasi gagal — dicoba lagi boot berikutnya */ }
}
