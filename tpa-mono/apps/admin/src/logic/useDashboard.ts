import { useState, useEffect } from 'preact/hooks';
import { useAuth } from '@shared/hooks/useAuth';
import { getDashboardStats, initOfflineData } from '@shared/data/service';

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

  const loadDashboard = async () => {
    try {
      await initOfflineData();
      const s = await getDashboardStats();
      setStats({ ...stats, ...s });
      setRecentActivity([
        { icon: '📖', message: 'Demo mode - data dari IndexedDB lokal', time: new Date().toLocaleString('id-ID') },
        { icon: '💰', message: 'Sync queue aktif saat online', time: new Date().toLocaleString('id-ID') },
        { icon: '✅', message: 'Semua data tersimpan offline', time: new Date().toLocaleString('id-ID') },
      ]);
    } catch (err) {
      console.error('[Dashboard] Load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [user?.location_id]);

  return { stats, recentActivity, isLoading, reload: loadDashboard };
}
