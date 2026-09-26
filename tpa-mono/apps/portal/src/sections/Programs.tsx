import { h } from 'preact';

const PROGRAMS = [
  { icon: '📕', title: 'Iqro / Baca Tulis', desc: 'Jilid 1-6, huruf hijaiyah, makhorijul huruf, harakat' },
  { icon: '🕌', title: 'Hafalan Al-Quran', desc: 'Juz Amma, surat pilihan, ziyadah & murajaah harian' },
  { icon: '📖', title: 'Tajwid', desc: 'Hukum nun mati, mim mati, mad, waqaf, tilawah' },
  { icon: '🕋', title: 'Fiqh Ibadah', desc: 'Thaharah, shalat, puasa, zakat — teori & praktik' },
  { icon: '💎', title: 'Akhlak & Adab', desc: 'Adab harian, akhlak mulia, kisah teladan sahabat' },
  { icon: '🤲', title: 'Doa Harian', desc: 'Doa sehari-hari, dzikir pagi-petang, wirid' },
  { icon: '📜', title: 'Sirah Nabi', desc: 'Sejarah Nabi Muhammad SAW dan Khulafaur Rasyidin' },
];

export function Programs() {
  return (
    <section class="py-16 bg-slate-50" id="program">
      <div class="max-w-6xl mx-auto px-5">
        <div class="text-center mb-10">
          <div class="text-xs font-bold text-brand-500 uppercase tracking-widest mb-2">Program Pembelajaran</div>
          <h2 class="text-3xl font-extrabold mb-2">7 Pilar Kurikulum</h2>
          <p class="text-slate-500 max-w-xl mx-auto">Kurikulum komprehensif mencakup baca-tulis Al-Quran, hafalan, pemahaman agama, dan pembentukan karakter.</p>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {PROGRAMS.map(p => (
            <div key={p.title} class="bg-white border border-slate-200 rounded-2xl p-5 text-center hover:border-brand-500 hover:-translate-y-1 transition-all cursor-default">
              <span class="text-3xl block mb-2">{p.icon}</span>
              <h4 class="text-sm font-bold mb-1">{p.title}</h4>
              <p class="text-xs text-slate-400">{p.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
