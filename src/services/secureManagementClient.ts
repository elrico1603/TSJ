import { auth,APP_ID_PATH } from '../firebase';
import type { AppUser } from '../auth';
const env=(import.meta as unknown as {env?:Record<string,string>}).env||{};
export const secureManagementEnabled=env.VITE_ENABLE_SECURE_MANAGEMENT==='true';
const origin=env.VITE_MANAGEMENT_API_ORIGIN||'';
export class ManagementHttpError extends Error {constructor(message:string,readonly status:number){super(message);}}
async function request(path:string,body?:unknown,authenticated=true):Promise<any>{
  if(!secureManagementEnabled)throw new Error('Secure management is disabled.');
  if(origin){const url=new URL(origin);if(url.protocol!=='https:'||url.origin!==origin||url.username||url.password)throw new Error('Invalid management backend origin.');}
  const user=auth.currentUser;
  if(authenticated&&(!user||user.isAnonymous))throw new Error('Sign in with a verified management account.');
  const headers:Record<string,string>={'Content-Type':'application/json'};
  if(authenticated)headers.Authorization='Bearer '+await user!.getIdToken();
  const response=await fetch(origin+'/api/management/'+path,{method:body===undefined?'GET':'POST',headers,
    credentials:'omit',cache:'no-store',signal:AbortSignal.timeout(15000),...(body===undefined?{}:{body:JSON.stringify(body)})});
  let data;try{data=await response.json();}catch{throw new Error('Management server did not confirm the operation.');}
  if(!response.ok)throw new ManagementHttpError(typeof data.error==='string'?data.error:'Management request failed.',response.status);
  return data;
}
export async function signInManagement(identifier:string,password:string):Promise<AppUser>{
  const result=await request('login',{identifier,password},false);
  if(typeof result.customToken!=='string'||!result.user?.id)throw new Error('Invalid management sign-in response.');
  await auth.signInWithCustomToken(result.customToken);
  return currentManagementUser();
}
export async function currentManagementUser():Promise<AppUser>{const result=await request('session');if(!result.user?.id||result.user.pin!=='')throw new Error('Invalid sanitized user session.');return result.user;}
export async function signOutManagement():Promise<void>{await auth.signOut();}
export async function verifyManagementPassword(password:string):Promise<boolean>{return (await request('reauth',{password})).verified===true;}
export async function verifyManagementEmployeePin(id:string,pin:string):Promise<boolean>{return (await request('employees/pin',{id,pin})).verified===true;}
export async function createManagementUser(user:unknown):Promise<AppUser>{return (await request('users/create',{user})).user;}
export async function registerManagementUser(user:unknown):Promise<AppUser>{return (await request('register',user,false)).user;}
export async function updateManagementUser(id:string,patch:unknown,operation='update'):Promise<AppUser>{return (await request('users/update',{id,patch,operation})).user;}
export async function writeManagementAudit(event:string,details:string):Promise<void>{await request('audit',{event,details});}
export async function writeManagementDocument(path:string,operation:string,data?:unknown):Promise<any>{return request(path.includes('/public/data/employees/')?'employees/write':'document',{path,operation,...(data===undefined?{}:{data})});}

/** Preserve compat-style references and realtime reads; guarded account/RBAC writes go to the backend. */
export function managementWriteProxy<T extends object>(database:T,writer=writeManagementDocument):T {
  const protectedPath=(path:string)=>/^(roles|rolePermissions|userRoles|userPermissionOverrides|role_audit_logs)\//.test(path)||
    /^artifacts\/[^/]+\/(private\/users\/active|private\/(permissions|role_audit_logs)\/items|public\/(roles|rolePermissions|userRoles)\/items|public\/data\/employees)\//.test(path);
  const wrap=(target:any,path=''):any=>new Proxy(target,{
    get(ref,key){
      if((key==='set'||key==='update'||key==='delete')&&protectedPath(path))return (data?:unknown)=>writer(path,String(key),data);
      if(key==='add'&&protectedPath(path+'/_'))return async(data:unknown)=>{
        const child=ref.doc();await writer(path+'/'+child.id,'set',data);return wrap(child,path+'/'+child.id);
      };
      if(key==='collection')return (name:string)=>{
        if(!path&&['roles','rolePermissions','userRoles','userPermissionOverrides','role_audit_logs'].includes(name)){
          const visibility=name==='userPermissionOverrides'||name==='role_audit_logs'?'private':'public';
          const kind=name==='userPermissionOverrides'?'permissions':name;
          const mapped='artifacts/'+APP_ID_PATH+'/'+visibility+'/'+kind+'/items';
          return wrap((database as any).collection('artifacts').doc(APP_ID_PATH).collection(visibility).doc(kind).collection('items'),mapped);
        }
        return wrap(ref.collection(name),path?path+'/'+name:name);
      };
      if(key==='doc')return (id?:string)=>{const child=id===undefined?ref.doc():ref.doc(id);return wrap(child,path?path+'/'+child.id:child.path||id||'');};
      const value=ref[key];return typeof value==='function'?value.bind(ref):value;
    }
  });
  return wrap(database);
}
