import type { ClockJournalEvent } from './clockJournal';
import type { ClockSyncReceipt, ClockSyncTransport } from './clockSync';

/**
 * Test-only authenticated bridge between the durable IndexedDB journal and
 * the server. Existing username/PIN logins are NEVER used as API credentials.
 * A separate, approved kiosk Firebase identity supplies the ID token.
 *
 * This transport is not yet connected to production clocking.
 */
export type KioskIdTokenProvider = () => Promise<string>;
export type KioskFetch = typeof fetch;

export function createAuthenticatedClockTestTransport(
  getIdToken: KioskIdTokenProvider,
  registeredDeviceId: string,
  options: { fetchImpl?: KioskFetch; timeoutMs?: number } = {}
): ClockSyncTransport {
  if (!/^[A-Za-z0-9_-]{8,128}$/.test(registeredDeviceId)) {
    throw new Error('A registered kiosk device ID is required.');
  }
  const request = options.fetchImpl || fetch;
  const timeoutMs = options.timeoutMs ?? 12000;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1000 || timeoutMs > 60000) {
    throw new Error('Clock transport timeout must be between 1 and 60 seconds.');
  }

  return async (event: ClockJournalEvent): Promise<ClockSyncReceipt> => {
    if (event.deviceId !== registeredDeviceId) {
      throw new Error('Queued event belongs to a different kiosk device.');
    }
    const token = await getIdToken();
    if (!token || typeof token !== 'string') {
      // Missing/expired credentials never discard an offline event.
      throw new Error('Registered kiosk authentication is unavailable; keep event pending.');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await request('/api/clocking/test-replay', {
        method: 'POST',
        credentials: 'omit',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token,
          'X-Clock-Device-ID': registeredDeviceId
        },
        body: JSON.stringify({
          event: {
            id: event.id,
            employeeId: event.employeeId,
            deviceId: event.deviceId,
            action: event.action,
            occurredAt: event.occurredAt
          }
        }),
        signal: controller.signal
      });
      if (response.status === 401 || response.status === 403) {
        throw new Error('Kiosk authorization refused. Event remains locally pending.');
      }
      if (response.status === 503 || response.status === 502 ||
          response.status === 504 || response.status === 429) {
        throw new Error('Clock server unavailable. Event remains locally pending.');
      }
      let payload: unknown;
      try { payload = await response.json(); }
      catch { throw new Error('Clock server did not provide a valid acknowledgement.'); }
      if (response.status === 422) {
        const error = payload && typeof payload === 'object'
          ? (payload as Record<string,unknown>).error
          : undefined;
        return {
          result: 'rejected', eventId: event.id,
          reason: typeof error === 'string' ? error.slice(0,500) : 'Clock event requires supervisor review.'
        };
      }
      if (response.status !== 200 && response.status !== 409) {
        throw new Error('Clock server returned an unexpected response.');
      }
      if (!payload || typeof payload !== 'object') {
        throw new Error('Clock server acknowledgement was missing.');
      }
      const result = payload as Record<string,unknown>;
      if (result.eventId !== event.id ||
          !['committed','already_committed','rejected'].includes(String(result.result))) {
        // Never mark confirmed when the receipt does not match the queued ID.
        throw new Error('Clock server acknowledgement was invalid or mismatched.');
      }
      if (response.status === 200 && result.result === 'rejected' ||
          response.status === 409 && result.result !== 'rejected') {
        throw new Error('Clock server response status and receipt disagree.');
      }
      return result.result === 'rejected'
        ? { result:'rejected', eventId:event.id,
            reason:typeof result.reason === 'string' ? result.reason.slice(0,500) : 'Clock event rejected.' }
        : { result:result.result as 'committed'|'already_committed',eventId:event.id };
    } catch (error) {
      if (controller.signal.aborted) {
        throw new Error('Clock server response timed out. Original event remains pending.');
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  };
}
