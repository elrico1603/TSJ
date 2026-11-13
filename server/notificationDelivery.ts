/**
 * Protected stock notification delivery. Disabled until the real Firebase
 * identity mapping and Firestore rules have been verified.
 *
 * A stock request is a business event only after its canonical document exists.
 * Policy recipients are explicit application user IDs, never roles or emails.
 */
import { Router, type Request, type Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { createHash } from 'node:crypto';
import { getFirebaseAdminApp, getServerFirestore } from './firebaseAdmin';

const APP = 'timbersmith-terminal-v1';
const EVENT = 'STOCK_REQUEST_SUBMITTED';
const safeId = (value:unknown): value is string =>
  typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value);
const hash = (value:string) => createHash('sha256').update(value).digest('hex');
const activeAccount = (data:any) => !!data && data.active !== false &&
  data.isApproved !== false && String(data.status || '').toLowerCase() !== 'inactive';

export function notificationDeliveryEnabled(): boolean {
  return process.env.TSJ_NOTIFICATION_DELIVERY_ENABLED === 'true' &&
    process.env.TSJ_NOTIFICATION_RULES_VERIFIED === 'I_VERIFIED_IDENTITY_AND_RULES';
}

export function createNotificationDeliveryRouter(): Router {
  const router = Router();
  router.use((_req,res,next) => {
    res.setHeader('Cache-Control','no-store');
    if (!notificationDeliveryEnabled()) {
      res.status(503).json({error:'Protected notification delivery is disabled.'});return;
    }
    next();
  });

  async function identity(req:Request) {
    const token = /^Bearer (\S+)$/.exec(req.headers.authorization || '')?.[1];
    if (!token || token.length > 8192) throw new Error('UNAUTHORIZED');
    const decoded = await getAuth(getFirebaseAdminApp()).verifyIdToken(token,true).catch(()=>null);
    if (!decoded || decoded.firebase.sign_in_provider === 'anonymous' ||
        !safeId(decoded.tsj_app_user_id)) throw new Error('UNAUTHORIZED');
    // The application ID must come from an administrator-provisioned signed
    // claim. A locally stored AppUser or supplied email never grants identity.
    const database = getServerFirestore();
    const root = database.collection('artifacts').doc(APP);
    const active = root.collection('private').doc('users').collection('active');
    const userId = decoded.tsj_app_user_id as string;
    const record = await active.doc(userId).get();
    if (!record.exists || !activeAccount(record.data()) ||
        (record.data()?.id && record.data()?.id !== userId)) throw new Error('FORBIDDEN');
    if (!decoded.email || String(record.data()?.email || '').toLowerCase().trim() !== decoded.email.toLowerCase().trim()) {
      throw new Error('FORBIDDEN');
    }
    return {database,root,active,userId};
  }
  function fail(res:Response,error:unknown) {
    const code=error instanceof Error?error.message:'';
    const status=code==='UNAUTHORIZED'?401:code==='FORBIDDEN'?403:code==='NOT_FOUND'?404:
      code==='INVALID_REQUEST'?400:503;
    return res.status(status).json({error:status===401?'Authenticated application identity required.':
      status===403?'Access denied.':status===404?'Committed stock request not found.':
      status===400?'Invalid notification request.':'Notification delivery unavailable; retry the existing request.'});
  }

  // Idempotent delivery for one already committed stock request. No business
  // record, supplier order or employee clock event is created by this API.
  router.post('/stock-request/:requestId', async(req,res)=>{
    try {
      const id=req.params.requestId;
      if(!safeId(id))throw new Error('INVALID_REQUEST');
      const {database,root,active,userId}=await identity(req);
      const requestRef=root.collection('public').doc('data').collection('stockRequests').doc(id);
      const policyRef=root.collection('private').doc('config').collection('notifications_policies').doc(EVENT);
      const receiptRef=root.collection('private').doc('config').collection('notification_delivery_receipts').doc(hash(EVENT+':'+id));
      const outcome=await database.runTransaction(async tx=>{
        const [request,policyDoc,receipt]=await Promise.all([tx.get(requestRef),tx.get(policyRef),tx.get(receiptRef)]);
        if(!request.exists)throw new Error('NOT_FOUND');
        const stock=request.data()!;
        if(stock.requestedByUid!==userId)throw new Error('FORBIDDEN');
        if(receipt.exists)return {delivered:Number(receipt.data()?.delivered || 0),alreadyProcessed:true};
        const policy=policyDoc.data();
        const enabled=policy?.enabled===true && ['critical','high','normal','info'].includes(policy.priority);
        const recipients=enabled && Array.isArray(policy?.recipientUserIds)
          ? [...new Set<string>(policy.recipientUserIds.filter(safeId))] : [];
        if(recipients.length>100)throw new Error('INVALID_REQUEST');
        const accounts=await Promise.all(recipients.map(uid=>tx.get(active.doc(uid))));
        // An invalid or inactive recipient is not silently replaced by an
        // email alias or by another administrator.
        const eligible=recipients.filter((uid,i)=>accounts[i].exists && activeAccount(accounts[i].data()) &&
          (!accounts[i].data()?.id || accounts[i].data()?.id===uid));
        const now=new Date().toISOString();
        const window=Number(policy?.coalesceWindowMinutes || 0);
        const coalesce=policy?.coalesceEnabled===true && Number.isFinite(window) && window>0 && window<=10080;
        const bucket=coalesce?Math.floor(Date.now()/(window*60000)):0;
        const groupId='GROUP-'+hash(EVENT+':'+bucket);
        const notificationId='EVENT-'+hash(EVENT+':'+id);
        const refs=eligible.map(uid=>root.collection('users').doc(uid).collection('notifications'));
        const groups=coalesce?await Promise.all(refs.map(ref=>tx.get(ref.doc(groupId)))):[];
        const number=typeof stock.requestNumber==='string'?stock.requestNumber.slice(0,100):id;
        const title='New stock request: '+number;
        const description='A replenishment request is ready for review.';
        for(let i=0;i<eligible.length;i++){
          const uid=eligible[i], ref=refs[i], group=groups[i];
          const existing=group?.data();
          if(coalesce && existing && existing.recipientUserId===uid && existing.isRead===false &&
              existing.eventId===EVENT && existing.coalescing?.coalesceKey===EVENT+':'+bucket){
            tx.update(group.ref,{title,description,createdAt:now,entityId:id,
              coalescing:{coalesceKey:EVENT+':'+bucket,
                coalesceCount:Number(existing.coalescing.coalesceCount || 1)+1,
                firstEventAt:existing.coalescing.firstEventAt,lastEventAt:now}});
          }else{
            const target=coalesce && !group?.exists?groupId:notificationId;
            tx.create(ref.doc(target),{
              notificationId:target,recipientUserId:uid,eventId:EVENT,groupId:'stock_procurement',
              title,description,priority:policy!.priority,createdAt:now,isRead:false,readAt:null,
              relatedPage:'orders',entityId:id,entityType:'stockRequest',
              ...(coalesce?{coalescing:{coalesceKey:EVENT+':'+bucket,coalesceCount:1,firstEventAt:now,lastEventAt:now}}:{})
            });
          }
        }
        tx.create(receiptRef,{eventId:EVENT,entityId:id,actorUserId:userId,createdAt:now,
          delivered:eligible.length,skippedRecipients:recipients.length-eligible.length});
        return {delivered:eligible.length,alreadyProcessed:false};
      });
      return res.json(outcome);
    }catch(error){return fail(res,error);}
  });

  // Per-user read and delete mutations: the authenticated identity determines
  // the collection path; callers cannot select another user's inbox.
  router.post('/inbox/:notificationId/:action',async(req,res)=>{
    try{
      const id=req.params.notificationId, action=req.params.action;
      if(!safeId(id)||!['read','delete'].includes(action))throw new Error('INVALID_REQUEST');
      const {database,root,userId}=await identity(req);
      const ref=root.collection('users').doc(userId).collection('notifications').doc(id);
      await database.runTransaction(async tx=>{
        const snap=await tx.get(ref);
        if(!snap.exists)return;
        if(snap.data()?.recipientUserId!==userId)throw new Error('FORBIDDEN');
        if(action==='delete')tx.delete(ref);
        else if(snap.data()?.isRead!==true)tx.update(ref,{isRead:true,readAt:new Date().toISOString()});
      });
      return res.json({success:true});
    }catch(error){return fail(res,error);}
  });
  router.post('/inbox/read-all',async(req,res)=>{
    try{
      const {database,root,userId}=await identity(req);
      const refs=root.collection('users').doc(userId).collection('notifications');
      let changed=0;
      while(true){
        const snap=await refs.where('isRead','==',false).limit(300).get();
        if(snap.empty)break;
        const batch=database.batch();
        const now=new Date().toISOString();
        for(const doc of snap.docs){
          if(doc.data()?.recipientUserId!==userId)throw new Error('FORBIDDEN');
          batch.update(doc.ref,{isRead:true,readAt:now});
        }
        await batch.commit();changed+=snap.size;
        if(changed>=3000)break;
      }
      return res.json({success:true,changed});
    }catch(error){return fail(res,error);}
  });
  return router;
}
