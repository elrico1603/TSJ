/** Evaluation only: inline prototype, synthetic resources, all service reads mocked. Never publishes rules. */
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
const project='timbersmithapp',ns='timbersmith-management-test-rules';
const base='/databases/(default)/documents/',root='artifacts/'+ns+'/';
const acl={userId:'fixture-manager',firebaseUid:'fixture-uid',version:1,active:true,owner:false,permissions:{Clocking:{View:true},Inventory:{View:true,Create:true,Edit:true}}};
const auth={uid:acl.firebaseUid,token:{tsj_management:true,tsj_namespace:ns,tsj_user_id:acl.userId,tsj_version:1,firebase:{sign_in_provider:'custom'}}};
const cases=[];
function add(name,expectation,path,method='get',options={}){
  const access={...acl,...options.acl};
  cases.push({name,test:{expectation,request:{auth:options.auth===null?null:options.auth||auth,path:base+path,method,
    ...(options.after?{resource:{data:options.after}}:{})},resource:{data:options.before||{}},
    functionMocks:[{function:'get',args:[{exactValue:base+root+'private/security/access/'+acl.firebaseUid}],result:{value:{data:access}}},
      // Any unanticipated service access is undefined, never a real document read.
      {function:'get',args:[{anyValue:{}}],result:{undefined:{}}},
      {function:'exists',args:[{anyValue:{}}],result:{value:false}}]}});
}
for(const path of ['private/users/active/other','public/data/employees/worker','public/data/employeeViews/worker','public/data/clockEventReceipts/event','private/security/access/fixture-uid'])
  add('anonymous denied '+path,'DENY',root+path,'get',{auth:null});
add('valid clock reader sanitized roster','ALLOW',root+'public/data/employeeViews/worker');
add('clock reader cannot read raw PIN','DENY',root+'public/data/employees/worker');
add('clock reader cannot read other user','DENY',root+'private/users/active/other');
add('self profile allowed','ALLOW',root+'private/users/active/'+acl.userId);
add('deactivated self ACL stays readable for sign-out','ALLOW',root+'private/security/access/'+acl.firebaseUid,'get',{acl:{active:false}});
add('stale token denied','DENY',root+'public/data/employeeViews/worker','get',{acl:{version:2}});
add('inactive token denied','DENY',root+'public/data/employeeViews/worker','get',{acl:{active:false}});
add('anonymous-provider fake management claims denied','DENY',root+'public/data/employeeViews/worker','get',{auth:{...auth,token:{...auth.token,firebase:{sign_in_provider:'anonymous'}}}});
add('namespace mismatch denied','DENY','artifacts/timbersmith-terminal-v1/public/data/employeeViews/worker');
for(const path of ['private/security/access/fixture-uid','private/users/active/'+acl.userId,'public/data/employees/worker','public/data/clockEventReceipts/event','private/permissions/items/other'])
  for(const method of ['create','update','delete'])add('even owner cannot directly '+method+' '+path,'DENY',root+path,method,{acl:{owner:true},after:{owner:true},before:{owner:false}});
add('inventory create allowed','ALLOW',root+'public/data/inventory/fixture','create',{after:{name:'Fixture',createdAt:'2026-11-05'}});
add('inventory unknown credential field denied','DENY',root+'public/data/inventory/fixture','create',{after:{name:'Fixture',password:'forbidden'}});
add('inventory update validates credential fields too','DENY',root+'public/data/inventory/fixture','update',{before:{name:'Fixture'},after:{name:'Fixture',pinHash:'forbidden'}});
add('inventory creation identity immutable','DENY',root+'public/data/inventory/fixture','update',{before:{name:'Fixture',createdAt:'original'},after:{name:'Changed',createdAt:'changed'}});
add('unknown module denied even owner','DENY',root+'public/data/unknown/fixture','create',{acl:{owner:true},after:{name:'Fixture'}});
add('test realm cannot access shared root data','DENY','inventory/fixture');
add('old global RBAC denied','DENY','userPermissionOverrides/fixture');
add('unmatched path denied','DENY','unmatched/fixture');
const source={files:[{name:'firestore.rules',content:readFileSync(new URL('../config/firestore.management.prototype.rules',import.meta.url),'utf8')}]};
if(!process.argv.includes('--evaluate')){console.log(`DRY RUN: ${cases.length} synthetic evaluations prepared; no credentials/network/publication.`);process.exit(0);}
const command=process.platform==='win32'?(process.env.ComSpec||'cmd.exe'):'gcloud';
const args=process.platform==='win32'?['/d','/s','/c','gcloud auth print-access-token --account=elrico@tsjoinery.co.za --quiet']:['auth','print-access-token','--account=elrico@tsjoinery.co.za','--quiet'];
const token=execFileSync(command,args,{encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();
const response=await fetch('https://firebaserules.googleapis.com/v1/projects/'+project+':test',{method:'POST',headers:{Authorization:'Bearer '+token,'x-goog-user-project':project,'Content-Type':'application/json'},
  body:JSON.stringify({source,testSuite:{testCases:cases.map(c=>c.test)}}),signal:AbortSignal.timeout(45000)});
const result=await response.json();
if(!response.ok)throw new Error('Rules evaluation HTTP '+response.status+': '+JSON.stringify(result.error?.message));
for(const issue of result.issues||[])console.log(JSON.stringify(issue));
let failed=0;
for(let i=0;i<cases.length;i++){const r=result.testResults?.[i];const ok=r?.state==='SUCCESS';if(!ok)failed++;console.log((ok?'PASS ':'FAIL ')+cases[i].name+(ok?'':' '+JSON.stringify(r)));}
if((result.issues||[]).some(i=>i.severity==='ERROR')||failed)throw new Error(`${failed} evaluations failed. Prototype not ready.`);
console.log(`All ${cases.length} synthetic Rules evaluations passed. No ruleset/release/document writes.`);
