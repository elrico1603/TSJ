import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { cleanManagementProfile, MANAGEMENT_PROFILE_FIELDS, type ManagementProfile,
  type ManagementPermissions } from '../../src/services/managementContract';
const scrypt=promisify(scryptCallback);
export type PasswordDigest={salt:string;hash:string;scheme:'scrypt-v1'};
export type ManagementRecord={id:string;firebaseUid:string;profile:ManagementProfile;password:PasswordDigest;
  permissions:ManagementPermissions;owner:boolean;version:number;aliases:string[]};
export class ManagementDenied extends Error {constructor(){super('Management access refused.');}}
export const normalizeEmail=(s:unknown)=>typeof s==='string'?s.trim().toLowerCase():'';
export const indexKey=(s:string)=>createHash('sha256').update(s).digest('hex');
export async function passwordDigest(password:string):Promise<PasswordDigest>{
  if(typeof password!=='string' || password.trim().length<4 || password.length>128)throw new Error('Password/PIN must contain 4–128 characters.');
  const salt=randomBytes(16).toString('base64');
  const hash=await scrypt(password.trim(),salt,64) as Buffer;
  return {salt,hash:hash.toString('base64'),scheme:'scrypt-v1'};
}
export async function passwordMatches(password:string,digest:PasswordDigest):Promise<boolean>{
  if(typeof password!=='string'||password.length>128||digest?.scheme!=='scrypt-v1')return false;
  const actual=await scrypt(password.trim(),digest.salt,64) as Buffer,expected=Buffer.from(digest.hash,'base64');
  return actual.length===expected.length && timingSafeEqual(actual,expected);
}
export function loginAliases(profile:ManagementProfile):string[]{
  const email=normalizeEmail(profile.email);
  return [...new Set([email,email.split('@')[0],profile.name,profile.firstName]
    .map(s=>String(s||'').trim().toLowerCase()).filter(Boolean))];
}
export function effectiveManagementPermissions(profile:ManagementProfile,override?:Record<string,any>):ManagementPermissions{
  const result:ManagementPermissions={};
  const source=(profile.userPermissions||{}) as Record<string,Record<string,unknown>>;
  for(const [module,actions] of Object.entries(source)) {
    if(module.length>100 || !actions || typeof actions!=='object')continue;
    result[module]={};
    for(const [action,value] of Object.entries(actions))result[module][action]=value===true || value==='allow';
  }
  for(const [module,value] of Object.entries(profile.permissions||{}))if(typeof value==='boolean') {
    if(result[module]?.View===undefined)result[module]={...result[module],View:value};
  }
  for(const [module,actions] of Object.entries(override?.permissions||{})) {
    if(!actions || typeof actions!=='object' || Array.isArray(actions))continue;
    result[module]??={};
    for(const [action,value] of Object.entries(actions))result[module][action]=value===true || value==='allow';
  }
  return result;
}
export function canManage(record:ManagementRecord,module:string,action:string):boolean{
  return record.profile.active===true && record.profile.isApproved===true && record.profile.status==='active' &&
    (record.owner===true || record.permissions[module]?.[action]===true);
}
export function requireManagementPermission(record:ManagementRecord,module:string,action:string):void{
  if(!canManage(record,module,action))throw new ManagementDenied();
}
export function validateProfile(raw:unknown,id:string,creating=false):ManagementProfile{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('Invalid user profile.');
  const p=raw as Record<string,any>;
  const allowed=new Set<string>([...MANAGEMENT_PROFILE_FIELDS,'id','pin']);
  if(Object.keys(p).some(k=>!allowed.has(k)))throw new Error('Unexpected user profile fields.');
  if(!/^[A-Za-z0-9_-]{1,128}$/.test(id)||typeof p.name!=='string'||!p.name.trim()||p.name.length>160 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(p.email)) || normalizeEmail(p.email).length>254 ||
    typeof p.role!=='string'||p.role.length>100 || typeof p.active!=='boolean'||typeof p.isApproved!=='boolean'||
    !['active','pending','inactive','deleted'].includes(p.status))throw new Error('Invalid required user fields.');
  for(const field of ['permissions','userPermissions','deviceAccess','deviceViewAccess']) {
    if(p[field]!==undefined && (!p[field]||typeof p[field]!=='object'||Array.isArray(p[field])||JSON.stringify(p[field]).length>20000))throw new Error('Invalid permission structure.');
  }
  for(const field of ['firstName','lastName','roleId','department','branchId','branchName','physicalLocation','createdAt']){
    if(p[field]!==undefined && (typeof p[field]!=='string'||p[field].length>254))throw new Error('Invalid profile field.');
  }
  if(creating && (typeof p.pin!=='string'||p.pin.trim().length<6||p.pin.length>128))throw new Error('New-user password must contain 6–128 characters.');
  return cleanManagementProfile({...p,name:p.name.trim(),email:normalizeEmail(p.email)},id);
}
export function checkUserMutation(actor:ManagementRecord,target:ManagementRecord,patch:Record<string,any>,action:'update'|'delete'){
  requireManagementPermission(actor,'User Assignments',action==='delete'?'Delete':'Edit');
  if(target.owner && actor.id!==target.id)throw new Error('Only the protected owner may change the owner account.');
  if(target.owner && (action==='delete'||patch.active===false||patch.isApproved===false||patch.email && normalizeEmail(patch.email)!==target.profile.email))throw new Error('The protected owner account cannot be removed, disabled or rebound through this API.');
  if(actor.id===target.id && Object.keys(patch).some(k=>['permissions','userPermissions','deviceAccess','deviceViewAccess','role','roleId','active','isApproved','status'].includes(k) && JSON.stringify(patch[k])!==JSON.stringify((target.profile as any)[k])))throw new Error('Self privilege changes require a different authorized manager.');
}
