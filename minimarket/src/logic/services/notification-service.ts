import { notifications } from "@/logic/state/app-state";
import type { AppNotification, NotificationType } from "@/data/types/notification";
import { generateId } from "@/logic/utils/format";

class NotificationService {
  add(type: NotificationType, title: string, message: string, link?: string): AppNotification {
    const n: AppNotification = {
      id: generateId(), type, title, message, read: false,
      createdAt: new Date().toISOString(), link
    };
    notifications.value = [n, ...notifications.value];
    return n;
  }

  markRead(id: string) {
    notifications.value = notifications.value.map(n => n.id === id ? { ...n, read: true } : n);
  }

  markAllRead() {
    notifications.value = notifications.value.map(n => ({ ...n, read: true }));
  }

  delete(id: string) {
    notifications.value = notifications.value.filter(n => n.id !== id);
  }

  checkLowStock(products: { name: string; stock: number; minStock: number }[]) {
    products.filter(p => p.stock <= p.minStock).forEach(p => {
      this.add("warning", "Stok Menipis", `${p.name} tersisa ${p.stock} unit`, "stock");
    });
  }
}

export const notificationService = new NotificationService();
