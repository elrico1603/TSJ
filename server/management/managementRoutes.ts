import express from 'express';
import { getAuth } from 'firebase-admin/auth';
import { getFirebaseAdminApp,getServerFirestore } from '../firebaseAdmin';
import { getClockKioskRegistryFirestore } from '../clocking/clockKioskRegistry';
import { managementNamespace } from '../../src/services/managementContract';
import { ManagementStore } from './managementStore';
import { ManagementService } from './managementService';
import { indexKey,ManagementDenied } from './managementPolicy';

export function managementRoutes():express.Router {
  const router=express.Router();
  const ingress=new Map<string,{minute:number;count:number}>();
  router.use((req,res,next)=>{
    res.setHeader('Cache-Control','no-store');
    if(process.env.TSJ_ENABLE_SECURE_MANAGEMENT!=='true'||process.env.TSJ_MANAGEMENT_CUTOVER_CONFIRMED!=='REVIEWED_IDENTITY_RULES_BACKUP')return res.status(503).json({error:'Secure management is not activated.'});
    const minute=Math.floor(Date.now()/60000),ip=req.ip||'unknown';
    for(const [key,value] of ingress)if(value.minute!==minute)ingress.delete(key);
    const bucket=ingress.get(ip)||{minute,count:0};
    if(ingress.size>=2000&&!ingress.has(ip)||++bucket.count>60)return res.status(429).json({error:'Retry later.'});
    ingress.set(ip,bucket);next();
  });
  router.use('/employees/write',express.json({limit:'8mb',strict:true}));
  router.use(express.json({limit:'80kb',strict:true}));
  router.use((_req,res,next)=>{
    try{
      const namespace=managementNamespace(process.env.TSJ_MANAGEMENT_NAMESPACE||'timbersmith-terminal-v1');
      const store=new ManagementStore(getServerFirestore(),getClockKioskRegistryFirestore(),namespace);
      res.locals.management=new ManagementService(store,getAuth(getFirebaseAdminApp()));next();
    }catch{res.status(503).json({error:'Management service unavailable.'});}
  });
  async function loginLimit(req:express.Request,service:ManagementService,identity?:string){
    const identifier=String(identity||req.body?.identifier||req.body?.email||'').trim().toLowerCase().slice(0,254);
    const refs=[service.store.realm.collection('login_limits').doc(indexKey('account:'+identifier)),
      service.store.realm.collection('login_limits').doc(indexKey('ip:'+(req.ip||'unknown')))];
    const window=Math.floor(Date.now()/(15*60000));
    return service.store.registry.runTransaction(async tx=>{
      const snapshots=[];for(const ref of refs)snapshots.push(await tx.get(ref));
      const counts=snapshots.map(s=>s.data()?.window===window?Number(s.data()?.count)||0:0);
      if(counts[0]>=10||counts[1]>=60)return false;
      refs.forEach((ref,i)=>tx.set(ref,{window,count:counts[i]+1}));return true;
    });
  }
  router.post('/login',async(req,res)=>{
    try{
      const service=res.locals.management as ManagementService;
      if(!await loginLimit(req,service))return res.status(429).json({error:'Too many attempts. Wait before trying again.'});
      return res.json(await service.login(req.body?.identifier,req.body?.password));
    }catch(error){return res.status(error instanceof ManagementDenied?401:503).json({error:'Sign-in not confirmed. Check credentials or contact administration.'});}
  });
  router.post('/register',async(req,res)=>{
    try{
      const service=res.locals.management as ManagementService;
      if(!await loginLimit(req,service))return res.status(429).json({error:'Retry later.'});
      return res.status(202).json({user:await service.register(req.body||{})});
    }catch{return res.status(400).json({error:'Registration could not be confirmed. Check the form and retry.'});}
  });
  router.use(async(req,res,next)=>{
    try{
      const token=/^Bearer (\S+)$/.exec(req.header('Authorization')||'')?.[1];
      if(!token)return res.status(401).json({error:'Verified management sign-in required.'});
      res.locals.actor=await (res.locals.management as ManagementService).actor(token);next();
    }catch{return res.status(403).json({error:'Management session expired or access changed. Sign in again.'});}
  });
  router.get('/session',(_req,res)=>res.json({user:(res.locals.management as ManagementService).store.view(res.locals.actor)}));
  router.post('/reauth',async(req,res)=>{
    try{
      if(!await loginLimit(req,res.locals.management,'reauth:'+res.locals.actor.id))return res.status(429).json({error:'Wait before trying again.'});
      return res.json(await (res.locals.management as ManagementService).reauthenticate(res.locals.actor,req.body?.password));
    }
    catch{return res.status(403).json({error:'Password verification refused.'});}
  });
  router.post('/users/create',async(req,res)=>{
    try{return res.json({user:await (res.locals.management as ManagementService).create(res.locals.actor,req.body?.user||{})});}
    catch(error){return res.status(error instanceof ManagementDenied?403:409).json({error:error instanceof Error?error.message:'User creation not confirmed.'});}
  });
  router.post('/users/update',async(req,res)=>{
    try{
      const operation=req.body?.operation||'update';if(!['update','approve','delete','reject'].includes(operation))throw new Error('Invalid user operation.');
      return res.json({user:await (res.locals.management as ManagementService).update(res.locals.actor,String(req.body?.id||''),req.body?.patch||{},operation)});
    }catch(error){return res.status(error instanceof ManagementDenied?403:409).json({error:error instanceof Error?error.message:'User change not confirmed.'});}
  });
  router.post('/document',async(req,res)=>{
    try{return res.json(await (res.locals.management as ManagementService).writeDocument(res.locals.actor,req.body?.path,req.body?.operation,req.body?.data));}
    catch(error){return res.status(error instanceof ManagementDenied?403:409).json({error:error instanceof Error?error.message:'Permission change not confirmed.'});}
  });
  router.post('/employees/write',async(req,res)=>{
    try{return res.json(await (res.locals.management as ManagementService).writeEmployee(res.locals.actor,req.body?.path,req.body?.operation,req.body?.data));}
    catch(error){return res.status(error instanceof ManagementDenied?403:409).json({error:error instanceof Error?error.message:'Employee change not confirmed.'});}
  });
  router.post('/employees/pin',async(req,res)=>{
    try{
      if(!await loginLimit(req,res.locals.management,'worker:'+req.body?.id+':'+res.locals.actor.id))return res.status(429).json({error:'Wait before trying again.'});
      return res.json(await (res.locals.management as ManagementService).verifyEmployeePin(res.locals.actor,String(req.body?.id||''),req.body?.pin));
    }catch{return res.status(403).json({error:'Employee PIN verification refused.'});}
  });
  router.post('/audit',async(req,res)=>{
    const event=req.body?.event,details=req.body?.details;
    if(typeof event!=='string'||event.length>100||event.startsWith('MANAGEMENT_')||typeof details!=='string'||details.length>4000)return res.status(400).json({error:'Invalid audit entry.'});
    try{
      const service=res.locals.management as ManagementService;
      await service.store.root.collection('private').doc('audit').collection('logs').add({event,actorId:res.locals.actor.id,
        actor:res.locals.actor.profile.email,details,timestamp:new Date().toISOString(),source:'verified-client-action'});
      return res.json({saved:true});
    }catch{return res.status(503).json({error:'Audit not confirmed.'});}
  });
  router.use((_req,res)=>res.status(404).json({error:'Unknown management operation.'}));
  router.use((error:any,_req:express.Request,res:express.Response,_next:express.NextFunction)=>res.status(error?.type==='entity.too.large'?413:400).json({error:'Invalid management request.'}));
  return router;
}
