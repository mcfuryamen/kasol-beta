import { h } from 'preact';
import { useState, useMemo, useCallback } from 'preact/hooks';
import { useAuth, Layout, FullPageSpinner, LoginForm } from '@shared/index';
import type { NavItem } from '@shared/organisms/Sidebar';
import { useNotifications } from '@shared/hooks/useNotification';
import { Router } from './router';

const NAV_ITEMS: NavItem[] = [
  { icon: '📊', label: 'Dashboard', href: '/' },
  { icon: '🏫', label: 'Kelas Saya', href: '/my-classes' },
  { icon: '✅', label: 'Absensi', href: '/attendance' },
  { icon: '🕌', label: 'Input Hafalan', href: '/hafalan' },
  { icon: '📕', label: 'Input Iqro', href: '/iqro' },
  { icon: '📈', label: 'Progres Santri', href: '/progress' },
  { icon: '📖', label: 'Kurikulum', href: '/curriculum' },
  { icon: '📅', label: 'Jadwal', href: '/schedule' },
  { icon: '📝', label: 'Catatan', href: '/notes' },
  { icon: '📁', label: 'Proyek', href: '/projects' },
];

export function App() {
  const { user, isAuthenticated, isLoading, login, logout, error } = useAuth();
  const [activeHref, setActiveHref] = useState(window.location.pathname);
  const { unreadCount } = useNotifications(user?.id);

  const handleNavigate = useCallback((href: string) => {
    setActiveHref(href);
    window.history.pushState(null, '', href);
  }, []);

  if (isLoading) return <FullPageSpinner />;
  if (!isAuthenticated || !user) {
    return <LoginForm onSubmit={login} error={error || undefined} subtitle="Panel Ustadz" />;
  }

  return (
    <Layout
      navItems={NAV_ITEMS}
      activeHref={activeHref}
      onNavigate={handleNavigate}
      title={NAV_ITEMS.find(n => n.href === activeHref)?.label || 'Dashboard'}
      userName={user.name}
      notificationCount={unreadCount}
      onNotificationClick={() => handleNavigate('/notifications')}
      onLogout={logout}
    >
      <Router activeHref={activeHref} />
    </Layout>
  );
}
