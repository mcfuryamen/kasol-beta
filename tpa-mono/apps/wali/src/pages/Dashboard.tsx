import { h } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { StatCard, Card, Avatar, Badge } from '@shared/index';
import { useAuth } from '@shared/hooks/useAuth';
import { getSupabase } from '@shared/db/supabase';
import { formatDate } from '@shared/utils/date';
import { getGradeLabel, getGradeColor } from '@shared/utils/format';

export function Dashboard() {
  const { user } = useAuth();
  const [children, setChildren] = useState<any[]>([]);
  const [latestProgress, setLatestProgress] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);

  useEffect(() => { loadData(); }, [user]);

  const loadData = async () => {
    if (!user) return;
    const supabase = getSupabase();

    // Get guardian
    const { data: guardian } = await supabase.from('guardians').select('id').eq('user_id', user.id).single();
    if (!guardian) return;

    // Get children
    const { data: kids } = await supabase.from('students').select('*').eq('guardian_id', guardian.id);
    setChildren(kids || []);

    // Get latest hafalan for each child
    if (kids?.length) {
      const childIds = kids.map(k => k.id);
      const { data: hafalan } = await supabase.from('hafalan_progress')
        .select('*').in('student_id', childIds)
        .order('recorded_at', { ascending: false }).limit(5);
      setLatestProgress(hafalan || []);
    }

    // Get notifications
    const { data: notifs } = await supabase.from('notifications')
      .select('*').eq('user_id', user.id).eq('is_read', false)
      .order('created_at', { ascending: false }).limit(5);
    setNotifications(notifs || []);
  };

  return (
    <div class="space-y-6">
      <div class="bg-gradient-to-r from-orange-500 to-orange-600 rounded-xl p-6 text-white">
        <h2 class="text-2xl font-bold">Assalamu'alaikum, {user?.name} 👋</h2>
        <p class="text-orange-100 mt-1">{formatDate(new Date(), 'EEEE, dd MMMM yyyy')}</p>
      </div>

      {/* Children Cards */}
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        {children.map(child => (
          <Card key={child.id}>
            <div class="flex items-center gap-4">
              <Avatar name={child.name} src={child.photo_url} size="lg" />
              <div>
                <h3 class="font-bold text-gray-800">{child.name}</h3>
                <p class="text-sm text-gray-500">NIS: {child.nis || '-'}</p>
                <Badge label={child.is_active ? 'Aktif' : 'Nonaktif'}
                  color={child.is_active ? 'text-green-600 bg-green-100' : 'text-gray-600 bg-gray-100'} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Latest Progress */}
      <Card title="Update Terbaru">
        {latestProgress.length === 0 ? (
          <p class="text-gray-400 text-center py-8">Belum ada update</p>
        ) : (
          <div class="space-y-3">
            {latestProgress.map((p, i) => (
              <div key={i} class="flex items-center justify-between p-3 rounded-lg bg-gray-50">
                <div>
                  <p class="font-medium text-sm">{p.surah_name} ({p.ayat_from}-{p.ayat_to})</p>
                  <p class="text-xs text-gray-500">{p.type} - {formatDate(p.recorded_at)}</p>
                </div>
                <Badge label={getGradeLabel(p.grade)} color={getGradeColor(p.grade)} />
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Notifications */}
      {notifications.length > 0 && (
        <Card title="Notifikasi Belum Dibaca">
          <div class="space-y-3">
            {notifications.map((n, i) => (
              <div key={i} class="flex items-start gap-3 p-3 rounded-lg bg-orange-50">
                <span class="text-lg">{n.type === 'progress' ? '📖' : n.type === 'payment' ? '💰' : '🔔'}</span>
                <div>
                  <p class="font-medium text-sm">{n.title}</p>
                  <p class="text-xs text-gray-600">{n.message}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
