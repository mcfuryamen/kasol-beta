import { h } from 'preact';

export function Registration() {
  return (
    <section class="py-16 bg-slate-50" id="pendaftaran">
      <div class="max-w-6xl mx-auto px-5">
        <div class="text-center mb-10">
          <div class="text-xs font-bold text-brand-500 uppercase tracking-widest mb-2">Informasi</div>
          <h2 class="text-3xl font-extrabold">Pendaftaran & Kegiatan</h2>
        </div>
        <div class="grid md:grid-cols-3 gap-5">
          <div class="bg-white border border-slate-200 rounded-2xl p-6">
            <h3 class="font-bold text-base mb-3 flex items-center gap-2">📋 Syarat Pendaftaran</h3>
            <div class="text-sm text-slate-500 space-y-1">
              <p>1. Anak usia 4-15 tahun</p>
              <p>2. Mengisi formulir pendaftaran</p>
              <p>3. Fotokopi Kartu Keluarga</p>
              <p>4. Pas foto 3x4 (2 lembar)</p>
              <p>5. SPP bulanan: <strong class="text-brand-500">Rp 50.000</strong></p>
            </div>
          </div>
          <div class="bg-white border border-slate-200 rounded-2xl p-6">
            <h3 class="font-bold text-base mb-3 flex items-center gap-2">⏰ Jadwal Belajar</h3>
            <div class="text-sm text-slate-500 space-y-1">
              <p><strong>Senin - Jumat</strong></p>
              <p>Sesi 1: 15.30 - 17.00 WIB</p>
              <p>Sesi 2: 18.30 - 20.00 WIB</p>
              <p class="mt-2"><strong>Sabtu</strong></p>
              <p>Muroja'ah bersama & ekskul</p>
            </div>
          </div>
          <div class="bg-white border border-slate-200 rounded-2xl p-6">
            <h3 class="font-bold text-base mb-3 flex items-center gap-2">🏆 Kegiatan Tahunan</h3>
            <div class="text-sm text-slate-500 space-y-1">
              <p>• Wisuda Khatam Iqro & Al-Quran</p>
              <p>• Lomba Tahfidz & Tartil</p>
              <p>• Pesantren Kilat Ramadhan</p>
              <p>• Peringatan Hari Besar Islam</p>
              <p>• Study Tour / Rihlah Edukasi</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
