import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { getSupabase } from '@shared/db/supabase';

export function StatsBar() {
  const [stats, setStats] = useState({ santri: '-', guru: '-', kelas: '-' });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const supabase = getSupabase();
      const [s, t, c] = await Promise.all([
        supabase.from('students').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('teachers').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('classes').select('id', { count: 'exact', head: true }).eq('is_active', true),
      ]);
      setStats({
        santri: String(s.count || 0),
        guru: String(t.count || 0),
        kelas: String(c.count || 0),
      });
    } catch { /* offline fallback */ }
  };

  return (
    <div class="bg-orange-50 py-10">
      <div class="max-w-6xl mx-auto px-5 flex justify-center gap-12 flex-wrap">
        {[
          { value: stats.santri, label: 'Santri Aktif' },
          { value: stats.guru, label: 'Ustadz/Pengajar' },
          { value: stats.kelas, label: 'Kelas' },
          { value: '2026', label: 'Tahun Ajaran' },
        ].map(s => (
          <div key={s.label} class="text-center">
            <div class="text-4xl font-black text-brand-500">{s.value}</div>
            <div class="text-sm text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
