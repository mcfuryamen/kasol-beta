import { h } from 'preact';

export function About() {
  return (
    <section class="py-16" id="tentang">
      <div class="max-w-6xl mx-auto px-5">
        <div class="text-center mb-10">
          <div class="text-xs font-bold text-brand-500 uppercase tracking-widest mb-2">Tentang Kami</div>
          <h2 class="text-3xl font-extrabold mb-2">Profil TPA Al-Hikmah</h2>
          <p class="text-slate-500 max-w-xl mx-auto">Lembaga pendidikan Al-Quran nonformal di bawah naungan yayasan, berkomitmen mencetak generasi yang cinta Al-Quran.</p>
        </div>
        <div class="grid md:grid-cols-2 gap-6">
          <div class="bg-white border border-slate-200 rounded-2xl p-7">
            <h3 class="text-lg font-extrabold mb-3 flex items-center gap-2">🎯 Visi</h3>
            <p class="text-slate-500 leading-relaxed">Menjadi lembaga pendidikan Al-Quran terdepan yang melahirkan generasi Qurani, beriman, berilmu, dan berakhlak mulia, serta berkontribusi positif bagi masyarakat.</p>
          </div>
          <div class="bg-white border border-slate-200 rounded-2xl p-7">
            <h3 class="text-lg font-extrabold mb-3 flex items-center gap-2">🚀 Misi</h3>
            <ul class="space-y-2">
              {['Menyelenggarakan pembelajaran Al-Quran yang berkualitas dan menyenangkan',
                'Menanamkan nilai-nilai akhlak dan adab Islam sejak dini',
                'Membina santri agar mampu membaca, menghafal, dan memahami Al-Quran',
                'Menyiapkan generasi yang istiqomah dalam beribadah',
                'Membangun kerjasama dengan orang tua dalam pendidikan anak',
              ].map(m => (
                <li key={m} class="text-sm text-slate-500 flex gap-2"><span class="text-brand-500 font-bold">✦</span>{m}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
