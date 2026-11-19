import type { Auth } from 'firebase-admin/auth';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { IDENTITY_LINKS_COLLECTION, USER_PROFILES_COLLECTION } from './firebaseIdentityService';

const ROOT = 'artifacts/timbersmith-terminal-v1';
const PROTECTED = new Set(['elrico@tsjoinery.co.za','sidwell@tsjoinery.co.za','clocking@tsjoinery.co.za']);

export class ManagedUserLifecycle {
  constructor(private readonly db: Firestore, private readonly auth: Auth) {}
  private async target(uid: string) {
    if (!uid || uid.includes('/') || uid.length > 128) throw new Error('Invalid Firebase UID.');
    const user = await this.auth.getUser(uid);
    const email = (user.email || '').trim().toLowerCase();
    const linkRef = this.db.collection(IDENTITY_LINKS_COLLECTION).doc(uid);
    const link = (await linkRef.get()).data();
    const id = link?.profileId;
    if (!email || !link || link.uid !== uid || link.email !== email ||
        typeof id !== 'string' || !id || id.includes('/'))
      throw new Error('Invalid identity link.');
    if (PROTECTED.has(email) || ['usr-admin-elrico','usr-clocking-kiosk','1786096134420'].includes(id))
      throw new Error('Protected account cannot be changed here.');
    const profileRef = this.db.collection(USER_PROFILES_COLLECTION).doc(id);
    const profile = (await profileRef.get()).data();
    if (!profile || profile.firebaseUid !== uid || profile.email !== email)
      throw new Error('Invalid user profile.');
    return { user, email, id, linkRef, profileRef, profile };
  }
  async changePassword(uid: string, password: unknown, actor: string) {
    if (typeof password !== 'string' || password.length < 6 || password.length > 128)
      throw new Error('Password must contain 6 to 128 characters.');
    const t = await this.target(uid);
    if (t.user.disabled || t.profile.active !== true) throw new Error('User is inactive.');
    await this.auth.updateUser(uid, { password });
    await this.auth.revokeRefreshTokens(uid);
    await this.db.collection('managedUserAudit').add({ action: 'PASSWORD_CHANGED', uid, actor, at: new Date().toISOString() });
    return { success: true, uid };
  }
  async setActive(uid: string, active: unknown, actor: string) {
    if (typeof active !== 'boolean') throw new Error('Invalid account status.');
    const t = await this.target(uid);
    if (t.profile.isApproved !== true || ['deleted','archived'].includes(String(t.profile.status || '').toLowerCase()))
      throw new Error('Invalid account status for activation.');
    // Disable and revoke before changing Firestore, then enable only when
    // the authoritative profile and identity link have been committed.
    await this.auth.updateUser(uid, { disabled: true });
    await this.auth.revokeRefreshTokens(uid);
    await this.db.runTransaction(async tx => {
      const [link,profile] = await Promise.all([tx.get(t.linkRef),tx.get(t.profileRef)]);
      if (link.data()?.uid !== uid || link.data()?.profileId !== t.id ||
          link.data()?.email !== t.email || profile.data()?.firebaseUid !== uid ||
          profile.data()?.email !== t.email || profile.data()?.isApproved !== true ||
          ['deleted','archived'].includes(String(profile.data()?.status || '').toLowerCase()))
        throw new Error('Invalid managed identity.');
      tx.update(t.linkRef, { active });
      tx.update(t.profileRef, { active, status: active ? 'active' : 'suspended', updatedAt: new Date().toISOString() });
      tx.create(this.db.collection('managedUserAudit').doc(), {
        action: active ? 'USER_REACTIVATED' : 'USER_SUSPENDED', uid, actor, at: new Date().toISOString()
      });
    });
    if (active) await this.auth.updateUser(uid, { disabled: false });
    const [user,link,profile] = await Promise.all([this.auth.getUser(uid),t.linkRef.get(),t.profileRef.get()]);
    if (user.disabled === active || link.data()?.active !== active || profile.data()?.active !== active)
      throw new Error('Account status could not be verified. Retry the operation.');
    return { success:true,uid,active };
  }

  async deleteUser(uid: string, actor: string) {
    if (!uid || uid.includes('/') || uid.length > 128) throw new Error('Invalid Firebase UID.');
    const [linkSnap, archiveSnap] = await Promise.all([
      this.db.collection(IDENTITY_LINKS_COLLECTION).doc(uid).get(),
      this.db.collection('managedUserArchive').doc(uid).get()
    ]);
    const oldLink = linkSnap.data(), archived = archiveSnap.data();
    if (oldLink?.active === false && oldLink.uid === uid &&
        typeof oldLink.profileId==='string' && !!oldLink.profileId && !oldLink.profileId.includes('/') &&
        !['usr-admin-elrico','usr-clocking-kiosk','1786096134420'].includes(oldLink.profileId) &&
        archived?.firebaseUid === uid && archived.id===oldLink.profileId &&
        archived.status === 'deleted' && archived.active === false &&
        archived.email === oldLink.email && !PROTECTED.has(oldLink.email)) {
      const activeSnap=await this.db.collection(USER_PROFILES_COLLECTION).doc(oldLink.profileId).get();
      if (!activeSnap.exists) return this.finishDeletion(uid, oldLink.email);
    }
    const t = await this.target(uid);
    const profileId=t.id;
    const overrides = this.db.collection('userPermissionOverrides');
    const assignments = this.db.collection('userRoles');
    const mirror = this.db.collection(ROOT + '/public/userRoles/items');
    const policies = this.db.collection(ROOT + '/private/config/notifications_policies');
    const validate = async (tx: Transaction) => {
      const [link, profile, duplicates, byId, byEmail, emailDoc, a, m, aId, mId, linkedProfiles] = await Promise.all([
        tx.get(t.linkRef), tx.get(t.profileRef),
        tx.get(this.db.collection(USER_PROFILES_COLLECTION).where('email','==',t.email)),
        tx.get(overrides.where('userId','==',profileId)),
        tx.get(overrides.where('userEmail','==',t.email)),
        tx.get(overrides.doc(t.email)),
        tx.get(assignments.where('userEmail','==',t.email)),
        tx.get(mirror.where('userEmail','==',t.email)),
        tx.get(assignments.where('userId','==',profileId)),
        tx.get(mirror.where('userId','==',profileId)),
        tx.get(this.db.collection(IDENTITY_LINKS_COLLECTION).where('profileId','==',profileId))
      ]);
      if (link.data()?.uid !== uid || link.data()?.profileId !== profileId ||
          profile.data()?.firebaseUid !== uid || profile.data()?.email !== t.email ||
          duplicates.size !== 1 || duplicates.docs[0].id !== profileId ||
          linkedProfiles.size!==1 || linkedProfiles.docs[0].id!==uid)
        throw new Error('Invalid or duplicate managed identity.');
      if ([...byId.docs,...byEmail.docs,...a.docs,...m.docs,...aId.docs,...mId.docs].some(d=>d.id!==profileId) || emailDoc.exists)
        throw new Error('Legacy permission or role records require migration.');
      return profile.data()!;
    };
    await this.db.runTransaction(validate);
    await this.auth.updateUser(uid,{disabled:true});
    await this.auth.revokeRefreshTokens(uid);
    await this.db.runTransaction(async tx => {
      const profile = await validate(tx);
      const policyDocs = await tx.get(policies);
      const safe = {...profile};
      delete safe.pin; delete safe.password; delete safe.passwordHash;
      safe.id=profileId;
      tx.set(this.db.collection('managedUserArchive').doc(uid), {...safe,active:false,status:'deleted',deletedAt:new Date().toISOString(),deletedBy:actor});
      tx.update(t.linkRef,{active:false});
      tx.delete(t.profileRef);
      tx.delete(overrides.doc(profileId));
      tx.delete(assignments.doc(profileId));
      tx.delete(mirror.doc(profileId));
      for(const doc of policyDocs.docs) {
        const ids=doc.data().recipientUserIds;
        if(Array.isArray(ids)&&ids.includes(profileId)) tx.update(doc.ref,{recipientUserIds:ids.filter(id=>id!==profileId)});
      }
      tx.create(this.db.collection('managedUserAudit').doc(),{action:'USER_DELETED',uid,actor,at:new Date().toISOString()});
    });
    return this.finishDeletion(uid, t.email);
  }

  private async finishDeletion(uid: string, email: string) {
    try {
      const user = await this.auth.getUser(uid);
      if (!user.disabled || user.email?.toLowerCase() !== email || PROTECTED.has(email))
        throw new Error('Invalid archived authentication account.');
      await this.auth.deleteUser(uid);
    } catch (error: any) {
      if (error?.code !== 'auth/user-not-found') throw error;
    }
    await this.auth.getUser(uid).then(
      () => { throw new Error('Account deletion could not be verified.'); },
      error => { if (error?.code !== 'auth/user-not-found') throw error; }
    );
    return {success:true,uid,status:'deleted',emailReusable:true};
  }
}
