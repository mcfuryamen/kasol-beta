// ==================== ONBOARDING (ESM) ====================
import { DB, getSetting, setSetting } from './db.js';
import { showToast } from './helpers.js';
import { startTrial, ensureUnitId } from './license.js';
import { loadBeranda } from './beranda.js';

export async function checkOnboarding() {
  // Start a 7-day trial on first run (only if not already activated)
  await startTrial();
  await ensureUnitId();

  const nama = await getSetting('namaWarung', null);
  if (!nama) {
    document.getElementById('onboardingModal').classList.add('show');
  }
}

export async function finishOnboarding() {
  const nama = document.getElementById('onboardName').value.trim();
  const pemilik = document.getElementById('onboardOwner').value.trim();
  const wa = document.getElementById('onboardWa').value.trim();
  const alamat = document.getElementById('onboardAlamat').value.trim();
  const msg = document.getElementById('onboardMsg');

  // Semua field wajib diisi (onset onboarding wajib disimpan di database)
  const kosong = [];
  if (!nama) kosong.push('Nama Usaha');
  if (!pemilik) kosong.push('Nama Pemilik');
  if (!wa) kosong.push('Nomor WhatsApp');
  if (!alamat) kosong.push('Alamat');
  if (kosong.length) {
    msg.textContent = 'Mohon lengkapi: ' + kosong.join(', ') + '.';
    msg.style.display = 'block';
    msg.scrollIntoView({ block: 'center', behavior: 'smooth' });
    return;
  }
  msg.style.display = 'none';

  await setSetting('namaWarung', nama);
  await setSetting('namaPemilik', pemilik);
  await setSetting('noWhatsapp', wa);
  await setSetting('alamat', alamat);
  document.getElementById('onboardingModal').classList.remove('show');
  document.getElementById('namaWarung').textContent = nama;

  // Daftar barang/menu sengaja dibiarkan KOSONG untuk user baru.
  // User mengisi sendiri lewat halaman Menu (tombol +). Tidak ada lagi
  // seeding menu contoh agar halaman Menu mulai bersih.
  await loadBeranda();
}
