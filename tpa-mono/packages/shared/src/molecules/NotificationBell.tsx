import { h } from 'preact';

export interface NotificationBellProps {
  count: number;
  onClick: () => void;
}

export function NotificationBell({ count, onClick }: NotificationBellProps) {
  return (
    <button
      onClick={onClick}
      class="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
      title="Notifikasi"
    >
      <span class="text-xl">🔔</span>
      {count > 0 && (
        <span class="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  );
}
