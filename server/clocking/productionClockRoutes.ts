import express from 'express';
import { getAuth } from 'firebase-admin/auth';
import { getFirebaseAdminApp, getServerFirestore } from '../firebaseAdmin';
import { getClockKioskRegistryFirestore } from './clockKioskRegistry';
import { KioskAuthorizationError } from './clockKioskIdentity';
import { PRODUCTION_DEVICES, verifyProductionDevice, validateProductionEvent, verifyClockSignature,
  type StoredClockCredential } from './productionClockSecurity';
import { processProductionClockEvent } from './productionClockProcessor';
import { clockWorker, clockSigningText, PRODUCTION_CLOCK_NAMESPACE } from '../../src/services/productionClockContract';
import type { Employee } from '../../src/types';
import { ManagementStore } from '../management/managementStore';
import { ManagementService } from '../management/managementService';
import { canManage } from '../management/managementPolicy';
import { saveWorkerRequest, validateWorkerRequest, WorkerRequestRefused } from './clockWorkerRequestService';

function secureManagementReady() {
  return process.env.TSJ_ENABLE_SECURE_MANAGEMENT === 'true' &&
    process.env.TSJ_MANAGEMENT_CUTOVER_CONFIRMED === 'REVIEWED_IDENTITY_RULES_BACKUP' &&
    (process.env.TSJ_MANAGEMENT_NAMESPACE || PRODUCTION_CLOCK_NAMESPACE) === PRODUCTION_CLOCK_NAMESPACE;
}

export function productionClockRoutes(): express.Router {
  const router = express.Router();
  const ingress = new Map<string, {start:number;count:number}>();
  router.use((req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (process.env.TSJ_ENABLE_PRODUCTION_CLOCKING !== 'true' ||
        process.env.TSJ_CLOCK_PRODUCTION_SECURITY_CONFIRMED !== 'REVIEWED_RULES_IAM_BACKUP') {
      return res.status(503).json({error:'Registered Clocking is not activated.'});
    }
    // Bound unauthenticated per-instance ingress. Authenticated quota below is shared across instances.
    const now = Date.now(), key = req.ip || 'unknown';
    for (const [ip, value] of ingress) if (now - value.start >= 60000) ingress.delete(ip);
    const value = ingress.get(key) || {start:now,count:0};
    if (ingress.size >= 2000 && !ingress.has(key) || ++value.count > 180) return res.status(429).json({error:'Retry later.'});
    ingress.set(key, value);
    next();
  });
  // Mounted BEFORE the application's 30 MB parser.
  router.use('/worker-request',express.json({limit:'900kb',strict:true}));
  router.use(express.json({limit:'8kb',strict:true}));
  router.use(async (req, res, next) => {
    try {
      const match = /^Bearer (\S+)$/.exec(req.header('Authorization') || '');
      if (!match) return res.status(401).json({error:'Registered kiosk required.'});
      const registry = getClockKioskRegistryFirestore();
      const device = await verifyProductionDevice(match[1], req.header('X-Clock-Device-ID') || '', registry);
      const quota = registry.collection(PRODUCTION_DEVICES).doc(device.deviceId).collection('limits').doc('requests');
      const allowed = await registry.runTransaction(async tx => {
        const snap = await tx.get(quota);
        const minute = Math.floor(Date.now()/60000);
        const count = snap.data()?.minute === minute ? Number(snap.data()?.count) || 0 : 0;
        if (count >= 120) return false;
        tx.set(quota, {minute,count:count+1}); return true;
      });
      if (!allowed) return res.status(429).json({error:'Kiosk request limit; events remain pending.'});
      res.locals.clockDevice = device;
      next();
    } catch (error) {
      return res.status(error instanceof KioskAuthorizationError ? 403 : 503)
        .json({error:'Kiosk authorization unavailable; events remain pending.'});
    }
  });
  router.get('/bootstrap', async (_req, res) => {
    try {
      const device = res.locals.clockDevice;
      const db = getServerFirestore(), registry = getClockKioskRegistryFirestore();
      const entries = [];
      for (const id of device.permittedEmployeeIds) {
        const [employee, credential] = await Promise.all([
          db.collection('artifacts').doc(PRODUCTION_CLOCK_NAMESPACE).collection('public').doc('data').collection('employees').doc(id).get(),
          registry.collection(PRODUCTION_DEVICES).doc(device.deviceId).collection('credentials').doc(id).get()
        ]);
        if (!employee.exists || !credential.exists) continue;
        const data = employee.data()!;
        if (data.isArchived === true || data.status === 'Archived') continue;
        const stored = credential.data() as StoredClockCredential;
        entries.push({worker:clockWorker({...data,id:employee.id} as Employee),credential:stored.envelope});
      }
      return res.json({deviceId:device.deviceId,namespace:PRODUCTION_CLOCK_NAMESPACE,entries});
    } catch { return res.status(503).json({error:'Roster unavailable. Existing local events are preserved.'}); }
  });
  router.post('/worker-request', async (req,res) => {
    if (!secureManagementReady()) return res.status(503).json({error:'Worker requests are unavailable.'});
    const device=res.locals.clockDevice;
    try {
      const request=validateWorkerRequest(req.body?.event,device);
      const registry=getClockKioskRegistryFirestore();
      const snap=await registry.collection(PRODUCTION_DEVICES).doc(device.deviceId)
        .collection('credentialHistory').doc(request.credentialId).get();
      if (!snap.exists) return res.status(422).json({error:'Employee verification expired.'});
      return res.json(await saveWorkerRequest(getServerFirestore(),device,snap.data() as StoredClockCredential,request));
    } catch (error) {
      if (error instanceof WorkerRequestRefused) return res.status(422).json({error:error.message});
      return res.status(503).json({error:'Request not confirmed. Retry the same request.'});
    }
  });
  router.post('/approve-time-off', async (req,res) => {
    if (!secureManagementReady()) {
      return res.status(503).json({error:'Supervisor approval is unavailable.'});
    }
    const device = res.locals.clockDevice;
    try {
      const event = validateProductionEvent(req.body?.event,device);
      if (event.action !== 'Break' || Math.abs(Date.now()-Date.parse(event.occurredAt)) > 120000) {
        return res.status(400).json({error:'Select a current Time Off request to approve.'});
      }
      const registry = getClockKioskRegistryFirestore();
      const registration = registry.collection(PRODUCTION_DEVICES).doc(device.deviceId);
      const credential = (await registration.collection('credentialHistory').doc(event.credentialId).get()).data() as StoredClockCredential | undefined;
      if (!credential || !verifyClockSignature(event,credential) ||
          Date.parse(event.occurredAt) < Date.parse(credential.envelope.issuedAt) ||
          Date.parse(event.occurredAt) > Date.parse(credential.envelope.expiresAt)) {
        return res.status(400).json({error:'Employee verification expired. Enter the employee PIN again.'});
      }
      const quota = registration.collection('limits').doc('breakApproval');
      const window = Math.floor(Date.now()/900000);
      const allowed = await registry.runTransaction(async tx => {
        const previous = (await tx.get(quota)).data();
        const count = previous?.window === window ? Number(previous.count) || 0 : 0;
        if (count >= 5) return false;
        tx.set(quota,{window,count:count+1});
        return true;
      });
      if (!allowed) return res.status(429).json({error:'Too many approval attempts. Try again later.'});
      const db = getServerFirestore();
      const auth = getAuth(getFirebaseAdminApp());
      const store = new ManagementStore(db,registry,PRODUCTION_CLOCK_NAMESPACE);
      const service = new ManagementService(store,auth);
      const actor = await service.verifyCredentials(req.body?.identifier,req.body?.password);
      if ((!canManage(actor,'Clocking','Approve') && !canManage(actor,'User Assignments','Approve') &&
           !canManage(actor,'User Assignments','Edit')) || (await auth.getUser(actor.firebaseUid)).disabled) {
        return res.status(422).json({error:'Supervisor approval refused.'});
      }
      const approval = db.collection('artifacts').doc(PRODUCTION_CLOCK_NAMESPACE).collection('private')
        .doc('clockApprovals').collection('items').doc(event.id);
      await approval.create({canonical:clockSigningText(event),signature:event.signature,
        deviceUid:device.firebaseUid,approvedBy:actor.id,approvedAt:new Date().toISOString()});
      await registry.runTransaction(async tx => {
        const current = (await tx.get(quota)).data();
        if (current?.window === window && current.count > 0) tx.update(quota,{count:current.count-1});
      }).catch(() => {});
      return res.json({approvedEventId:event.id});
    } catch {
      return res.status(422).json({error:'Supervisor approval could not be confirmed. Time Off was not saved.'});
    }
  });
  router.post('/replay', async (req, res) => {
    let event;
    try { event = validateProductionEvent(req.body?.event, res.locals.clockDevice); }
    catch { return res.status(400).json({error:'Invalid signed event. Keep original for review.'}); }
    try {
      const snap = await getClockKioskRegistryFirestore().collection(PRODUCTION_DEVICES).doc(event.deviceId)
        .collection('credentialHistory').doc(event.credentialId).get();
      if (!snap.exists) return res.status(403).json({error:'Clock credential unavailable. Keep pending.'});
      const receipt = await processProductionClockEvent(getServerFirestore(),res.locals.clockDevice,
        snap.data() as StoredClockCredential,event);
      return res.status(receipt.result === 'rejected' ? 409 : 200).json(receipt);
    } catch { return res.status(503).json({error:'Clocking not confirmed. Retry the same event ID.'}); }
  });
  router.use((_req, res) => res.status(404).json({error:'Unknown Clocking route.'}));
  router.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error?.type === 'entity.too.large' ? 413 : 400).json({error:'Invalid Clocking request.'});
  });
  return router;
}
