/**
 * Canonical Per-User Notification Service
 * Phase 2B-3B: Per-User Notification Storage Foundation
 *
 * Manages notification subscriptions, read/unread states, and isolated per-user records.
 *
 * CANONICAL FIRESTORE PATH:
 * artifacts/timbersmith-terminal-v1/users/{userId}/notifications/{notificationId}
 *
 * CRITICAL ARCHITECTURAL CONSTRAINTS:
 * 1. Each notification record belongs EXCLUSIVELY to one recipient (recipientUserId).
 * 2. Unread status and "mark as read" are STRICTLY PER-USER. No global/shared read flags.
 * 3. Deletion removes only the user's isolated record; other recipients are unaffected.
 * 4. FIRESTORE SAFETY GUARD: Live Firestore writes are strictly blocked in this phase
 *    because Preview Safety does not yet cover user notification subcollections.
 *    Mutations are safely simulated in-memory/local state to protect production data.
 */

import { db, APP_ID_PATH } from '../firebase';
import {
  UserNotification,
  BusinessEvent,
  NotificationPolicy,
  NotificationCoalesceInfo
} from '../types/notification';

// ==========================================
// PATH & HELPER DEFINITIONS
// ==========================================

export function getUserNotificationPath(userId: string, notificationId: string): string {
  return `artifacts/${APP_ID_PATH}/users/${userId}/notifications/${notificationId}`;
}

export function getUserNotificationsCollectionPath(userId: string): string {
  return `artifacts/${APP_ID_PATH}/users/${userId}/notifications`;
}

/**
 * Computes a deterministic coalesce key for grouping identical events.
 */
export function computeCoalesceKey(eventId: string, entityId?: string): string {
  return entityId ? `${eventId}:${entityId}` : eventId;
}

/**
 * Checks whether an event timestamp falls within the configured coalescing window.
 */
export function isWithinCoalesceWindow(lastEventAt: string, windowMinutes: number): boolean {
  if (windowMinutes <= 0) return false;
  const lastTime = new Date(lastEventAt).getTime();
  const now = Date.now();
  const diffMinutes = (now - lastTime) / (1000 * 60);
  return diffMinutes >= 0 && diffMinutes <= windowMinutes;
}

// In-memory per-user storage pool (isolated per userId)
const inMemoryUserNotifications = new Map<string, UserNotification[]>();

// Per-user subscription listeners: Map<userId, Set<callback>>
const userListeners = new Map<string, Set<(notifications: UserNotification[]) => void>>();

function notifyUserListeners(userId: string, notifications: UserNotification[]): void {
  const listeners = userListeners.get(userId);
  if (!listeners) return;
  listeners.forEach(callback => {
    try {
      callback(notifications);
    } catch (err) {
      console.error(`Error notifying listener for user ${userId}:`, err);
    }
  });
}

// ==========================================
// USER NOTIFICATION SERVICE
// ==========================================

export const userNotificationService = {
  /**
   * Retrieves in-memory notifications for a user, sorted descending by creation date.
   */
  getLocalNotifications(userId: string): UserNotification[] {
    const list = inMemoryUserNotifications.get(userId) || [];
    return [...list].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  /**
   * Subscribes to notifications for a specific user.
   * Connects to live Firestore snapshot listener if available; maintains in-memory pool.
   */
  subscribeToUserNotifications(
    userId: string,
    callback: (notifications: UserNotification[]) => void
  ): () => void {
    if (!userId) {
      callback([]);
      return () => {};
    }

    if (!userListeners.has(userId)) {
      userListeners.set(userId, new Set());
    }
    userListeners.get(userId)!.add(callback);

    // Initial callback with current memory pool
    callback(this.getLocalNotifications(userId));

    // Attach read-only Firestore snapshot listener if db is initialized
    let unsubscribeFirestore: (() => void) | null = null;
    if (db && APP_ID_PATH) {
      try {
        const collRef = db.collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('users')
          .doc(userId)
          .collection('notifications');

        unsubscribeFirestore = collRef.onSnapshot(
          snapshot => {
            if (!snapshot) return;
            const liveItems: UserNotification[] = [];
            snapshot.forEach(docSnap => {
              const data = docSnap.data() as UserNotification;
              if (data && data.recipientUserId === userId) {
                liveItems.push(data);
              }
            });

            // Update in-memory pool for this user
            liveItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
            inMemoryUserNotifications.set(userId, liveItems);
            notifyUserListeners(userId, liveItems);
          },
          err => {
            console.warn(`[USER NOTIFICATION SERVICE] Firestore snapshot notice for ${userId}:`, err.message);
          }
        );
      } catch (err) {
        console.warn(`[USER NOTIFICATION SERVICE] Firestore subscription unavailable for ${userId}:`, err);
      }
    }

    // Unsubscribe cleanup
    return () => {
      const listeners = userListeners.get(userId);
      if (listeners) {
        listeners.delete(callback);
        if (listeners.size === 0) {
          userListeners.delete(userId);
        }
      }
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
      }
    };
  },

  /**
   * Retrieves all notifications for a specific user.
   */
  async getUserNotifications(userId: string): Promise<UserNotification[]> {
    if (!userId) return [];

    if (db && APP_ID_PATH) {
      try {
        const snap = await db.collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('users')
          .doc(userId)
          .collection('notifications')
          .get();

        if (!snap.empty) {
          const items: UserNotification[] = [];
          snap.forEach(d => {
            const item = d.data() as UserNotification;
            if (item && item.recipientUserId === userId) {
              items.push(item);
            }
          });
          items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          inMemoryUserNotifications.set(userId, items);
          return items;
        }
      } catch (err) {
        console.warn(`[USER NOTIFICATION SERVICE] Error fetching notifications for ${userId}:`, err);
      }
    }

    return this.getLocalNotifications(userId);
  },

  /**
   * Retrieves unread notifications for a specific user.
   */
  async getUnreadNotifications(userId: string): Promise<UserNotification[]> {
    const all = await this.getUserNotifications(userId);
    return all.filter(n => !n.isRead);
  },

  /**
   * Calculates the unread count for a specific user.
   */
  async getUnreadCount(userId: string): Promise<number> {
    const unread = await this.getUnreadNotifications(userId);
    return unread.length;
  },

  // ==========================================
  // WRITE OPERATIONS (CONTROLLED & GUARDED)
  // ==========================================

  /**
   * Creates a notification for a single recipient user.
   *
   * SAFETY GUARD: Direct live Firestore writes are strictly blocked in this phase
   * pending Preview Safety coverage. Operations are simulated in-memory only.
   */
  async createNotificationForUser(
    userId: string,
    notificationData: Omit<UserNotification, 'notificationId' | 'recipientUserId' | 'isRead' | 'readAt'>
  ): Promise<UserNotification> {
    if (!userId) {
      throw new Error('Cannot create notification: recipientUserId is required.');
    }

    const notificationId = `UNOTIF-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const newNotification: UserNotification = {
      ...notificationData,
      notificationId,
      recipientUserId: userId,
      isRead: false,
      readAt: null
    };

    // Coalescing check on in-memory pool
    const userPool = inMemoryUserNotifications.get(userId) || [];
    if (newNotification.coalescing?.coalesceKey) {
      const matchIndex = userPool.findIndex(
        n => !n.isRead &&
             n.coalescing?.coalesceKey === newNotification.coalescing?.coalesceKey &&
             isWithinCoalesceWindow(n.coalescing.lastEventAt, 60)
      );

      if (matchIndex !== -1) {
        const existing = userPool[matchIndex];
        const updatedCoalesce: NotificationCoalesceInfo = {
          coalesceKey: existing.coalescing!.coalesceKey,
          coalesceCount: (existing.coalescing!.coalesceCount || 1) + 1,
          firstEventAt: existing.coalescing!.firstEventAt,
          lastEventAt: newNotification.createdAt
        };

        const updatedNotif: UserNotification = {
          ...existing,
          title: newNotification.title,
          description: newNotification.description,
          coalescing: updatedCoalesce
        };

        userPool[matchIndex] = updatedNotif;
        inMemoryUserNotifications.set(userId, [...userPool]);
        notifyUserListeners(userId, this.getLocalNotifications(userId));

        console.info(
          `[USER NOTIFICATION SERVICE] Coalesced notification for ${userId} (Count: ${updatedCoalesce.coalesceCount}). Live Firestore write blocked pending Preview Safety.`
        );
        return updatedNotif;
      }
    }

    // Add to user in-memory pool
    userPool.unshift(newNotification);
    inMemoryUserNotifications.set(userId, userPool);
    notifyUserListeners(userId, this.getLocalNotifications(userId));

    console.info(
      `[USER NOTIFICATION SERVICE] Created in-memory notification ${notificationId} for user ${userId}. Live Firestore write blocked pending Preview Safety.`
    );

    return newNotification;
  },

  /**
   * Dispatches a notification to multiple resolved recipient user IDs.
   */
  async createNotificationForResolvedUsers(
    recipientUserIds: readonly string[],
    notificationData: Omit<UserNotification, 'notificationId' | 'recipientUserId' | 'isRead' | 'readAt'>
  ): Promise<UserNotification[]> {
    if (!recipientUserIds || recipientUserIds.length === 0) {
      return [];
    }

    const createdNotifications: UserNotification[] = [];
    for (const userId of recipientUserIds) {
      const created = await this.createNotificationForUser(userId, notificationData);
      createdNotifications.push(created);
    }

    return createdNotifications;
  },

  /**
   * Marks an individual notification as read for a specific user.
   * Strictly affects only this user's state.
   */
  async markAsRead(userId: string, notificationId: string): Promise<boolean> {
    if (!userId || !notificationId) return false;

    const userPool = inMemoryUserNotifications.get(userId) || [];
    const target = userPool.find(n => n.notificationId === notificationId);
    if (!target) return false;

    const updated = userPool.map(n => {
      if (n.notificationId === notificationId) {
        return {
          ...n,
          isRead: true,
          readAt: new Date().toISOString()
        };
      }
      return n;
    });

    inMemoryUserNotifications.set(userId, updated);
    notifyUserListeners(userId, this.getLocalNotifications(userId));

    console.info(
      `[USER NOTIFICATION SERVICE] Marked ${notificationId} as read for user ${userId}. Live Firestore write blocked pending Preview Safety.`
    );

    return true;
  },

  /**
   * Marks all notifications as read for a specific user.
   * Strictly affects only this user's state.
   */
  async markAllAsRead(userId: string): Promise<number> {
    if (!userId) return 0;

    const userPool = inMemoryUserNotifications.get(userId) || [];
    let count = 0;
    const now = new Date().toISOString();

    const updated = userPool.map(n => {
      if (!n.isRead) {
        count++;
        return {
          ...n,
          isRead: true,
          readAt: now
        };
      }
      return n;
    });

    inMemoryUserNotifications.set(userId, updated);
    notifyUserListeners(userId, this.getLocalNotifications(userId));

    console.info(
      `[USER NOTIFICATION SERVICE] Marked ${count} notifications as read for user ${userId}. Live Firestore write blocked pending Preview Safety.`
    );

    return count;
  },

  /**
   * Deletes an individual notification for a specific user.
   * Strictly affects only this user's state.
   */
  async deleteNotification(userId: string, notificationId: string): Promise<boolean> {
    if (!userId || !notificationId) return false;

    const userPool = inMemoryUserNotifications.get(userId) || [];
    const filtered = userPool.filter(n => n.notificationId !== notificationId);

    if (filtered.length === userPool.length) return false;

    inMemoryUserNotifications.set(userId, filtered);
    notifyUserListeners(userId, this.getLocalNotifications(userId));

    console.info(
      `[USER NOTIFICATION SERVICE] Deleted notification ${notificationId} for user ${userId}. Live Firestore write blocked pending Preview Safety.`
    );

    return true;
  }
};
