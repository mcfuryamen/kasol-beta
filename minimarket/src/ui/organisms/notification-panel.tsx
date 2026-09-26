import { notifications } from "@/logic/state/app-state";
import { notificationService } from "@/logic/services/notification-service";
import { Icons } from "@/ui/atoms/icon";
import { formatDateTime } from "@/logic/utils/format";
import { Badge } from "@/ui/atoms/badge";

const typeColors: Record<string, string> = {
  info: "text-blue-500", warning: "text-yellow-500", error: "text-red-500", success: "text-green-500"
};
const typeBg: Record<string, string> = {
  info: "bg-blue-100 dark:bg-blue-900/30", warning: "bg-yellow-100 dark:bg-yellow-900/30",
  error: "bg-red-100 dark:bg-red-900/30", success: "bg-green-100 dark:bg-green-900/30"
};

export function NotificationPanel({ onClose }: { onClose: () => void }) {
  const items = notifications.value;
  return (
    <div class="absolute right-0 top-10 w-80 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-700 overflow-hidden z-50">
      <div class="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
        <h3 class="font-semibold text-gray-900 dark:text-gray-100">Notifikasi</h3>
        <div class="flex gap-2">
          {items.some(n => !n.read) && (
            <button onClick={() => notificationService.markAllRead()} class="text-xs text-primary-500 hover:text-primary-600 font-medium">Tandai semua dibaca</button>
          )}
          <button onClick={onClose} class="text-gray-400 hover:text-gray-600"><Icons.X size={18} /></button>
        </div>
      </div>
      <div class="max-h-80 overflow-y-auto scrollbar-thin">
        {items.length === 0 ? (
          <div class="p-8 text-center text-gray-400 text-sm">Tidak ada notifikasi</div>
        ) : (
          items.slice(0, 20).map(n => (
            <div
              key={n.id}
              class={`p-4 border-b border-gray-50 dark:border-gray-700/50 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${!n.read ? "bg-primary-50/50 dark:bg-primary-900/10" : ""}`}
              onClick={() => notificationService.markRead(n.id)}
            >
              <div class="flex items-start gap-3">
                <div class={`p-1.5 rounded-lg flex-shrink-0 ${typeBg[n.type]}`}>
                  <Icons.Bell size={14} class={typeColors[n.type]} />
                </div>
                <div class="flex-1 min-w-0">
                  <p class="text-sm font-medium text-gray-900 dark:text-gray-100">{n.title}</p>
                  <p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{n.message}</p>
                  <p class="text-[10px] text-gray-400 mt-1">{formatDateTime(n.createdAt)}</p>
                </div>
                {!n.read && <div class="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0 mt-1" />}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
