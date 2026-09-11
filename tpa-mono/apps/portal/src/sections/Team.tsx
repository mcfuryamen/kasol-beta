import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { getSupabase } from '@shared/db/supabase';
import { getInitials } from '@shared/utils/format';

export function Team() {
  const [teachers, setTeachers] = useState<any[]>([]);

  useEffect(() => {
    getSupabase().from('teachers').select('*').eq('is_active', true)
      .then(({ data }) => setTeachers(data || []))
      .catch(() => {});
  }, []);

  return (
    <section class="py-16" id="pengajar">
      <div class="max-w-6xl mx-auto px-5">
        <div class="text-center mb-10">
          <div class="text-xs font-bold text-brand-500 uppercase tracking-widest mb-2">Tim Pengajar</div>
          <h2 class="text-3xl font-extrabold mb-2">Ustadz & Ustadzah Kami</h2>
          <p class="text-slate-500 max-w-xl mx-auto">Pengajar berdedikasi dengan kompetensi di bidang Al-Quran dan pendidikan Islam.</p>
        </div>
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {teachers.length > 0 ? teachers.map(t => (
            <div key={t.id} class="bg-white border border-slate-200 rounded-2xl p-6 text-center hover:shadow-md transition-shadow">
              <div class="w-16 h-16 rounded-full bg-orange-50 text-brand-500 flex items-center justify-center text-2xl font-extrabold mx-auto mb-3">
                {getInitials(t.name)}
              </div>
              <h4 class="font-bold">{t.name}</h4>
              <div class="text-xs font-semibold text-brand-500">{t.gender === 'L' ? 'Ustadz' : 'Ustadzah'}</div>
              <div class="text-xs text-slate-400 mt-0.5">{t.specialization || 'Pengajar'}</div>
            </div>
          )) : (
            <p class="text-slate-400 text-center col-span-full py-8">Data pengajar akan muncul setelah diinput di sistem admin.</p>
          )}
        </div>
      </div>
    </section>
  );
}
