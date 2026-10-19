import { db, APP_ID_PATH } from './firebase';

export interface AuditLogEntry {
  event: string;
  actor: string;
  details: string;
  timestamp: string;
}

let testAuditDb: any = null;
export function setAuditDbForTesting(customDb?: any): void {
  testAuditDb = customDb || null;
}

export const auditLogger = {
  async log(event: string, actor: string, details: string = ''): Promise<AuditLogEntry> {
    const timestamp = new Date().toISOString();
    const entry: AuditLogEntry = { event, actor, details, timestamp };

    if (typeof window !== 'undefined') {
      const globalWindow = window as any;
      if (!globalWindow.auditLogEntries) {
        globalWindow.auditLogEntries = [];
      }
      globalWindow.auditLogEntries.push(entry);
    }

    console.log(`[AUDIT] ${event} by ${actor}: ${details}`);

    const database = testAuditDb || db;
    if (database && APP_ID_PATH) {
      try {
        await database.collection('artifacts')
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

if (typeof window !== 'undefined') {
  (window as any).auditLogger = auditLogger;
}
