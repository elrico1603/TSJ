import { resolveManagedConfiguration } from './managedConfiguration';
import type { Auth } from 'firebase-admin/auth';
import type { Firestore, QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { IDENTITY_LINKS_COLLECTION, USER_PROFILES_COLLECTION } from './firebaseIdentityService';
import { MANAGED_PERMISSION_MODULES, MANAGED_PERMISSION_ACTIONS } from './managedUserService';

const ROOT = 'artifacts/timbersmith-terminal-v1';
const OVERRIDES = 'userPermissionOverrides';
const MIRROR = ROOT + '/public/userRoles/items';
const POLICIES = ROOT + '/private/config/notifications_policies';
const ARCHIVE = 'managedUserMigrationArchive';

export interface LegacyIdentityTarget {
  uid: string;
  email: string;
  profileId: string;
  knownDuplicateIds: readonly string[];
  knownRoleOnlyIds?: readonly string[];
  preferredRoleId?: string;
  aliasEmails?: readonly string[];
  fullAccess?: boolean;
  correctedName?: string;
}

// Explicitly approved migration targets only; retain stable business IDs.
export const LEGACY_TARGETS: readonly LegacyIdentityTarget[] = [
  {uid:'sJ5Ub7SpxxZC954UBtLzxjDVFrP2',email:'elrico@tsjoinery.co.za',profileId:'usr-admin-elrico',knownDuplicateIds:[],knownRoleOnlyIds:['1780921326575'],fullAccess:true},
  {uid:'i8WKGeBgxIOjZ9nQU7U0EnIrmjr1',email:'janah@tsjoinery.co.za',profileId:'usr-manager-janah',knownDuplicateIds:['1781770439358'],fullAccess:true},
  {uid:'mVuOr9dKDqP63T7NHRyUzXvQSSF2',email:'frans@tsjoinery.co.za',profileId:'usr-hr-franz',knownDuplicateIds:['1781004152948','usr-hr-frans'],aliasEmails:['franz@tsjoinery.co.za'],correctedName:'Frans Posthumus',fullAccess:true},
  {uid:'wkyaqGo86jQa2tUsM0Sg7X3D9fl2',email:'marietjie@tsjoinery.co.za',profileId:'usr-admin-marietjie',knownDuplicateIds:['1785831614380'],preferredRoleId:'ROLE-13491',correctedName:'Marietjie Barkhuizen'},
  {uid:'zwEVg4n8pSUhOUsVURoKxb6MczE2',email:'stock@tsjoinery.co.za',profileId:'zwEVg4n8pSUhOUsVURoKxb6MczE2',knownDuplicateIds:[],knownRoleOnlyIds:['1788770221231','1788770281409','1788771026007','1788771575650','1788771667859'],preferredRoleId:'ROLE-13491'}
];

function emailOf(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}
function clean(data: Record<string,any>) {
  // Use only approved identity/access fields; never copy authentication secrets
  // into the migration archive or any new profile.
  const result: Record<string,any> = {};
  for (const key of ['id','firebaseUid','email','name','firstName','lastName','role','roleId',
    'department','branchId','branchName','physicalLocation','active','isApproved','status',
    'createdAt','updatedAt','deviceAccess','deviceViewAccess','permissions','userPermissions',
    'userId','userEmail','userName','roleName','deviceOverrides','updatedBy']) {
    if (data[key] !== undefined) result[key] = data[key];
  }
  return result;
}
function canonical(value: any): string {
  const sort = (v:any):any => Array.isArray(v) ? v.map(sort) :
    v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k=>[k,sort(v[k])])) : v;
  return JSON.stringify(sort(value));
}
const VIEWS = ['clocking','qr_scan','dispatch','product_master','purchase_orders','orders','kanban','admin','analytics','leave','mobile_deployment','gemini_ai','system_admin','company_settings'];
const PHONE = new Set(['clocking','qr_scan','dispatch','orders','kanban','admin','analytics','leave','gemini_ai']);
export function fullAccessSettings() {
  return {
    permissions:Object.fromEntries(MANAGED_PERMISSION_MODULES.map(module=>[module,
      Object.fromEntries(MANAGED_PERMISSION_ACTIONS.map(action=>[action,'allow']))])),
    deviceAccess:{desktop:true,tablet:true,phone:true,terminal:false},
    deviceViewAccess:{
      desktop:Object.fromEntries(VIEWS.map(view=>[view,true])),
      tablet:Object.fromEntries(VIEWS.map(view=>[view,true])),
      phone:Object.fromEntries(VIEWS.map(view=>[view,PHONE.has(view)])),
      terminal:Object.fromEntries(VIEWS.map(view=>[view,false]))
    },
    deviceOverrides:{}
  };
}

export class LegacyUserMigration {
  constructor(private readonly db: Firestore,private readonly auth: Auth) {}

  // Dry-run reads production if explicitly invoked there. The write path is
  // deliberately restricted to the local test project until cutover is tested.
  async migrate(target: LegacyIdentityTarget, apply = false) {
    if (apply && (this.auth.app.options.projectId !== 'demo-tsj-user-admin' ||
        process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085' ||
        process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099'))
      throw new Error('Production migration is disabled; use the isolated demo emulators.');
    const account = await this.auth.getUser(target.uid);
    if (account.disabled || emailOf(account.email) !== target.email ||
        !account.providerData.some(provider => provider.providerId === 'password'))
      throw new Error('Firebase Authentication does not match ' + target.email);
    const ids = new Set([target.profileId,...target.knownDuplicateIds]);
    const emails = new Set([target.email,...(target.aliasEmails || [])]);
    const matches = (doc: QueryDocumentSnapshot) => {
      const d = doc.data();
      return ids.has(doc.id) || emails.has(emailOf(doc.id)) ||
        ids.has(String(d.userId || '')) || emails.has(emailOf(d.userEmail));
    };
    const users = this.db.collection(USER_PROFILES_COLLECTION);
    const links = this.db.collection(IDENTITY_LINKS_COLLECTION);
    return this.db.runTransaction(async tx => {
      const [allUsers,allLinks,allOverrides,roles,mirror,policies] = await Promise.all([
        tx.get(users),tx.get(links),tx.get(this.db.collection(OVERRIDES)),
        tx.get(this.db.collection('userRoles')),tx.get(this.db.collection(MIRROR)),
        tx.get(this.db.collection(POLICIES))
      ]);
      const current = allUsers.docs.find(d=>d.id===target.profileId);
      if (!current) throw new Error('Missing canonical profile for ' + target.email);
      const profile = current.data();
      if (!emails.has(emailOf(profile.email)) || profile.active !== true ||
          profile.isApproved !== true || (profile.firebaseUid && profile.firebaseUid !== target.uid))
        throw new Error('Canonical profile is inactive, unapproved or mismatched: ' + target.email);
      const candidates = allUsers.docs.filter(d=>ids.has(d.id) || emails.has(emailOf(d.data().email)));
      if (candidates.some(d=>!ids.has(d.id) || !emails.has(emailOf(d.data().email)) ||
          (d.data().firebaseUid && d.data().firebaseUid !== target.uid)))
        throw new Error('Unexpected duplicate profile for ' + target.email);
      const duplicates = candidates.filter(d=>d.id!==target.profileId);
      for (const link of allLinks.docs) {
        const v=link.data();
        if ((link.id===target.uid || ids.has(v.profileId) || emails.has(emailOf(v.email))) &&
            (link.id!==target.uid || v.uid!==target.uid || v.profileId!==target.profileId || emailOf(v.email)!==target.email))
          throw new Error('Conflicting identity link for ' + target.email);
      }
      const related = allOverrides.docs.filter(matches);
      if (related.some(d=>{
        const v=d.data();
        return (v.userId && !ids.has(v.userId)) ||
          (v.userEmail && !emails.has(emailOf(v.userEmail)));
      })) throw new Error('Conflicting permission record for ' + target.email);
      const existing = related.find(d=>d.id===target.profileId)?.data();
      if (!existing && !target.fullAccess)
        throw new Error('Missing canonical permission record for ' + target.email);
      if (!target.fullAccess && related.some(d=>{
        const v=d.data();
        return ['permissions','deviceAccess','deviceViewAccess','deviceOverrides'].some(key=>
          canonical(v[key] || {})!==canonical(existing?.[key] || {}));
      })) throw new Error('Conflicting permissions require review: ' + target.email);
      const roleIds=new Set([...ids,...(target.knownRoleOnlyIds||[])]);
      const roleMatches=(doc:QueryDocumentSnapshot)=>matches(doc)||roleIds.has(doc.id)||roleIds.has(String(doc.data().userId||''));
      const relatedRoles = roles.docs.filter(roleMatches);
      const relatedMirror = mirror.docs.filter(roleMatches);
      // Role-only historical IDs may not identify another active profile.
      if(allUsers.docs.some(d=>(target.knownRoleOnlyIds||[]).includes(d.id)))
        throw new Error('Historical role ID still has an active profile: '+target.email);
      if ([...relatedRoles,...relatedMirror].some(d=>{
        const v=d.data();
        return !roleIds.has(d.id) && !emails.has(emailOf(d.id)) || (v.userId && !roleIds.has(v.userId)) || (v.userEmail && !emails.has(emailOf(v.userEmail))) || ((target.knownRoleOnlyIds||[]).includes(d.id) && emailOf(v.userEmail)!==target.email);
      })) throw new Error('Conflicting role assignment for ' + target.email);
      const canonicalAssignments=[...relatedRoles,...relatedMirror].filter(d=>d.id===target.profileId);
      if(target.preferredRoleId && canonicalAssignments.some(d=>d.data().roleId!==target.preferredRoleId))
        throw new Error('Canonical role assignment changed: '+target.email);
      const roleId = target.preferredRoleId || profile.roleId || relatedRoles.find(d=>d.id===target.profileId)?.data().roleId;
      const branchId = profile.branchId || existing?.branchId;
      if (typeof roleId!=='string' || !roleId || roleId.includes('/') ||
          typeof branchId!=='string' || !branchId || branchId.includes('/'))
        throw new Error('Missing role or branch for ' + target.email);
      const config=await resolveManagedConfiguration(this.db,tx,roleId,branchId);
      const name = target.correctedName || profile.name;
      if (typeof name !== 'string' || !name.trim()) throw new Error('Missing user name.');
      const access = target.fullAccess ? fullAccessSettings() : {
        permissions:existing?.permissions || {},deviceAccess:existing?.deviceAccess || profile.deviceAccess || {},
        deviceViewAccess:existing?.deviceViewAccess || profile.deviceViewAccess || {},deviceOverrides:existing?.deviceOverrides || {}
      };
      const relevantPolicies = policies.docs.filter(d=>{
        const recipients=d.data().recipientUserIds;
        return Array.isArray(recipients) && recipients.some(id=>ids.has(id)||emails.has(emailOf(id)));
      });
      const report = {
        email:target.email,uid:target.uid,profileId:target.profileId,
        duplicateProfiles:duplicates.map(d=>d.id),permissionDocuments:related.map(d=>d.id),
        roleDocuments:relatedRoles.map(d=>d.id),notificationPolicies:relevantPolicies.map(d=>d.id),
        permissionGroups:Object.keys(access.permissions).length,deviceAccess:access.deviceAccess,
        roleId,branchId:config.branchId,originalBranchId:branchId,roleSource:config.roleSource,branchSource:config.branchSource,mode:apply?'emulator-apply':'read-only'
      };
      if (!apply) return report;

      const now=new Date().toISOString();
      const updated = {...clean(profile),id:target.profileId,firebaseUid:target.uid,email:target.email,name,
        firstName:name.split(' ')[0],lastName:name.split(' ').slice(1).join(' '),
        role:config.roleName,roleId,branchId:config.branchId,branchName:config.branchName,
        active:true,isApproved:true,status:'active',deviceAccess:access.deviceAccess,
        deviceViewAccess:access.deviceViewAccess,updatedAt:now};
      tx.set(current.ref,updated);
      tx.set(links.doc(target.uid),{uid:target.uid,profileId:target.profileId,email:target.email,active:true,updatedAt:now});
      tx.set(this.db.collection(OVERRIDES).doc(target.profileId),{
        ...access,userId:target.profileId,userEmail:target.email,branchId:config.branchId,branchName:updated.branchName,
        physicalLocation:profile.physicalLocation || '',updatedAt:now,updatedBy:'managed-migration'
      });
      const assignment={userId:target.profileId,userEmail:target.email,userName:name,roleId,roleName:updated.role,updatedAt:now};
      tx.set(this.db.collection('userRoles').doc(target.profileId),assignment);
      tx.set(this.db.collection(MIRROR).doc(target.profileId),assignment);
      const archive = (kind:string,doc:QueryDocumentSnapshot) => {
        tx.set(this.db.collection(ARCHIVE).doc(target.uid+'-'+kind+'-'+doc.id),{
          kind,sourceId:doc.id,profileId:target.profileId,data:clean(doc.data()),archivedAt:now
        });
      };
      for (const doc of duplicates) {archive('profile',doc);tx.delete(doc.ref);}
      for (const doc of related) if(doc.id!==target.profileId){archive('permission',doc);tx.delete(doc.ref);}
      for (const doc of relatedRoles) if(doc.id!==target.profileId){archive('role',doc);tx.delete(doc.ref);}
      for (const doc of relatedMirror) if(doc.id!==target.profileId){archive('mirror',doc);tx.delete(doc.ref);}
      for (const doc of relevantPolicies) {
        const original=doc.data().recipientUserIds as string[];
        const recipients=[...new Set(original.map(id=>ids.has(id)||emails.has(emailOf(id))?target.profileId:id))];
        if(canonical(original)!==canonical(recipients)) tx.update(doc.ref,{recipientUserIds:recipients});
      }
      tx.create(this.db.collection('managedUserAudit').doc(),{action:'LEGACY_IDENTITY_MIGRATED',uid:target.uid,profileId:target.profileId,at:now});
      return report;
    });
  }
}
