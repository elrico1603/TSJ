import type { AppUser } from '../auth';
export const MANAGEMENT_PROFILE_FIELDS = ['name','firstName','lastName','email','role','roleId','department',
  'branchId','branchName','physicalLocation','active','isApproved','status','createdAt',
  'permissions','userPermissions','deviceAccess','deviceViewAccess'] as const;
export type ManagementProfile = Omit<AppUser,'pin'> & {pin:''};
export type ManagementPermissions = Record<string,Record<string,boolean>>;
export type ManagementAccess = {userId:string;firebaseUid:string;version:number;active:boolean;owner:boolean;permissions:ManagementPermissions};
export function cleanManagementProfile(raw:Record<string,any>,id:string):ManagementProfile {
  const result:Record<string,any>={id,pin:''};
  for(const field of MANAGEMENT_PROFILE_FIELDS)if(raw[field]!==undefined)result[field]=raw[field];
  return result as ManagementProfile;
}
export function managementNamespace(value:string):string {
  if(value!=='timbersmith-terminal-v1' && !/^timbersmith-management-test-[a-z0-9-]{3,30}$/.test(value)) throw new Error('Invalid management namespace.');
  return value;
}
