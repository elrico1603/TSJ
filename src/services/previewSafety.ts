/**
 * PREVIEW SAFETY GUARD
 * 
 * Prevents GAIS Preview and development environments from silently mutating
 * production Firebase Auth users, passwords, permissions, roles, overrides,
 * or user notification documents.
 * 
 * In GAIS Preview / Dev:
 * - READ live production data is fully supported.
 * - WRITES to Auth & RBAC Firestore collections are strictly blocked.
 * - WRITES to User Notification subcollections are strictly blocked.
 * - In-memory and local simulation remains functional for testing.
 * 
 * In Production:
 * - Normal authorized production writes proceed as standard.
 */

export function isDevelopmentPreview(): boolean {
  if (typeof window === 'undefined') {
    return process.env.NODE_ENV !== 'production';
  }
  const hostname = (window.location.hostname || '').toLowerCase();
  
  // Explicit flag to override if running a verified production build on custom host
  if ((window as any).__FORCE_PRODUCTION_WRITES__ === true) {
    return false;
  }

  return Boolean(
    (import.meta as any).env?.DEV ||
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname.includes('ais-dev-') ||
    hostname.includes('ais-pre-') ||
    hostname.endsWith('.run.app') ||
    hostname.includes('webcontainer')
  );
}

export function canMutateAuthOrRBAC(operation: string, target: string): boolean {
  if (isDevelopmentPreview()) {
    console.warn(
      `%c[PREVIEW SAFETY GUARD] BLOCKED LIVE WRITE%c\n` +
      `Operation: ${operation}\n` +
      `Target: ${target}\n` +
      `Reason: GAIS Preview is in READ-ONLY mode for Auth & RBAC to protect live production data.`,
      'background: #dc2626; color: white; font-weight: bold; padding: 2px 6px; border-radius: 4px;',
      'color: #f87171;'
    );
    return false;
  }
  return true;
}

export function canMutateNotifications(operation: string, targetUserId?: string): boolean {
  if (isDevelopmentPreview()) {
    console.warn(
      `%c[PREVIEW SAFETY GUARD] BLOCKED NOTIFICATION WRITE%c\n` +
      `Operation: ${operation}\n` +
      `Target User: ${targetUserId || 'N/A'}\n` +
      `Reason: GAIS Preview is in READ-ONLY mode for Notifications to protect live production data.`,
      'background: #dc2626; color: white; font-weight: bold; padding: 2px 6px; border-radius: 4px;',
      'color: #f87171;'
    );
    return false;
  }
  return true;
}

export function canMutateNotificationPolicies(
  operation: string,
  eventId?: string
): boolean {
  if (isDevelopmentPreview()) {
    console.warn(
      `%c[PREVIEW SAFETY GUARD] BLOCKED POLICY WRITE to live Firestore. Policy simulated in-memory.%c\n` +
      `Operation: ${operation}\n` +
      `Event ID: ${eventId || 'ALL_EVENTS'}\n` +
      `Reason: GAIS Preview is in READ-ONLY mode for Notification Policies to protect live production configuration.`,
      'background: #dc2626; color: white; font-weight: bold; padding: 2px 6px; border-radius: 4px;',
      'color: #f87171;'
    );
    return false;
  }
  return true;
}

export function canMutateSupplier(
  operation: string,
  supplierId?: string
): boolean {
  if (isDevelopmentPreview()) {
    console.warn(
      `%c[PREVIEW SAFETY GUARD] BLOCKED SUPPLIER WRITE to live Firestore. Supplier simulated in-memory/cache.%c\n` +
      `Operation: ${operation}\n` +
      `Supplier ID: ${supplierId || 'NEW'}\n` +
      `Reason: GAIS Preview is in READ-ONLY mode for Suppliers to protect live production master data.`,
      'background: #dc2626; color: white; font-weight: bold; padding: 2px 6px; border-radius: 4px;',
      'color: #f87171;'
    );
    return false;
  }
  return true;
}


