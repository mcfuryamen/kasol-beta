import { h, ComponentChildren } from 'preact';
import { NotificationBell } from '../molecules/NotificationBell';
import { Avatar } from '../atoms/Avatar';
import { useOffline } from '../hooks/useOffline';

export interface HeaderProps {
  title: string;
  subtitle?: string;
  userName: string;
  userAvatar?: string;
  notificationCount?: number;
  onNotificationClick?: () => void;
  onProfileClick?: () => void;
  actions?: ComponentChildren;
}

export function Header({
  title,
  subtitle,
  userName,
  userAvatar,
  notificationCount = 0,
  onNotificationClick,
  onProfileClick,
  actions,
}: HeaderProps) {
  const { isOnline } = useOffline();

  return (
    <header class="bg-white border-b border-gray-200 px-6 py-4">
      <div class="flex items-center justify-between">
        <div>
          <h1 class="text-xl font-bold text-gray-800">{title}</h1>
          {subtitle && <p class="text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
        <div class="flex items-center gap-3">
          {!isOnline && (
            <span class="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">
              ⚡ Offline
            </span>
          )}
          {actions}
          {onNotificationClick && (
            <NotificationBell count={notificationCount} onClick={onNotificationClick} />
          )}
          <button
            onClick={onProfileClick}
            class="flex items-center gap-2 hover:bg-gray-50 rounded-lg px-2 py-1 transition-colors"
          >
            <Avatar name={userName} src={userAvatar} size="sm" />
            <span class="text-sm font-medium text-gray-700 hidden sm:block">{userName}</span>
          </button>
        </div>
      </div>
    </header>
  );
}
