/** Protected notification transport. No live delivery by default. */
import { auth } from '../firebase';
import { isDevelopmentPreview } from './previewSafety';

const env = (import.meta as any).env || {};
export function protectedNotificationDeliveryEnabled(): boolean {
  return env.VITE_TSJ_NOTIFICATION_DELIVERY === 'true' && !isDevelopmentPreview();
}
export async function notificationBackendRequest(userId:string,path:string):Promise<any> {
  if (!protectedNotificationDeliveryEnabled()) throw new Error('Protected notification delivery is disabled.');
  const user=auth.currentUser;
  if (!user || user.isAnonymous) throw new Error('Verified Firebase sign-in is required for notification delivery.');
  const token=await user.getIdTokenResult();
  if(token.claims.tsj_app_user_id!==userId)throw new Error('The signed application identity does not match this account.');
  const base=String(env.VITE_TSJ_NOTIFICATION_API_BASE_URL||'').replace(/\/+$/,'');
  if(base&&!/^https:\/\/[^/]+$/.test(base))throw new Error('Notification API requires a trusted HTTPS origin.');
  const response=await fetch(base+'/api/notifications/'+path,{
    method:'POST',headers:{Authorization:'Bearer '+token.token},cache:'no-store'
  });
  const payload=await response.json().catch(()=>null);
  if(!response.ok||!payload)throw new Error(payload?.error||'Notification delivery unavailable.');
  return payload;
}
export async function deliverStockRequestNotification(actorUserId:string,requestId:string):Promise<void>{
  await notificationBackendRequest(actorUserId,'stock-request/'+encodeURIComponent(requestId));
}
