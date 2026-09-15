import { h } from 'preact';
import { useState, useCallback } from 'preact/hooks';
import { useAuth, Layout, FullPageSpinner, LoginForm } from '@shared/index';
import type { NavItem } from '@shared/organisms/Sidebar';
import { useNotifications } from '@shared/hooks/useNotification';
import { Router } from './router';

const NAV_ITEMS: NavItem[] = [
  { icon: '📊', label: 'Dashboard', href: '/' },
  { icon: '👨‍🎓', label: 'Progres Anak', href: '/progress' },
  { icon: '🕌', label: 'Hafalan', href: '/hafalan' },
  { icon: '📕', label: 'Iqro', href: '/iqro' },
  { icon: '✅', label: 'Kehadiran', href: '/attendance' },
  { icon: '💰', label: 'Pembayaran', href: '/payments' },
  { icon: '📋', label: 'Rapor', href: '/rapor' },
  { icon: '🔔', label: 'Notifikasi', href: '/notifications' },
];

export function App() {
  const { user, isAuthenticated, isLoading, login, logout, error } = useAuth();
  const [activeHref, setActiveHref] = useState(window.location.pathname);
  const { unreadCount } = useNotifications(user?.id);

  const navItems = NAV_ITEMS.map(item =>
    item.href === '/notifications' ? { ...item, badge: unreadCount } : item
  );

  const handleNavigate = useCallback((href: string) => {
    setActiveHref(href);
    window.history.pushState(null, '', href);
  }, []);

  if (isLoading) return <FullPageSpinner />;
  if (!isAuthenticated || !user) {
    return <LoginForm onSubmit={login} error={error || undefined} subtitle="Portal Wali Santri" />;
  }

  return (
    <Layout
      navItems={navItems}
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
