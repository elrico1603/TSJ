import { db, APP_ID_PATH } from './firebase';

export interface AuditLogEntry {
  event: string;
  actor: string;
  details: string;
  timestamp: string;
}

export const auditLogger = {
  async log(event: string, actor: string, details: string = ''): Promise<AuditLogEntry> {
    const timestamp = new Date().toISOString();
    const entry: AuditLogEntry = { event, actor, details, timestamp };

    const globalWindow = window as any;
    if (!globalWindow.auditLogEntries) {
      globalWindow.auditLogEntries = [];
    }
    globalWindow.auditLogEntries.push(entry);

    console.log(`[AUDIT] ${event} by ${actor}: ${details}`);

    if (db && APP_ID_PATH) {
      try {
        await db.collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('private')
          .doc('audit')
          .collection('logs')
          .add(entry);
      } catch (error) {
        console.warn('Audit log sync failed:', error);
      }
    }

    return entry;
  }
};

(window as any).auditLogger = auditLogger;
