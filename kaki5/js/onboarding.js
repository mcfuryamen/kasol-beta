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
  const nama = document.getElementById('onboardName').value.trim() || 'Warung Saya';
  const pemilik = (document.getElementById('onboardOwner')?.value.trim?.() || '');
  const wa = (document.getElementById('onboardWa')?.value.trim?.() || '');
  await setSetting('namaWarung', nama);
  if (pemilik) await setSetting('namaPemilik', pemilik);
  if (wa) await setSetting('noWhatsapp', wa);
  document.getElementById('onboardingModal').classList.remove('show');
  document.getElementById('namaWarung').textContent = nama;

  // Add sample menu
  const samples = [
    { nama:'Nasi Goreng', kategori:'Makanan', hargaJual:15000, hargaModal:7000, aktif:1, urutan:1 },
    { nama:'Mie Goreng', kategori:'Makanan', hargaJual:13000, hargaModal:6000, aktif:1, urutan:2 },
    { nama:'Bakso', kategori:'Makanan', hargaJual:12000, hargaModal:5500, aktif:1, urutan:3 },
    { nama:'Sate Ayam', kategori:'Makanan', hargaJual:18000, hargaModal:9000, aktif:1, urutan:4 },
    { nama:'Gorengan', kategori:'Snack', hargaJual:2000, hargaModal:800, aktif:1, urutan:5 },
    { nama:'Es Teh', kategori:'Minuman', hargaJual:5000, hargaModal:1500, aktif:1, urutan:6 },
    { nama:'Es Jeruk', kategori:'Minuman', hargaJual:6000, hargaModal:2000, aktif:1, urutan:7 },
    { nama:'Kopi', kategori:'Minuman', hargaJual:5000, hargaModal:2000, aktif:1, urutan:8 },
  ];
  await DB.menu.bulkAdd(samples);
  showToast('🎉 Warung siap dipakai! Menu contoh sudah ditambahkan.');
  await loadBeranda();
}
