import { h } from 'preact';

export function Contact() {
  return (
    <section class="py-16 bg-slate-50" id="kontak">
      <div class="max-w-6xl mx-auto px-5">
        <div class="text-center mb-10">
          <div class="text-xs font-bold text-brand-500 uppercase tracking-widest mb-2">Hubungi Kami</div>
          <h2 class="text-3xl font-extrabold">Informasi Kontak</h2>
        </div>
        <div class="grid md:grid-cols-3 gap-4">
          {[
            { icon: '📞', label: 'WhatsApp', value: '08816566935' },
            { icon: '📍', label: 'Alamat', value: 'Jl. Masjid No. 1, Kampung Bahagia' },
            { icon: '🌐', label: 'Website', value: 'kasirsolo.app' },
          ].map(c => (
            <div key={c.label} class="bg-white border border-slate-200 rounded-2xl p-5 flex items-center gap-3.5">
              <div class="w-11 h-11 bg-orange-50 rounded-xl flex items-center justify-center text-xl shrink-0">{c.icon}</div>
              <div>
                <div class="text-xs text-slate-400">{c.label}</div>
                <div class="font-semibold">{c.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
