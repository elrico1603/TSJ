import { db, APP_ID_PATH } from '../firebase';

export interface QueuedAction {
  id: string;
  type: 'clocking' | 'stock_request' | 'leave_request' | 'generic';
  payload: any;
  timestamp: string;
}

const QUEUE_KEY = 'ts_hub_offline_queue_v1';

export const offlineSyncService = {
  getQueue(): QueuedAction[] {
    try {
      const stored = localStorage.getItem(QUEUE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      return [];
    }
  },

  enqueue(type: QueuedAction['type'], payload: any): QueuedAction {
    const queue = this.getQueue();
    const action: QueuedAction = {
      id: `QUEUED-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      type,
      payload,
      timestamp: new Date().toISOString(),
    };
    queue.push(action);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    return action;
  },

  clearQueue() {
    localStorage.removeItem(QUEUE_KEY);
  },

  async processQueue(onProgress?: (count: number) => void): Promise<{ success: number; failed: number }> {
    const queue = this.getQueue();
    if (queue.length === 0) return { success: 0, failed: 0 };

    let success = 0;
    let failed = 0;
    const remainingQueue: QueuedAction[] = [];

    for (const item of queue) {
      try {
        if (db && APP_ID_PATH) {
          if (item.type === 'clocking') {
            await db
              .collection('artifacts')
              .doc(APP_ID_PATH)
              .collection('public')
              .doc('data')
              .collection('clockingRecords')
              .doc(item.payload.id || item.id)
              .set(item.payload, { merge: true });
          } else if (item.type === 'stock_request') {
            await db
              .collection('artifacts')
              .doc(APP_ID_PATH)
              .collection('public')
              .doc('data')
              .collection('stockRequests')
              .doc(item.payload.id || item.id)
              .set(item.payload, { merge: true });
          } else if (item.type === 'leave_request') {
            await db
              .collection('artifacts')
              .doc(APP_ID_PATH)
              .collection('public')
              .doc('data')
              .collection('leaveRequests')
              .doc(item.payload.id || item.id)
              .set(item.payload, { merge: true });
          } else {
            await db
              .collection('artifacts')
              .doc(APP_ID_PATH)
              .collection('public')
              .doc('data')
              .collection('syncLogs')
              .doc(item.id)
              .set(item, { merge: true });
          }
          success++;
        } else {
          remainingQueue.push(item);
        }
      } catch (err) {
        console.warn('Failed to sync queued item:', item, err);
        failed++;
        remainingQueue.push(item);
      }
      if (onProgress) onProgress(remainingQueue.length);
    }

    localStorage.setItem(QUEUE_KEY, JSON.stringify(remainingQueue));
    return { success, failed };
  }
};
