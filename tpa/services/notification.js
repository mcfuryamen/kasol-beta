/**
 * Notification Service
 * Notifikasi lokal (offline-first, tanpa websocket)
 */
import { db } from '../db/dexie.js';

/** Tambah notifikasi */
export async function addNotification(data) {
  return db.notifications.add({
    ...data,
    isRead: false,
    createdAt: new Date().toISOString()
  });
}

/** Get notifikasi user */
export async function getUserNotifications(userId, limit = 50) {
  return db.notifications
    .where('userId').equals(userId)
    .reverse()
    .sortBy('createdAt')
    .then(ns => ns.slice(0, limit));
}

/** Get notifikasi belum dibaca */
export async function getUnreadNotifications(userId) {
  return db.notifications
    .where('userId').equals(userId)
    .and(n => !n.isRead)
    .toArray();
}

/** Hitung notifikasi belum dibaca */
export async function getUnreadCount(userId) {
  return db.notifications
    .where('userId').equals(userId)
    .and(n => !n.isRead)
    .count();
}

/** Tandai sudah dibaca */
export async function markAsRead(notificationId) {
  await db.notifications.update(notificationId, { isRead: true });
}

/** Tandai semua sudah dibaca */
export async function markAllAsRead(userId) {
  const unread = await getUnreadNotifications(userId);
  await Promise.all(unread.map(n => db.notifications.update(n.id, { isRead: true })));
}

/** Hapus notifikasi */
export async function deleteNotification(id) {
  await db.notifications.delete(id);
}

/** Bersihkan notifikasi lama (> 30 hari) */
export async function cleanOldNotifications(userId) {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const old = await db.notifications
    .where('userId').equals(userId)
    .and(n => n.createdAt < cutoff)
    .toArray();
  await Promise.all(old.map(n => db.notifications.delete(n.id)));
}
