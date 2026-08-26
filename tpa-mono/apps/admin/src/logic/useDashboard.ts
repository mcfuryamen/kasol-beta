import { useState, useEffect } from 'preact/hooks';
import { getSupabase } from '@shared/db/supabase';
import { useAuth } from '@shared/hooks/useAuth';

interface DashboardStats {
  totalStudents: number;
  activeStudents: number;
  totalTeachers: number;
  activeTeachers: number;
  totalClasses: number;
  todayAttendance: number;
  totalBills: number;
  totalPaid: number;
  totalUnpaid: number;
  cashBalance: number;
  todayHafalan: number;
  monthlyHafalan: number;
  iqroGraduated: number;
  averageGrade: string;
}

interface Activity {
  icon: string;
  message: string;
  time: string;
}

export function useDashboardData() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalStudents: 0, activeStudents: 0, totalTeachers: 0, activeTeachers: 0,
    totalClasses: 0, todayAttendance: 0, totalBills: 0, totalPaid: 0,
    totalUnpaid: 0, cashBalance: 0, todayHafalan: 0, monthlyHafalan: 0,
    iqroGraduated: 0, averageGrade: '-',
  });
  const [recentActivity, setRecentActivity] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, [user?.location_id]);

  const loadDashboard = async () => {
    if (!user?.location_id) { setIsLoading(false); return; }
    const supabase = getSupabase();
    const locationId = user.location_id;

    try {
      // Parallel queries
      const [studentsRes, teachersRes, classesRes] = await Promise.all([
        supabase.from('students').select('id, is_active', { count: 'exact' }).eq('location_id', locationId),
        supabase.from('teachers').select('id, is_active', { count: 'exact' }).eq('location_id', locationId),
        supabase.from('classes').select('id', { count: 'exact' }).eq('location_id', locationId).eq('is_active', true),
      ]);

      const students = studentsRes.data || [];
      const teachers = teachersRes.data || [];

      setStats({
        totalStudents: studentsRes.count || 0,
        activeStudents: students.filter(s => s.is_active).length,
        totalTeachers: teachersRes.count || 0,
        activeTeachers: teachers.filter(t => t.is_active).length,
        totalClasses: classesRes.count || 0,
        todayAttendance: 0,
        totalBills: 0, totalPaid: 0, totalUnpaid: 0,
        cashBalance: 0, todayHafalan: 0, monthlyHafalan: 0,
        iqroGraduated: 0, averageGrade: '-',
      });

      // Load recent notifications as activity
      const { data: notifs } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

      setRecentActivity((notifs || []).map(n => ({
        icon: n.type === 'progress' ? '📖' : n.type === 'payment' ? '💰' : n.type === 'attendance' ? '✅' : 'ℹ️',
        message: n.message,
        time: new Date(n.created_at).toLocaleString('id-ID'),
      })));
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return { stats, recentActivity, isLoading, reload: loadDashboard };
}
