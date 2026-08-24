import { h } from 'preact';

interface EcosystemProps { onSelectRole: (role: string) => void; }

const ROLES = [
  { role: 'admin', emoji: '👑', title: 'Admin / Kepala TPA', desc: 'Kelola seluruh data: santri, ustadz, kelas, keuangan, kurikulum, dan pengaturan sistem.', url: '/admin/' },
  { role: 'ustadz', emoji: '👳', title: 'Ustadz / Pengajar', desc: 'Input absensi, hafalan, iqro harian. Lihat kelas, jadwal, dan kurikulum.', url: '/guru/' },
  { role: 'wali', emoji: '👨‍👩‍👧', title: 'Wali Santri', desc: 'Pantau progres anak: hafalan, iqro, kehadiran, dan status pembayaran.', url: '/wali/' },
];

export function Ecosystem({ onSelectRole }: EcosystemProps) {
  return (
    <section class="py-16" id="ekosistem">
      <div class="max-w-6xl mx-auto px-5">
        <div class="text-center mb-10">
          <div class="text-xs font-bold text-brand-500 uppercase tracking-widest mb-2">Sistem Informasi</div>
          <h2 class="text-3xl font-extrabold mb-2">Portal Digital TPA</h2>
          <p class="text-slate-500 max-w-xl mx-auto">Akses sistem manajemen sesuai peran Anda. Data terpusat dan terintegrasi.</p>
        </div>
        <div class="grid md:grid-cols-3 gap-6">
          {ROLES.map(r => (
            <div
              key={r.role}
              onClick={() => onSelectRole(r.role)}
              class="bg-white border-2 border-slate-200 rounded-3xl p-7 text-center cursor-pointer transition-all hover:border-brand-500 hover:shadow-xl hover:shadow-orange-100 hover:-translate-y-1"
            >
              <span class="text-5xl block mb-3">{r.emoji}</span>
              <h3 class="text-lg font-extrabold mb-1.5">{r.title}</h3>
              <p class="text-sm text-slate-500 mb-5">{r.desc}</p>
              <div class="inline-flex items-center gap-1.5 px-6 py-2.5 bg-brand-500 text-white rounded-full font-bold text-sm hover:bg-brand-700 transition-colors">
                Masuk →
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
