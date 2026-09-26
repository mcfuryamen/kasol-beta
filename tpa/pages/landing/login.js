/**
 * Login Page Module (ESM)
 * Halaman masuk sistem — hub autentikasi untuk semua portal.
 * Menggunakan query db.* langsung yang identik dengan HTML aktif
 * agar perilaku login tidak berubah.
 */
import { db } from '../../db/dexie.js';
import { setSessionUser } from '../../db/init.js';
import { seedDemoData } from '../../db/seed.js';

// Seed data awal (lokasi, user default, settings) agar gate terhubung ke modul data.
// Memanggil seedDemoData() agar data demo penuh (santri, ustadz, kelas, dst) ikut ter-seed.
async function ensureSeed() {
  await seedDemoData();
  const locs = await db.locations.toArray();
  const lid = locs[0].id;
  if (!(await db.settings.get('setupDone'))) await db.settings.put({ key: 'setupDone', value: '1' });
  if (!(await db.settings.get('bizName'))) await db.settings.put({ key: 'bizName', value: 'TPA Al-Hikmah' });
  if (!(await db.settings.get('trialStart'))) await db.settings.put({ key: 'trialStart', value: new Date().toISOString() });
  if (!(await db.settings.get('licenseActivatedAt'))) await db.settings.put({ key: 'licenseActivatedAt', value: '' });
  if (!(await db.settings.get('deviceCode'))) await db.settings.put({ key: 'deviceCode', value: '' });
  return lid;
}

async function doLogin() {
  const err = document.getElementById('gate-err');
  const role = document.getElementById('gate-role').value;
  const name = document.getElementById('gate-name').value.trim();
  if (!name) { err.textContent = 'Nama harus diisi'; err.classList.remove('hidden'); return; }
  try {
    const lid = await ensureSeed();
    const user = await db.users.where('role').equals(role).filter(u => u.name.toLowerCase() === name.toLowerCase()).first();
    if (!user) { err.textContent = 'Nama tidak terdaftar untuk peran ini.'; err.classList.remove('hidden'); return; }
    const loc = await db.locations.get(lid);
    setSessionUser({ id: user.id, name: user.name, role: user.role, locationId: lid, locationName: loc ? loc.name : '' });
    await db.settings.put({ key: 'lastLogin', value: JSON.stringify({ name: user.name, role: user.role, at: new Date().toISOString() }) });
    window.location.href = { admin: 'admin.html', ustadz: 'guru.html', wali: 'wali.html' }[role] || 'admin.html';
  } catch (e) {
    console.error(e);
    err.textContent = 'Terjadi kesalahan, coba lagi.';
    err.classList.remove('hidden');
  }
}

export function initLogin() {
  // Hub login selalu menampilkan form agar pengguna bisa memilih peran.
  // (Tanpa auto-redirect: membuka portal tanpa izin cukup kembali ke sini, tidak terpental.)
  window.doLogin = doLogin;
  window.quickLogin = quickLogin;
  ensureSeed().catch(console.warn);
}

// Login cepat (mode demo) — isi form lalu langsung masuk sesuai kredensial.
async function quickLogin(role, name) {
  const roleSel = document.getElementById('gate-role');
  const nameInp = document.getElementById('gate-name');
  if (roleSel) roleSel.value = role;
  if (nameInp) nameInp.value = name;
  await doLogin();
}