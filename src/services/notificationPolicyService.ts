/** Canonical notification policies. Stored policies are the source of truth.
 * Actual path: artifacts/{APP_ID_PATH}/private/config/notifications_policies/{eventId}.
 * Preview modifications are isolated from live policies.
 */
import { NotificationEventDefinition, NotificationPolicy } from '../types/notification';
import { notificationEventRegistry } from './notificationEventRegistry';
import { db, APP_ID_PATH } from '../firebase';
import { canMutateNotificationPolicies, isDevelopmentPreview } from './previewSafety';

const storedPolicies = new Map<string, NotificationPolicy>();
const localPolicyOverrides = new Map<string, NotificationPolicy>();
const policyListeners = new Set<(policies: NotificationPolicy[]) => void>();
let unsubscribeLive: (() => void) | null = null;
const collection = () => db.collection('artifacts').doc(APP_ID_PATH)
  .collection('private').doc('config').collection('notifications_policies');

function normalize(eventId: string, value: any): NotificationPolicy | undefined {
  const definition = notificationEventRegistry.getEvent(eventId);
  if (!definition || !value || typeof value.enabled !== 'boolean') return undefined;
  const base = notificationEventRegistry.createDefaultPolicy(definition);
  if (!['critical','high','normal','info','silent'].includes(value.priority)) return undefined;
  const minutes = Number(value.coalesceWindowMinutes);
  return {
    ...base, ...value, eventId, eventName: definition.eventName, groupId: definition.groupId,
    recipientUserIds: Array.isArray(value.recipientUserIds) ? [...new Set<string>(
      value.recipientUserIds.filter((id: unknown): id is string => typeof id === 'string' && !!id.trim() && !id.includes('/'))
    )] : [],
    coalesceEnabled: value.coalesceEnabled === true,
    coalesceWindowMinutes: Number.isFinite(minutes) ? Math.max(0,Math.min(10080,minutes)) : 0
  };
}
function notifySubscribers(): void {
  const all = notificationPolicyService.getAllEffectivePolicies();
  policyListeners.forEach(listener => { try { listener(all); } catch(err) { console.error('Policy listener error:',err); } });
}

export const notificationPolicyService = {
  getEventDefinition(eventId: string): NotificationEventDefinition | undefined {
    return notificationEventRegistry.getEvent(eventId);
  },
  getAllEventDefinitions(): readonly NotificationEventDefinition[] {
    return notificationEventRegistry.getAllEvents();
  },
  getDefaultPolicy(eventId: string): NotificationPolicy | undefined {
    const definition = notificationEventRegistry.getEvent(eventId);
    return definition ? notificationEventRegistry.createDefaultPolicy(definition) : undefined;
  },
  getAllDefaultPolicies(): Record<string,NotificationPolicy> {
    return notificationEventRegistry.getDefaultPoliciesMap();
  },
  getEffectivePolicy(eventId: string): NotificationPolicy | undefined {
    return localPolicyOverrides.get(eventId) || storedPolicies.get(eventId) || this.getDefaultPolicy(eventId);
  },
  getAllEffectivePolicies(): NotificationPolicy[] {
    return this.getAllEventDefinitions().map(def => this.getEffectivePolicy(def.eventId)!).filter(Boolean);
  },
  // Business events always read the authoritative policy from the server.
  // A failed read must not silently turn into an empty recipient list.
  async getConfirmedPolicy(eventId: string): Promise<NotificationPolicy | undefined> {
    if (isDevelopmentPreview()) return this.getEffectivePolicy(eventId);
    const snap = await collection().doc(eventId).get({source:'server'});
    if (!snap.exists) return this.getDefaultPolicy(eventId);
    const policy = normalize(eventId,snap.data());
    if (!policy) throw new Error('Invalid stored notification policy: '+eventId);
    return policy;
  },
  subscribeToPolicies(callback: (policies: NotificationPolicy[]) => void): () => void {
    policyListeners.add(callback);
    callback(this.getAllEffectivePolicies());
    if (!unsubscribeLive && db && APP_ID_PATH) {
      unsubscribeLive = collection().onSnapshot(snapshot => {
        storedPolicies.clear();
        snapshot.forEach(doc => {
          const value = normalize(doc.id,doc.data());
          if (value) storedPolicies.set(doc.id,value);
        });
        notifySubscribers();
      }, error => console.error('Unable to read stored notification policies:',error));
    }
    return () => {
      policyListeners.delete(callback);
      if (!policyListeners.size && unsubscribeLive) {unsubscribeLive();unsubscribeLive=null;}
    };
  },
  setLocalPolicyOverride(policy: NotificationPolicy): void {
    if (!policy?.eventId) return;
    localPolicyOverrides.set(policy.eventId,policy);notifySubscribers();
  },
  removeLocalPolicyOverride(eventId: string): void {
    localPolicyOverrides.delete(eventId);notifySubscribers();
  },
  clearLocalPolicyOverrides(): void {localPolicyOverrides.clear();notifySubscribers();},
  async savePolicy(policy: NotificationPolicy): Promise<void> {
    const normalized = normalize(policy?.eventId,policy);
    if (!normalized) throw new Error('Invalid notification policy.');
    if (!canMutateNotificationPolicies('savePolicy',normalized.eventId)) {
      this.setLocalPolicyOverride(normalized);return;
    }
    const ref = collection().doc(normalized.eventId);
    await ref.set(normalized);
    const confirmed = normalize(normalized.eventId,(await ref.get({source:'server'})).data());
    if (!confirmed || confirmed.enabled !== normalized.enabled ||
        confirmed.priority !== normalized.priority ||
        confirmed.coalesceEnabled !== normalized.coalesceEnabled ||
        confirmed.coalesceWindowMinutes !== normalized.coalesceWindowMinutes ||
        JSON.stringify([...confirmed.recipientUserIds].sort()) !== JSON.stringify([...normalized.recipientUserIds].sort())) {
      throw new Error('Firestore did not confirm the notification policy.');
    }
    storedPolicies.set(normalized.eventId,confirmed);
    localPolicyOverrides.delete(normalized.eventId);notifySubscribers();
  },
  async resetPolicy(eventId: string): Promise<void> {
    if (!this.getDefaultPolicy(eventId)) return;
    if (!canMutateNotificationPolicies('resetPolicy',eventId)) {
      localPolicyOverrides.set(eventId,this.getDefaultPolicy(eventId)!);notifySubscribers();return;
    }
    const ref = collection().doc(eventId);
    await ref.delete();
    if ((await ref.get({source:'server'})).exists) throw new Error('Policy reset could not be confirmed.');
    storedPolicies.delete(eventId);localPolicyOverrides.delete(eventId);notifySubscribers();
  },
  async resetAllPolicies(): Promise<void> {
    if (!canMutateNotificationPolicies('resetAllPolicies')) {
      for (const policy of Object.values(notificationEventRegistry.getDefaultPoliciesMap())) localPolicyOverrides.set(policy.eventId,policy);
      notifySubscribers();return;
    }
    const snapshot = await collection().get({source:'server'});
    const known = snapshot.docs.filter(doc=>!!this.getDefaultPolicy(doc.id));
    if (known.length > 450) throw new Error('Too many policies for a safe batch reset.');
    const batch = db.batch();
    known.forEach(doc => batch.delete(doc.ref));
    await batch.commit();
    storedPolicies.clear();localPolicyOverrides.clear();notifySubscribers();
  }
};
