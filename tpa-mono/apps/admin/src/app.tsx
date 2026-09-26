import { h } from 'preact';
import { useState, useMemo, useCallback } from 'preact/hooks';
import { useAuth, Layout, FullPageSpinner, LoginForm } from '@shared/index';
import type { NavItem } from '@shared/organisms/Sidebar';
import { useNotifications } from '@shared/hooks/useNotification';
import { Router } from './router';

const NAV_ITEMS: NavItem[] = [
  { icon: '📊', label: 'Dashboard', href: '/' },
  { icon: '👨‍🎓', label: 'Santri', href: '/students' },
  { icon: '👳', label: 'Ustadz', href: '/teachers' },
  { icon: '👨‍👩‍👧', label: 'Wali Santri', href: '/guardians' },
  { icon: '🏫', label: 'Kelas', href: '/classes' },
  { icon: '📅', label: 'Jadwal', href: '/schedules' },
  { icon: '📖', label: 'Kurikulum', href: '/curriculum' },
  { icon: '✅', label: 'Absensi', href: '/attendance' },
  { icon: '🕌', label: 'Hafalan', href: '/hafalan' },
  { icon: '📕', label: 'Iqro', href: '/iqro' },
  { icon: '💰', label: 'Pembayaran', href: '/payments' },
  { icon: '🏦', label: 'Kas', href: '/cash-flow' },
  { icon: '📋', label: 'Laporan', href: '/reports' },
  { icon: '🎓', label: 'Sertifikat', href: '/certificates' },
  { icon: '📁', label: 'Proyek', href: '/projects' },
  { icon: '🏢', label: 'Lokasi', href: '/locations' },
  { icon: '⚙️', label: 'Pengaturan', href: '/settings' },
];

export function App() {
  const { user, isAuthenticated, isLoading, login, logout, error } = useAuth();
  const [activeHref, setActiveHref] = useState(window.location.pathname);
  const { unreadCount } = useNotifications(user?.id);

  const navItems = useMemo(() =>
    NAV_ITEMS.map(item =>
      item.href === '/notifications' ? { ...item, badge: unreadCount } : item
    ),
    [unreadCount]
  );

  const handleNavigate = useCallback((href: string) => {
    setActiveHref(href);
    window.history.pushState(null, '', href);
  }, []);

  if (isLoading) return <FullPageSpinner />;

  if (!isAuthenticated || !user) {
    return <LoginForm onSubmit={login} error={error || undefined} subtitle="Panel Admin" />;
  }

  return (
    <Layout
      navItems={navItems}
      activeHref={activeHref}
      onNavigate={handleNavigate}
      title={NAV_ITEMS.find(n => n.href === activeHref)?.label || 'Dashboard'}
      userName={user.name}
      userAvatar={user.avatar_url || undefined}
      notificationCount={unreadCount}
      onNotificationClick={() => handleNavigate('/notifications')}
      onLogout={logout}
    >
      <Router activeHref={activeHref} />
    </Layout>
  );
}
