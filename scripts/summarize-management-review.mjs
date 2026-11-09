/** Local analysis only. Never reads credentials, calls Firebase, or applies a selection. */
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const directory=new URL('../.local/',import.meta.url);
const report=JSON.parse(readFileSync(new URL('management-migration-review.json',directory),'utf8'));
const grants=matrix=>Object.entries(matrix||{}).flatMap(([module,actions])=>Object.entries(actions||{}).filter(([,value])=>value===true).map(([action])=>module+':'+action)).sort();
const signature=matrix=>JSON.stringify(grants(matrix));
const emails=[...new Set(report.profiles.map(p=>p.email))].sort();
const unused=process.argv.includes('--unused-placeholders')?new Set(['employee@tsjoinery.co.za','purchasing@tsjoinery.co.za']):new Set();
const proposal=emails.map(email=>{
  const profiles=report.profiles.filter(p=>p.email===email);
  const overrides=[...new Map(profiles.flatMap(p=>p.overrideCandidates).map(o=>[o.id,o])).values()];
  const bound=profiles.filter(p=>overrides.some(o=>o.userId===p.id));
  const suggested=profiles.length===1?profiles[0]:bound.length===1?bound[0]:null;
  const variants=[...new Set(overrides.map(o=>signature(o.effectivePermissions)))];
  const accessKnown=profiles.flatMap(p=>p.overrideCandidates).every(o=>typeof o.accessFingerprint==='string');
  const accessVariants=[...new Set(profiles.flatMap(p=>p.overrideCandidates).map(o=>o.accessFingerprint))];
  // This mirrors the existing setUsers placeholder filter and last-live-record precedence.
  // No DEFAULT_ACCOUNTS passwords or credentials are loaded by this analysis.
  const eligible=profiles.filter(p=>p.email==='stock@tsjoinery.co.za'||
    !(['employee@tsjoinery.co.za','purchasing@tsjoinery.co.za'].includes(p.email)||
      ['employee user','purchasing user','elrico user','franz user','frans user','janah user','marietjie user'].includes(p.name.trim().toLowerCase())));
  const currentSource=eligible.at(-1)||null;
  const legacySourceMatchesSuggestion=!!suggested&&currentSource?.id===suggested.id;
  const orderedOverrides=[...(suggested?.overrideCandidates||[])].sort((a,b)=>
    (Date.parse(b.updatedAt)||0)-(Date.parse(a.updatedAt)||0)||Number(b.id===suggested.id)-Number(a.id===suggested.id)||a.id.localeCompare(b.id));
  const differingPermissions=overrides.length>1?[...new Set(overrides.flatMap(o=>grants(o.effectivePermissions)))].filter(key=>overrides.some(o=>!grants(o.effectivePermissions).includes(key))):[];
  const credentialAgreement=profiles.every(p=>p.credentialAgreement===true);
  return {email,profileIds:profiles.map(p=>p.id),profileNames:profiles.map(p=>p.name),
    suggestedProfileId:suggested?.id||null,suggestionReason:profiles.length===1?'Only existing profile':bound.length===1?'Only profile explicitly bound by permission records':'Owner selection required',
    credentialAgreement:report.profiles.some(p=>p.credentialAgreement===undefined)?null:credentialAgreement,
    permissionsEquivalent:overrides.length>0?variants.length===1:null,
    deviceAccessEquivalent:overrides.length>0&&accessKnown?accessVariants.length===1:null,
    currentUiProfileSourceId:currentSource?.id||null,legacySourceMatchesSuggestion,
    credentialSourceId:legacySourceMatchesSuggestion?currentSource.id:null,
    suggestedPermissionSourceId:variants.length===1?orderedOverrides[0]?.id||null:null,
    proposedDisposition:unused.has(email)?'EXCLUDE_UNUSED_AT_REVIEWED_CUTOVER':'KEEP_EXISTING_ID_AND_CURRENT_CREDENTIAL',
    overrideCandidates:overrides.map(o=>({id:o.id,userId:o.userId,updatedAt:o.updatedAt,allowedActions:grants(o.effectivePermissions).length,
      allowedModules:[...new Set(grants(o.effectivePermissions).map(k=>k.slice(0,k.lastIndexOf(':'))))]})),
    differingPermissions,
    ownerReviewRequired:profiles.length>1||variants.length>1||!overrides.length||accessVariants.length>1,
    applied:false};
});
const result={sourceGeneratedAt:report.generatedAt,namespace:report.namespace,mode:'PROPOSAL_ONLY_NO_WRITES',
  profiles:report.profiles.length,uniqueEmails:proposal.length,proposedActiveAccounts:proposal.filter(p=>!unused.has(p.email)).length,
  deleteLegacyRecords:false,ownerApproved:false,users:proposal};
writeFileSync(new URL('management-reconciliation-proposal.json',directory),JSON.stringify(result,null,2));
const lines=['# Gebruikershersiening — voorstel, geen veranderinge toegepas nie','',
  'Die uitvee van geargiveerde artisans verander nie hierdie aparte bestuursaanmeldings nie.',
  'Die voorgestelde profiel volg bestaande eksplisiete gebruiker-ID-verwysings; dit is nog nie ’n gemagtigde keuse nie.',
  'Toestemmings word nie saamgevoeg om ekstra toegang te verleen nie. PINs en wagwoorde word nie in hierdie verslag gestoor nie.','',
  '| Aanmelding | Profiele | Voorgestelde profiel-ID | Toestemmings | PINs stem ooreen | Voorstel |',
  '|---|---:|---|---|---|---|',...proposal.map(p=>`| ${p.email} | ${p.profileIds.length} | ${p.suggestedProfileId||'Jou keuse nodig'} | ${p.permissionsEquivalent===true?'Kandidate gee dieselfde toegang':p.permissionsEquivalent===false?'VERSKIL — hersien':'Geen aparte toelae'} | ${p.credentialAgreement===null?'Nog nie nagegaan':p.credentialAgreement?'Ja':'NEE — behou huidige profiel se PIN'} | ${unused.has(p.email)?'Ongebruik; hou buite nuwe aanmelding':'Behou'} |`),''];
for(const p of proposal.filter(p=>p.differingPermissions.length)){
  lines.push('## '+p.email,'','Toegangsverskille: '+p.differingPermissions.join(', '),'');
}
for(const p of proposal.filter(p=>p.deviceAccessEquivalent===false)){
  lines.push('## Toestel-/skermverskil: '+p.email,'',
    'Voorgestelde bron is die mees onlangs gewysigde toestemmingrekord: '+p.suggestedPermissionSourceId+'.',
    'Geen nuwe toegang word deur ’n samevoeging verleen nie. Vergelyk eksplisiete skermblokkasies voor migrasie.','');
}
writeFileSync(new URL('management-reconciliation-proposal.md',directory),lines.join('\n'));
const owner=process.argv.find(arg=>arg.startsWith('--owner-email='))?.slice(14).trim().toLowerCase();
if(owner){
  if(!report.sourceVersions?.length||!Array.isArray(report.overrideVersions))throw new Error('Refresh the inspection to obtain source versions.');
  const included=proposal.filter(p=>!unused.has(p.email));
  if(included.some(p=>!p.legacySourceMatchesSuggestion||!p.credentialSourceId||p.permissionsEquivalent!==true)||!included.some(p=>p.email===owner))throw new Error('Unresolved identity/permission choices; do not generate an executable manifest.');
  const manifest={schema:1,namespace:report.namespace,ownerEmail:owner,sources:report.sourceVersions,overrides:report.overrideVersions,
    choices:proposal.map(p=>({email:p.email,sourceId:p.suggestedProfileId,permissionSourceId:p.suggestedPermissionSourceId,include:!unused.has(p.email)}))};
  const name='management-migration-'+createHash('sha256').update(JSON.stringify(manifest)).digest('hex').slice(0,16)+'.json';
  writeFileSync(new URL(name,directory),JSON.stringify(manifest,null,2));
  console.log('REVIEW CANDIDATE ONLY. No migration applied. Manifest: .local/'+name);
}
console.log(JSON.stringify({...result,users:proposal.map(({overrideCandidates,...p})=>({...p,overrideCandidates:overrideCandidates.map(({allowedModules,...o})=>o)}))}));
