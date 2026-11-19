import express from 'express';
import { getAuth } from 'firebase-admin/auth';
import { getFirebaseAdminApp, getServerFirestore } from './firebaseAdmin';
import { firebaseIdentityService } from './firebaseIdentityService';
import { ManagedUserService, MANAGED_PERMISSION_MODULES, MANAGED_PERMISSION_ACTIONS } from './managedUserService';
import { ManagedUserLifecycle } from './managedUserLifecycle';
import { ManagedNotificationPolicies } from './managedNotificationPolicies';

export function managedUserApiEnabled() {
  return process.env.TSJ_MANAGED_USER_API === 'true';
}

// Full account administration requires explicit full access. Role labels and
// browser claims never grant the ability to delegate permissions.
export function hasFullManagedAdministration(permissions: any): boolean {
  return MANAGED_PERMISSION_MODULES.every(module =>
    MANAGED_PERMISSION_ACTIONS.every(action =>
      permissions?.[module]?.[action] === 'allow' || permissions?.[module]?.[action] === true));
}
export function createManagedUserRouter() {
  const router = express.Router();
  router.use(async (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    try {
      const token = /^Bearer ([^\s]+)$/.exec(req.headers.authorization || '')?.[1];
      if (!token) return res.status(401).json({ error: 'Authentication required.' });
      const actor = await firebaseIdentityService.resolveToken(token);
      const override = (await getServerFirestore().collection('userPermissionOverrides')
        .doc(actor.profileId).get()).data();
      const notificationOperation = req.path === '/notification-policy/save' || req.path === '/notification-policy/reset';
      const notificationEdit = override?.permissions?.Notifications?.Edit;
      if (!override || override.userId !== actor.profileId || override.userEmail !== actor.email ||
          !(notificationOperation ? notificationEdit === 'allow' || notificationEdit === true : hasFullManagedAdministration(override.permissions)))
        return res.status(403).json({ error: notificationOperation ? 'Notifications Edit permission required.' : 'Explicit Full Access is required for user administration.' });
      res.locals.actor = actor.uid;
      res.locals.actorProfileId = actor.profileId;
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
      try {
        if (req.params.uid && req.params.uid === res.locals.actor)
          return res.status(403).json({ error: 'You cannot change your own account through user administration.' });
        return res.json(await operation(req, res.locals.actor));
      }
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
  router.post('/notification-policy/save', run((req) => new ManagedNotificationPolicies(getServerFirestore()).save(req.body, req.res!.locals.actorProfileId)));
  router.post('/notification-policy/reset', run((req) => new ManagedNotificationPolicies(getServerFirestore()).reset(req.body?.eventId, req.res!.locals.actorProfileId)));
  router.post('/create', run((req, actor) => services().managed.createUser(req.body, actor)));
  router.post('/:uid/access', run((req, actor) => services().managed.saveUserAccess(req.params.uid, req.body, actor)));
  router.post('/:uid/status', run((req, actor) => services().lifecycle.setActive(req.params.uid, req.body?.active, actor)));
  router.post('/:uid/password', run((req, actor) => services().lifecycle.changePassword(req.params.uid, req.body?.password, actor)));
  router.post('/:uid/delete', run((req, actor) => services().lifecycle.deleteUser(req.params.uid, actor)));
  return router;
}
