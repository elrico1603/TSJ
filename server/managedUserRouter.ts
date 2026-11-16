import express from 'express';
import { getAuth } from 'firebase-admin/auth';
import { getFirebaseAdminApp, getServerFirestore } from './firebaseAdmin';
import { firebaseIdentityService } from './firebaseIdentityService';
import { ManagedUserService } from './managedUserService';
import { ManagedUserLifecycle } from './managedUserLifecycle';

export function managedUserApiEnabled() {
  return process.env.TSJ_MANAGED_USER_API === 'true';
}

// Initial rollout is MASTER only. Never enable before restrictive Firestore
// rules and identity links have been migrated and verified.
export function createManagedUserRouter() {
  const router = express.Router();
  router.use(async (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const token = /^Bearer ([^\s]+)$/.exec(req.headers.authorization || '')?.[1];
      if (!token) return res.status(401).json({ error: 'Authentication required.' });
      const actor = await firebaseIdentityService.resolveToken(token);
      if (actor.uid !== 'sJ5Ub7SpxxZC954UBtLzxjDVFrP2' ||
          actor.profileId !== 'usr-admin-elrico' ||
          actor.email !== 'elrico@tsjoinery.co.za')
        return res.status(403).json({ error: 'MASTER access required.' });
      res.locals.actor = actor.uid;
      next();
    } catch {
      return res.status(401).json({ error: 'Invalid or inactive identity.' });
    }
  });
  const services = () => {
    const db = getServerFirestore(), auth = getAuth(getFirebaseAdminApp());
    return { managed: new ManagedUserService(db, auth), lifecycle: new ManagedUserLifecycle(db, auth) };
  };
  const run = (operation: (req: express.Request, actor: string) => Promise<unknown>) =>
    async (req: express.Request, res: express.Response) => {
      try { return res.json(await operation(req, res.locals.actor)); }
      catch (error: any) {
        const message = error instanceof Error ? error.message : '';
        const safe = /^(Invalid |Missing |Unknown |Selected |Permissions |Password |Notification |A user profile |Duplicate |Protected |User is |Account |User creation |Managed |Legacy |Cannot )/.test(message);
        const duplicate = error?.code === 'auth/email-already-exists';
        return res.status(duplicate ? 409 : 400).json({
          error: duplicate ? 'A Firebase account already exists for this email.' :
            safe ? message : 'User operation could not be completed. Check the account before retrying.'
        });
      }
    };
  router.post('/create', run((req, actor) => services().managed.createUser(req.body, actor)));
  router.post('/:uid/access', run((req, actor) => services().managed.saveUserAccess(req.params.uid, req.body, actor)));
  router.post('/:uid/status', run((req, actor) => services().lifecycle.setActive(req.params.uid, req.body?.active, actor)));
  router.post('/:uid/password', run((req, actor) => services().lifecycle.changePassword(req.params.uid, req.body?.password, actor)));
  router.post('/:uid/delete', run((req, actor) => services().lifecycle.deleteUser(req.params.uid, actor)));
  return router;
}
