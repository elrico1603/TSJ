/** Read-only published-rule verification. The PATCH probe cannot create a document. */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const project='timbersmithapp', database='tsj-clock-registry';
const expectedDefault=process.argv.find(a=>a.startsWith('--expect-default-ruleset='))?.split('=')[1];
if(!expectedDefault || !/^[a-z0-9-]+$/i.test(expectedDefault)) throw new Error('Provide the independently recorded default ruleset ID.');
const command=process.platform==='win32' ? (process.env.ComSpec || 'cmd.exe') : 'gcloud';
const args=process.platform==='win32'
  ? ['/d','/s','/c','gcloud auth print-access-token --account=elrico@tsjoinery.co.za --quiet']
  : ['auth','print-access-token','--account=elrico@tsjoinery.co.za','--quiet'];
const token=execFileSync(command,args,
  {encoding:'utf8',windowsHide:true,stdio:['ignore','pipe','pipe']}).trim();
const headers={Authorization:'Bearer '+token,'x-goog-user-project':project};
async function api(path) {
  const response=await fetch('https://firebaserules.googleapis.com/v1/'+path,{headers,signal:AbortSignal.timeout(15000)});
  if(!response.ok) throw new Error('Published rules could not be independently read: HTTP '+response.status);
  return response.json();
}
const releases=await api('projects/'+project+'/releases?pageSize=100');
if(releases.nextPageToken)throw new Error('Release inventory requires pagination; do not infer absence.');
const defaultRelease=releases.releases.find(r=>r.name==='projects/'+project+'/releases/cloud.firestore');
const namedRelease=releases.releases.find(r=>r.name==='projects/'+project+'/releases/cloud.firestore/'+database);
if(defaultRelease?.rulesetName!=='projects/'+project+'/rulesets/'+expectedDefault) throw new Error('Default rules changed: stop and inspect before proceeding.');
if(!namedRelease || !/^projects\/timbersmithapp\/rulesets\/[a-z0-9-]+$/i.test(namedRelease.rulesetName)) throw new Error('Named registry release not found.');
const namedRules=await api(namedRelease.rulesetName);
const local=readFileSync(new URL('../config/firestore.clock-registry.rules',import.meta.url),'utf8');
const normalize=text=>text.replace(/\r\n/g,'\n').trim();
if(namedRules.source?.files?.length!==1 || normalize(namedRules.source.files[0].content)!==normalize(local)) {
  throw new Error('Published named registry rules do not match the reviewed local deny-all file.');
}
const config=JSON.parse(readFileSync(new URL('../firebase.clock-registry.json',import.meta.url),'utf8'));
if(config.firestore?.length!==1 || config.firestore[0].database!==database) throw new Error('Dedicated deployment config is not isolated to the named registry.');
const firebaseSource=readFileSync(new URL('../src/firebase.ts',import.meta.url),'utf8');
const publicKey=/apiKey:.*?"([^"]+)"/.exec(firebaseSource)?.[1];
if(!publicKey)throw new Error('Public app API key not found.');
const base='https://firestore.googleapis.com/v1/projects/'+project+'/databases/'+database+'/documents/security_verification/'+randomUUID();
const probes=[];
for(const method of ['GET','PATCH']) {
  const response=await fetch(base+'?key='+encodeURIComponent(publicKey)+(method==='PATCH'?'&currentDocument.exists=true':''),{
    method,signal:AbortSignal.timeout(15000),
    ...(method==='PATCH'?{headers:{'Content-Type':'application/json'},body:JSON.stringify({fields:{syntheticProbe:{booleanValue:true}}})}:{})
  });
  const body=await response.json();
  probes.push({method,status:response.status,error:body.error?.status});
  if(response.status!==403 || body.error?.status!=='PERMISSION_DENIED') throw new Error(method+' registry probe did not produce the required rules denial.');
}
console.log(JSON.stringify({verifiedAt:new Date().toISOString(),project,database,
  defaultReleaseUnchanged:defaultRelease.rulesetName,namedRelease:namedRelease.name,
  namedRuleset:namedRelease.rulesetName,localDenyAllMatchesPublished:true,probes,
  safety:'No employee reads or data writes. PATCH requires an existing randomly named document and cannot create one.'},null,2));
