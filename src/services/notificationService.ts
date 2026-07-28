import { db, APP_ID_PATH } from '../firebase';
import { GlobalNotification, NotificationCategory, NotificationPriority } from '../types';

const NOTIFICATIONS_STORAGE_KEY = 'tsj_global_notifications_v1';

// Initial sample data so the system is rich with realistic notifications immediately
const DEFAULT_NOTIFICATIONS: GlobalNotification[] = [
  {
    id: 'NOTIF-1001',
    category: 'leave_request',
    categoryLabel: 'Leave Requests',
    title: 'New Annual Leave Application',
    description: 'Sipho Mabena applied for 3 days Annual Leave (2026-08-01 to 2026-08-03).',
    date: '2026-07-23',
    time: '08:30',
    priority: 'high',
    isRead: false,
    relatedPage: 'leave_management',
    targetEmails: ['frans@tsjoinery.co.za', 'janah@tsjoinery.co.za'],
    targetRoles: ['Admin', 'Supervisor', 'HR'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'NOTIF-1002',
    category: 'stock_order',
    categoryLabel: 'Stock Orders',
    title: 'Reorder Point Reached: Oak Timber Boards',
    description: 'Stock level for 22mm White Oak Boards dropped below minimum threshold (Reorder Qty: 50).',
    date: '2026-07-23',
    time: '10:15',
    priority: 'medium',
    isRead: false,
    relatedPage: 'orders',
    targetEmails: ['frans@tsjoinery.co.za', 'janah@tsjoinery.co.za'],
    targetRoles: ['Admin', 'Supervisor'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'NOTIF-1003',
    category: 'clocking_exception',
    categoryLabel: 'Clocking Exceptions',
    title: 'Late Clock-In Flagged',
    description: 'Jabu Khumalo clocked in at 08:14 AM (Standard shift start: 07:30 AM).',
    date: '2026-07-23',
    time: '08:15',
    priority: 'high',
    isRead: false,
    relatedPage: 'analytics',
    targetEmails: ['frans@tsjoinery.co.za', 'janah@tsjoinery.co.za'],
    targetRoles: ['Admin', 'HR', 'Supervisor'],
    createdAt: new Date().toISOString()
  },
  {
    id: 'NOTIF-1004',
    category: 'employee_request',
    categoryLabel: 'Employee Requests',
    title: 'Wage Advance Request Pending',
    description: 'Pieter van der Merwe requested a cash advance of R 1,500.',
    date: '2026-07-22',
    time: '16:45',
    priority: 'medium',
    isRead: true,
    relatedPage: 'admin',
    targetEmails: ['frans@tsjoinery.co.za', 'janah@tsjoinery.co.za'],
    targetRoles: ['Admin', 'HR'],
    createdAt: new Date(Date.now() - 86400000).toISOString()
  },
  {
    id: 'NOTIF-1005',
    category: 'system_alert',
    categoryLabel: 'System Alerts',
    title: 'Automated Daily Attendance Sync Complete',
    description: '18 Artisan shifts successfully verified and backed up to Firebase cloud vault.',
    date: '2026-07-22',
    time: '18:00',
    priority: 'low',
    isRead: true,
    relatedPage: 'analytics',
    targetRoles: ['Admin', 'Supervisor', 'HR'],
    createdAt: new Date(Date.now() - 86400000).toISOString()
  }
];

export const notificationService = {
  getLocalNotifications(): GlobalNotification[] {
    try {
      const stored = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to parse local notifications:', e);
    }
    // Save defaults
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(DEFAULT_NOTIFICATIONS));
    return DEFAULT_NOTIFICATIONS;
  },

  saveLocalNotifications(list: GlobalNotification[]) {
    try {
      localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.warn('Failed to store local notifications:', e);
    }
  },

  async addNotification(notif: Omit<GlobalNotification, 'id' | 'createdAt' | 'isRead'>): Promise<GlobalNotification> {
    const id = `NOTIF-${Date.now()}`;
    const newNotif: GlobalNotification = {
      ...notif,
      id,
      isRead: false,
      createdAt: new Date().toISOString()
    };

    // 1. Local update
    const current = this.getLocalNotifications();
    const updated = [newNotif, ...current];
    this.saveLocalNotifications(updated);

    // 2. Firebase update
    if (db && APP_ID_PATH) {
      try {
        await db
          .collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('public')
          .doc('notifications')
          .collection('items')
          .doc(id)
          .set(newNotif);
      } catch (err) {
        console.warn('Firebase notification sync warn:', err);
      }
    }

    // 3. Email dispatch trigger for critical/important events
    if (newNotif.priority === 'high' || newNotif.priority === 'critical' || newNotif.category === 'leave_request' || newNotif.category === 'stock_order') {
      this.triggerEmailDispatchAlert(newNotif);
    }

    return newNotif;
  },

  triggerEmailDispatchAlert(notif: GlobalNotification) {
    const recipients = ['frans@tsjoinery.co.za', 'janah@tsjoinery.co.za'];
    const subject = encodeURIComponent(`[TS Joinery Alert] ${notif.title}`);
    const body = encodeURIComponent(
      `TS Joinery Notification Alert\n` +
      `----------------------------------------\n` +
      `Category: ${notif.categoryLabel}\n` +
      `Title: ${notif.title}\n` +
      `Date & Time: ${notif.date} at ${notif.time}\n` +
      `Priority: ${notif.priority.toUpperCase()}\n\n` +
      `Details:\n${notif.description}\n\n` +
      `----------------------------------------\n` +
      `Please log in to the TS Joinery PWA to take action.`
    );
    console.log(`[EMAIL DISPATCH TO ${recipients.join(', ')}]: mailto:${recipients.join(',')}?subject=${subject}&body=${body}`);
  },

  async markAsRead(id: string): Promise<void> {
    const current = this.getLocalNotifications();
    const updated = current.map(n => (n.id === id ? { ...n, isRead: true } : n));
    this.saveLocalNotifications(updated);

    if (db && APP_ID_PATH) {
      try {
        await db
          .collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('public')
          .doc('notifications')
          .collection('items')
          .doc(id)
          .update({ isRead: true });
      } catch (e) {
        console.warn('Firebase mark as read failed:', e);
      }
    }
  },

  async markAllAsRead(): Promise<void> {
    const current = this.getLocalNotifications();
    const updated = current.map(n => ({ ...n, isRead: true }));
    this.saveLocalNotifications(updated);

    if (db && APP_ID_PATH) {
      try {
        const batch = db.batch();
        const snapshot = await db
          .collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('public')
          .doc('notifications')
          .collection('items')
          .get();
        snapshot.docs.forEach(doc => {
          batch.update(doc.ref, { isRead: true });
        });
        await batch.commit();
      } catch (e) {
        console.warn('Firebase mark all read batch failed:', e);
      }
    }
  },

  async deleteNotification(id: string): Promise<void> {
    const current = this.getLocalNotifications();
    const updated = current.filter(n => n.id !== id);
    this.saveLocalNotifications(updated);

    if (db && APP_ID_PATH) {
      try {
        await db
          .collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('public')
          .doc('notifications')
          .collection('items')
          .doc(id)
          .delete();
      } catch (e) {
        console.warn('Firebase delete notification failed:', e);
      }
    }
  },

  subscribeNotifications(callback: (notifications: GlobalNotification[]) => void) {
    // Return initial local state first
    callback(this.getLocalNotifications());

    if (db && APP_ID_PATH) {
      try {
        const unsubscribe = db
          .collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('public')
          .doc('notifications')
          .collection('items')
          .onSnapshot(
            snapshot => {
              if (snapshot && !snapshot.empty) {
                const firebaseItems: GlobalNotification[] = [];
                snapshot.forEach(doc => {
                  firebaseItems.push(doc.data() as GlobalNotification);
                });
                firebaseItems.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
                this.saveLocalNotifications(firebaseItems);
                callback(firebaseItems);
              }
            },
            err => {
              console.warn('Firebase notification subscription error:', err);
              callback(this.getLocalNotifications());
            }
          );
        return unsubscribe;
      } catch (e) {
        console.warn('Unable to subscribe to Firebase notifications:', e);
      }
    }

    return () => {};
  },

  filterForUser(
    notifications: GlobalNotification[],
    userRole?: string,
    userEmail?: string
  ): GlobalNotification[] {
    const normalizedEmail = (userEmail || '').trim().toLowerCase();
    
    // Managers Frans and Janah get full administrative notification visibility
    if (normalizedEmail === 'frans@tsjoinery.co.za' || normalizedEmail === 'janah@tsjoinery.co.za') {
      return notifications;
    }

    // Role-based filtering
    return notifications.filter(n => {
      if (n.targetEmails && n.targetEmails.some(e => e.toLowerCase() === normalizedEmail)) {
        return true;
      }
      if (!userRole) return true;
      if (n.targetRoles && n.targetRoles.length > 0) {
        return n.targetRoles.includes(userRole);
      }
      return true;
    });
  }
};
