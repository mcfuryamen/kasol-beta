import { h, ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { Sidebar, NavItem } from './Sidebar';
import { Header } from './Header';
import { ToastContainer } from '../atoms/Toast';

export interface LayoutProps {
  children: ComponentChildren;
  navItems: NavItem[];
  activeHref: string;
  onNavigate: (href: string) => void;
  title: string;
  subtitle?: string;
  userName: string;
  userAvatar?: string;
  notificationCount?: number;
  onNotificationClick?: () => void;
  onProfileClick?: () => void;
  onLogout?: () => void;
  headerActions?: ComponentChildren;
}

export function Layout({
  children,
  navItems,
  activeHref,
  onNavigate,
  title,
  subtitle,
  userName,
  userAvatar,
  notificationCount,
  onNotificationClick,
  onProfileClick,
  onLogout,
  headerActions,
}: LayoutProps) {
  return (
    <div class="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar
        items={navItems}
        activeHref={activeHref}
        onNavigate={onNavigate}
        userContent={
          onLogout && (
            <button
              onClick={onLogout}
              class="w-full text-left text-sm text-gray-500 hover:text-red-500 transition-colors flex items-center gap-2"
            >
              <span>🚪</span> Keluar
            </button>
          )
        }
      />
      <div class="flex-1 flex flex-col overflow-hidden">
        <Header
          title={title}
          subtitle={subtitle}
          userName={userName}
          userAvatar={userAvatar}
          notificationCount={notificationCount}
          onNotificationClick={onNotificationClick}
          onProfileClick={onProfileClick}
          actions={headerActions}
        />
        <main class="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}
