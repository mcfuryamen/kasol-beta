import { h } from 'preact';
import { StatCard, Card } from '@shared/index';
import { useDashboardData } from '../logic/useDashboard';

export function Dashboard() {
  const { stats, recentActivity, isLoading } = useDashboardData();

  return (
    <div class="space-y-6">
      {/* Stats Grid */}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="👨‍🎓" label="Total Santri" value={stats.totalStudents} color="orange" change={`${stats.activeStudents} aktif`} />
        <StatCard icon="👳" label="Ustadz" value={stats.totalTeachers} color="blue" change={`${stats.activeTeachers} aktif`} />
        <StatCard icon="🏫" label="Kelas" value={stats.totalClasses} color="green" />
        <StatCard icon="✅" label="Kehadiran Hari Ini" value={`${stats.todayAttendance}%`} color="purple"
          changeType={stats.todayAttendance >= 80 ? 'up' : 'down'}
          change={stats.todayAttendance >= 80 ? 'Baik' : 'Perlu perhatian'} />
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Financial Summary */}
        <Card title="Ringkasan Keuangan Bulan Ini">
          <div class="space-y-3">
            <div class="flex justify-between items-center py-2 border-b border-gray-50">
              <span class="text-sm text-gray-600">Total Tagihan SPP</span>
              <span class="font-semibold text-gray-800">Rp {stats.totalBills?.toLocaleString('id-ID') || 0}</span>
            </div>
            <div class="flex justify-between items-center py-2 border-b border-gray-50">
              <span class="text-sm text-gray-600">Sudah Dibayar</span>
              <span class="font-semibold text-green-600">Rp {stats.totalPaid?.toLocaleString('id-ID') || 0}</span>
            </div>
            <div class="flex justify-between items-center py-2 border-b border-gray-50">
              <span class="text-sm text-gray-600">Tunggakan</span>
              <span class="font-semibold text-red-600">Rp {stats.totalUnpaid?.toLocaleString('id-ID') || 0}</span>
            </div>
            <div class="flex justify-between items-center py-2">
              <span class="text-sm text-gray-600">Saldo Kas</span>
              <span class="font-bold text-orange-600 text-lg">Rp {stats.cashBalance?.toLocaleString('id-ID') || 0}</span>
            </div>
          </div>
        </Card>

        {/* Hafalan Progress Summary */}
        <Card title="Ringkasan Hafalan">
          <div class="space-y-3">
            <div class="flex justify-between items-center py-2 border-b border-gray-50">
              <span class="text-sm text-gray-600">Setoran Hari Ini</span>
              <span class="font-semibold">{stats.todayHafalan || 0} santri</span>
            </div>
            <div class="flex justify-between items-center py-2 border-b border-gray-50">
              <span class="text-sm text-gray-600">Total Setoran Bulan Ini</span>
              <span class="font-semibold">{stats.monthlyHafalan || 0} kali</span>
            </div>
            <div class="flex justify-between items-center py-2 border-b border-gray-50">
              <span class="text-sm text-gray-600">Santri Khatam Iqro</span>
              <span class="font-semibold text-green-600">{stats.iqroGraduated || 0}</span>
            </div>
            <div class="flex justify-between items-center py-2">
              <span class="text-sm text-gray-600">Rata-rata Nilai</span>
              <span class="font-bold text-orange-600">{stats.averageGrade || '-'}</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card title="Aktivitas Terbaru">
        <div class="space-y-3">
          {recentActivity.length === 0 ? (
            <p class="text-sm text-gray-400 py-4 text-center">Belum ada aktivitas</p>
          ) : (
            recentActivity.map((activity, i) => (
              <div key={i} class="flex items-start gap-3 py-2 border-b border-gray-50 last:border-0">
                <span class="text-lg">{activity.icon}</span>
                <div class="flex-1">
                  <p class="text-sm text-gray-700">{activity.message}</p>
                  <p class="text-xs text-gray-400">{activity.time}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
