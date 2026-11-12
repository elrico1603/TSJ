import { Router, type Request, type Response } from 'express';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { getFirebaseAdminApp, getServerFirestore } from '../firebaseAdmin';
import { FACE_MODEL, FACE_PROFILE_COLLECTION, validFaceSamples, encryptFaceProfile, decryptFaceProfile, samplesMatch, getFaceEncryptionKey, type EncryptedFaceProfile } from './profileCrypto';

const EMPLOYEE_NAMESPACE = 'timbersmith-terminal-v1';
const employeeIdPattern = /^[a-zA-Z0-9_-]{1,128}$/;
const compareAttempts = new Map<string, {count:number; until:number}>();

// Opt-in integration preview only. This endpoint never updates employee
// attendance, wages, PINs or existing profile photographs.
export function faceProfileApiEnabled(): boolean {
  return process.env.TSJ_FACE_PROFILE_API_ENABLED === 'true' &&
    process.env.TSJ_FACE_PROFILE_RULES_VERIFIED === 'I_VERIFIED_SERVER_ONLY_ACCESS';
}

export function createFaceProfileRouter(): Router {
  const router = Router();
  router.use((req,res,next) => {
    res.setHeader('Cache-Control','no-store');
    if (!faceProfileApiEnabled()) { res.status(503).json({error:'Face profile preview is disabled.'}); return; }
    next();
  });
  async function authorize(req:Request, employeeId:string, manage:boolean) {
    if (!employeeIdPattern.test(employeeId)) throw new Error('INVALID_EMPLOYEE');
    const token = /^Bearer (\S+)$/.exec(req.headers.authorization || '')?.[1];
    if (!token || token.length > 8192) throw new Error('UNAUTHORIZED');
    const decoded = await getAuth(getFirebaseAdminApp()).verifyIdToken(token,true).catch(() => null);
    if (!decoded || decoded.firebase.sign_in_provider === 'anonymous') throw new Error('UNAUTHORIZED');
    // The existing local application role is NOT an authorization boundary.
    // A trusted Firebase administrator must grant these dedicated claims.
    const admin = decoded.tsj_face_admin === true;
    const allowed = decoded.tsj_face_employee_ids;
    const kiosk = decoded.tsj_face_kiosk === true &&
      decoded.firebase.sign_in_provider === 'custom' &&
      Array.isArray(allowed) && allowed.includes(employeeId);
    if (!admin && (manage || !kiosk)) throw new Error('FORBIDDEN');
    const database = getServerFirestore();
    const employee = await database.collection('artifacts').doc(EMPLOYEE_NAMESPACE)
      .collection('public').doc('data').collection('employees').doc(employeeId).get();
    if (!employee.exists || employee.data()?.isArchived === true || employee.data()?.status === 'Archived') {
      throw new Error('EMPLOYEE_UNAVAILABLE');
    }
    const ref = database.collection(FACE_PROFILE_COLLECTION).doc(employeeId);
    return { uid:decoded.uid, ref };
  }
  function fail(res:Response,error:unknown) {
    const code=error instanceof Error?error.message:'';
    if(code==='UNAUTHORIZED')return res.status(401).json({error:'Sign in with an authorized Firebase account.'});
    if(code==='FORBIDDEN')return res.status(403).json({error:'Face profile permission is required.'});
    if(code==='INVALID_EMPLOYEE')return res.status(400).json({error:'Invalid employee ID.'});
    if(code==='EMPLOYEE_UNAVAILABLE')return res.status(404).json({error:'Active employee not found.'});
    // Never echo an exception, credential or biometric payload to clients/logs.
    return res.status(503).json({error:'Face profile service unavailable. No verification granted.'});
  }
  router.get('/:employeeId/status',async(req,res)=>{
    try {
      const {ref}=await authorize(req,req.params.employeeId,false);
      const snap=await ref.get();
      const record=snap.data();
      res.json({registered:snap.exists && record?.model===FACE_MODEL, model:FACE_MODEL});
    }catch(error){fail(res,error);}
  });
  router.post('/:employeeId/enroll',async(req,res)=>{
    try {
      const employeeId=req.params.employeeId;
      const {uid,ref}=await authorize(req,employeeId,true);
      if(req.body?.model!==FACE_MODEL||req.body?.supervised!==true||!validFaceSamples(req.body?.samples)){
        return res.status(400).json({error:'Valid supervised face enrollment required.'});
      }
      const samples=req.body.samples;
      // Capture quality and challenge are checked in the approved local client.
      // The preview is NOT trusted proof of camera provenance.
      const encrypted=encryptFaceProfile(employeeId,samples,getFaceEncryptionKey());
      try{
        await ref.create({...encrypted,employeeId,createdBy:uid,createdAt:FieldValue.serverTimestamp(),purpose:'face-integration-preview'});
      }catch(error){
        if((error as {code?:number|string})?.code===6 || (error as {code?:number|string})?.code==='already-exists'){
          return res.status(409).json({error:'A face is already registered. Remove it under supervision before registering again.'});
        }
        throw error;
      }
      res.status(201).json({registered:true,model:FACE_MODEL});
    }catch(error){fail(res,error);}
  });
  router.post('/:employeeId/compare',async(req,res)=>{
    try {
      const employeeId=req.params.employeeId;
      const {uid,ref}=await authorize(req,employeeId,false);
      if(req.body?.model!==FACE_MODEL||!validFaceSamples(req.body?.samples)){
        return res.status(400).json({error:'Valid face samples required.',matched:false});
      }
      // Small per-instance rate limit, not a substitute for production gateway limits.
      const now=Date.now();
      for(const [key,v] of compareAttempts) if(v.until<=now)compareAttempts.delete(key);
      const key=uid+':'+employeeId;
      const attempts=compareAttempts.get(key)||{count:0,until:now+60000};
      if(attempts.count>=12)return res.status(429).json({error:'Too many attempts. Try again shortly.',matched:false});
      attempts.count++;compareAttempts.set(key,attempts);
      const snap=await ref.get();
      if(!snap.exists)return res.status(404).json({error:'Face is not registered.',matched:false});
      const stored=decryptFaceProfile(employeeId,snap.data() as EncryptedFaceProfile,getFaceEncryptionKey());
      const matched=samplesMatch(stored,req.body.samples);
      // Never return stored templates or detailed scores to a terminal.
      return res.json({matched,preview:true,clockEventCreated:false});
    }catch(error){fail(res,error);}
  });
  router.post('/:employeeId/remove',async(req,res)=>{
    try {
      const {ref}=await authorize(req,req.params.employeeId,true);
      if(req.body?.confirm!==true)return res.status(400).json({error:'Explicit removal confirmation required.'});
      await ref.delete();
      return res.json({registered:false});
    }catch(error){fail(res,error);}
  });
  return router;
}
