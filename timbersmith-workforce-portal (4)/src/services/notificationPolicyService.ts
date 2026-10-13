/**
 * Canonical Notification Policy Service
 * Phase 2B-3G: Notification Policy Centre Implementation
 *
 * This service manages retrieval of canonical event definitions and effective notification policies.
 *
 * CANONICAL FIRESTORE PATH (Production only):
 * artifacts/{APP_ID_PATH}/private/config/notifications/policies/{eventId}
 *
 * CRITICAL ARCHITECTURAL CONSTRAINTS:
 * 1. Default policies are strictly sourced from notificationEventRegistry.
 * 2. Default recipientUserIds is strictly [] (empty array).
 * 3. Roles, departments, and emails have ZERO notification-routing authority.
 * 4. PREVIEW SAFETY: In GAIS Preview, canMutateNotificationPolicies() returns false.
 *    Policies are mutated and simulated strictly in memory (localPolicyOverrides)
 *    to protect production configuration.
 */

import {
  NotificationEventDefinition,
  NotificationPolicy
} from '../types/notification';
import {
  notificationEventRegistry
} from './notificationEventRegistry';
import { db, APP_ID_PATH } from '../firebase';
import { canMutateNotificationPolicies } from './previewSafety';

// In-memory local overrides map (transient; zero Firestore persistence in Preview)
const localPolicyOverrides = new Map<string, NotificationPolicy>();

// Subscribers for real-time policy updates
const policyListeners = new Set<(policies: NotificationPolicy[]) => void>();

function notifySubscribers(): void {
  const allEffective = notificationPolicyService.getAllEffectivePolicies();
  policyListeners.forEach(listener => {
    try {
      listener(allEffective);
    } catch (err) {
      console.error('[NOTIFICATION POLICY SERVICE] Error notifying subscriber:', err);
    }
  });
}

export const notificationPolicyService = {
  /**
   * Retrieves the canonical event definition from the event registry.
   */
  getEventDefinition(eventId: string): NotificationEventDefinition | undefined {
    return notificationEventRegistry.getEvent(eventId);
  },

  /**
   * Retrieves all canonical event definitions.
   */
  getAllEventDefinitions(): readonly NotificationEventDefinition[] {
    return notificationEventRegistry.getAllEvents();
  },

  /**
   * Generates the canonical default NotificationPolicy for a specific event ID.
   * recipientUserIds is strictly [] (empty array).
   */
  getDefaultPolicy(eventId: string): NotificationPolicy | undefined {
    const definition = notificationEventRegistry.getEvent(eventId);
    if (!definition) return undefined;
    return notificationEventRegistry.createDefaultPolicy(definition);
  },

  /**
   * Retrieves default policies for all canonical events.
   */
  getAllDefaultPolicies(): Record<string, NotificationPolicy> {
    return notificationEventRegistry.getDefaultPoliciesMap();
  },

  /**
   * Retrieves the effective policy for an event.
   * Checks in-memory local override first; falls back to the canonical default policy.
   */
  getEffectivePolicy(eventId: string): NotificationPolicy | undefined {
    const override = localPolicyOverrides.get(eventId);
    if (override) {
      return override;
    }
    return this.getDefaultPolicy(eventId);
  },

  /**
   * Retrieves all effective policies for all registered canonical events.
   */
  getAllEffectivePolicies(): NotificationPolicy[] {
    const definitions = this.getAllEventDefinitions();
    return definitions.map(def => this.getEffectivePolicy(def.eventId)!).filter(Boolean);
  },

  /**
   * Subscribes to real-time policy updates.
   * Immediately calls back with current effective policies.
   */
  subscribeToPolicies(callback: (policies: NotificationPolicy[]) => void): () => void {
    policyListeners.add(callback);
    callback(this.getAllEffectivePolicies());

    return () => {
      policyListeners.delete(callback);
    };
  },

  /**
   * Sets a local in-memory policy override (transient; for testing and simulation).
   */
  setLocalPolicyOverride(policy: NotificationPolicy): void {
    if (!policy || !policy.eventId) return;
    localPolicyOverrides.set(policy.eventId, policy);
    notifySubscribers();
  },

  /**
   * Clears a specific local in-memory override.
   */
  removeLocalPolicyOverride(eventId: string): void {
    localPolicyOverrides.delete(eventId);
    notifySubscribers();
  },

  /**
   * Clears all local in-memory policy overrides.
   */
  clearLocalPolicyOverrides(): void {
    localPolicyOverrides.clear();
    notifySubscribers();
  },

  /**
   * Saves an updated policy.
   * Updates in-memory state immediately for simulation.
   * In GAIS Preview, blocks persistent Firestore writes via Preview Safety.
   */
  async savePolicy(policy: NotificationPolicy): Promise<void> {
    if (!policy || !policy.eventId) {
      throw new Error('Cannot save policy: eventId is required.');
    }

    // 1. Immediately update in-memory simulation
    localPolicyOverrides.set(policy.eventId, { ...policy });
    notifySubscribers();

    // 2. Check Preview Safety Guard
    if (!canMutateNotificationPolicies('savePolicy', policy.eventId)) {
      console.info(
        `[NOTIFICATION POLICY SERVICE] Policy for ${policy.eventId} saved in-memory (Preview Mode). Live Firestore write blocked.`
      );
      return;
    }

    // 3. In verified production, persist to Firestore
    if (db && APP_ID_PATH) {
      try {
        await db.collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('private')
          .doc('config')
          .collection('notifications_policies')
          .doc(policy.eventId)
          .set({ ...policy }, { merge: true });
        console.info(`[NOTIFICATION POLICY SERVICE] Policy for ${policy.eventId} persisted to Firestore.`);
      } catch (err) {
        console.error(`[NOTIFICATION POLICY SERVICE] Failed to persist policy ${policy.eventId}:`, err);
        throw err;
      }
    }
  },

  /**
   * Resets an event policy back to its canonical default.
   */
  async resetPolicy(eventId: string): Promise<void> {
    if (!eventId) return;

    localPolicyOverrides.delete(eventId);
    notifySubscribers();

    if (!canMutateNotificationPolicies('resetPolicy', eventId)) {
      console.info(
        `[NOTIFICATION POLICY SERVICE] Policy for ${eventId} reset to canonical default in-memory. Live Firestore write blocked.`
      );
      return;
    }

    if (db && APP_ID_PATH) {
      try {
        await db.collection('artifacts')
          .doc(APP_ID_PATH)
          .collection('private')
          .doc('config')
          .collection('notifications_policies')
          .doc(eventId)
          .delete();
      } catch (err) {
        console.warn(`[NOTIFICATION POLICY SERVICE] Failed to delete Firestore policy ${eventId}:`, err);
      }
    }
  },

  /**
   * Resets all event policies back to their canonical defaults.
   */
  async resetAllPolicies(): Promise<void> {
    localPolicyOverrides.clear();
    notifySubscribers();

    if (!canMutateNotificationPolicies('resetAllPolicies')) {
      console.info(
        `[NOTIFICATION POLICY SERVICE] All policies reset to canonical defaults in-memory. Live Firestore write blocked.`
      );
      return;
    }

    // In production, batch delete would occur here if authorized
  }
};

