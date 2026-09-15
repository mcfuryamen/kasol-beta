import { h } from 'preact';

interface HeroProps { onGetStarted: () => void; }

export function Hero({ onGetStarted }: HeroProps) {
  return (
    <section class="pt-28 pb-16 bg-gradient-to-b from-orange-50 to-white relative overflow-hidden">
      <div class="max-w-6xl mx-auto px-5 text-center">
        <div class="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-slate-200 rounded-full text-xs font-semibold text-brand-500 mb-5">
          🕌 Taman Pendidikan Al-Quran
        </div>
        <h1 class="text-4xl md:text-6xl font-black leading-tight mb-5">
          Membentuk Generasi<br /><span class="text-brand-500">Qurani</span> Berakhlak Mulia
        </h1>
        <p class="text-lg text-slate-500 max-w-2xl mx-auto mb-8">
          TPA Al-Hikmah hadir sebagai wadah pendidikan Al-Quran dan akhlak untuk anak-anak,
          dengan kurikulum komprehensif dan pengajar berdedikasi.
        </p>
        <div class="flex gap-3 justify-center flex-wrap">
          <a href="#pendaftaran" class="px-7 py-3.5 bg-brand-500 text-white font-bold rounded-xl shadow-lg shadow-orange-200 hover:bg-brand-700 transition-all hover:-translate-y-0.5">
            Daftarkan Anak Anda →
          </a>
          <a href="#program" class="px-7 py-3.5 bg-white text-brand-500 font-bold rounded-xl border-2 border-brand-500 hover:bg-orange-50 transition-colors">
            Lihat Program ↓
          </a>
        </div>
      </div>
    </section>
  );
}
