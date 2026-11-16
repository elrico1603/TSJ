import type { Firestore } from 'firebase-admin/firestore';
import { notificationEventRegistry } from '../src/services/notificationEventRegistry';
import type { NotificationPolicy } from '../src/types/notification';
import { USER_PROFILES_COLLECTION } from './firebaseIdentityService';

const PATH='artifacts/timbersmith-terminal-v1/private/config/notifications_policies';
const PRIORITIES=new Set(['critical','high','normal','info','silent']);

export class ManagedNotificationPolicies {
  constructor(private readonly db:Firestore) {}
  async save(input: any, actorProfileId:string) {
    const def=notificationEventRegistry.getEvent(input?.eventId);
    if(!def || typeof input.enabled!=='boolean' ||
       !PRIORITIES.has(input.priority) || typeof input.coalesceEnabled!=='boolean' ||
       !Number.isInteger(input.coalesceWindowMinutes) || input.coalesceWindowMinutes<0 ||
       input.coalesceWindowMinutes>10080 || !Array.isArray(input.recipientUserIds) ||
       input.recipientUserIds.length>200)
      throw new Error('Invalid notification policy.');
    const ids=[...new Set<string>(input.recipientUserIds)];
    if(ids.some(id=>typeof id!=='string'||!id||id.includes('/')||id.length>200))
      throw new Error('Invalid notification recipient.');
    const ref=this.db.collection(PATH).doc(def.eventId);
    const policy:NotificationPolicy={
      ...notificationEventRegistry.createDefaultPolicy(def),
      enabled:input.enabled,priority:input.priority,
      coalesceEnabled:input.coalesceEnabled,coalesceWindowMinutes:input.coalesceWindowMinutes,
      recipientUserIds:ids,updatedAt:new Date().toISOString(),updatedByUserId:actorProfileId
    };
    await this.db.runTransaction(async tx=>{
      const recipients=await Promise.all(ids.map(id=>tx.get(this.db.collection(USER_PROFILES_COLLECTION).doc(id))));
      if(recipients.some(s=>!s.exists||s.data()?.active!==true||s.data()?.isApproved!==true||
         !s.data()?.firebaseUid||['deleted','inactive','suspended','archived'].includes(String(s.data()?.status||'').toLowerCase())))
        throw new Error('Invalid or inactive notification recipient. Migrate accounts before selecting them.');
      tx.set(ref,policy);
      tx.create(this.db.collection('managedUserAudit').doc(),{action:'NOTIFICATION_POLICY_SAVED',eventId:def.eventId,actorProfileId,at:policy.updatedAt});
    });
    const confirmed=(await ref.get()).data();
    if(!confirmed||confirmed.updatedAt!==policy.updatedAt||confirmed.updatedByUserId!==actorProfileId||
       confirmed.enabled!==policy.enabled||confirmed.priority!==policy.priority||
       confirmed.coalesceEnabled!==policy.coalesceEnabled||confirmed.coalesceWindowMinutes!==policy.coalesceWindowMinutes||
       JSON.stringify(confirmed.recipientUserIds)!==JSON.stringify(ids))
      throw new Error('Notification save could not be confirmed.');
    return {success:true,policy};
  }
  async reset(eventId:string,actorProfileId:string) {
    const def=notificationEventRegistry.getEvent(eventId);
    if(!def) throw new Error('Unknown notification event.');
    const ref=this.db.collection(PATH).doc(eventId);
    const batch=this.db.batch();
    batch.delete(ref);
    batch.create(this.db.collection('managedUserAudit').doc(),{action:'NOTIFICATION_POLICY_RESET',eventId,actorProfileId,at:new Date().toISOString()});
    await batch.commit();
    if((await ref.get()).exists) throw new Error('Notification reset could not be confirmed.');
    return {success:true,policy:notificationEventRegistry.createDefaultPolicy(def)};
  }
}
