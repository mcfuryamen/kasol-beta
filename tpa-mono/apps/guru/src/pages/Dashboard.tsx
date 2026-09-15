import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { StatCard, Card } from '@shared/index';
import { useAuth } from '@shared/hooks/useAuth';
import { getSupabase } from '@shared/db/supabase';
import { formatDate } from '@shared/utils/date';

export function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState({ classCount: 0, studentCount: 0, todaySessions: 0, pendingHafalan: 0 });
  const [todaySchedule, setTodaySchedule] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    loadDashboard();
  }, [user]);

  const loadDashboard = async () => {
    const supabase = getSupabase();
    const { data: teacherData } = await supabase.from('teachers').select('id').eq('user_id', user!.id).single();
    if (!teacherData) return;

    const { data: classTeachers } = await supabase.from('class_teachers').select('class_id').eq('teacher_id', teacherData.id);
    const classIds = (classTeachers || []).map(ct => ct.class_id);

    if (classIds.length > 0) {
      const { count: studentCount } = await supabase.from('class_students')
        .select('id', { count: 'exact' }).in('class_id', classIds).eq('is_active', true);
      setStats(prev => ({ ...prev, classCount: classIds.length, studentCount: studentCount || 0 }));
    }

    const days = ['minggu', 'senin', 'selasa', 'rabu', 'kamis', 'jumat', 'sabtu'];
    const today = days[new Date().getDay()];
    const { data: schedules } = await supabase.from('schedules')
      .select('*, classes(name)').eq('teacher_id', teacherData.id).eq('day', today).eq('is_active', true);
    setTodaySchedule(schedules || []);
  };

  return (
    <div class="space-y-6">
      <div class="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-6 text-white">
        <h2 class="text-2xl font-bold">Assalamu'alaikum, {user?.name} 👋</h2>
        <p class="text-orange-100 mt-1">{formatDate(new Date(), 'EEEE, dd MMMM yyyy')}</p>
      </div>

      <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="🏫" label="Kelas Diampu" value={stats.classCount} color="orange" />
        <StatCard icon="👨‍🎓" label="Total Santri" value={stats.studentCount} color="blue" />
        <StatCard icon="📅" label="Sesi Hari Ini" value={todaySchedule.length} color="green" />
        <StatCard icon="📖" label="Perlu Diisi" value={stats.pendingHafalan} color="red" />
      </div>

      <Card title="Jadwal Hari Ini">
        {todaySchedule.length === 0 ? (
          <p class="text-gray-400 text-center py-8">Tidak ada jadwal hari ini</p>
        ) : (
          <div class="space-y-3">
            {todaySchedule.map((s, i) => (
              <div key={i} class="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                <div class="flex items-center gap-3">
                  <div class="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center text-orange-600 font-bold">
                    {i + 1}
                  </div>
                  <div>
                    <p class="font-medium">{s.classes?.name}</p>
                    <p class="text-sm text-gray-500">Ruang: {s.room || '-'}</p>
                  </div>
                </div>
                <div class="text-right">
                  <p class="font-medium text-orange-600">{s.start_time?.slice(0,5)} - {s.end_time?.slice(0,5)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
