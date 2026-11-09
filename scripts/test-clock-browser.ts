/** Actual isolated Chrome + IndexedDB + Web Locks + offline cached harness. No Firebase data access. */
import assert from 'node:assert/strict';
import {spawn,type ChildProcess} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdirSync,readFileSync,writeFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {build} from 'esbuild';
import {createClockCredential} from '../server/clocking/productionClockSecurity';
import express from 'express';
import {productionClockRoutes} from '../server/clocking/productionClockRoutes';
import {managementRoutes} from '../server/management/managementRoutes';
import {prepareClockEmulatorFixture} from './fixtures/clocking-emulator-fixture';
const device='browser-fixture-'+randomUUID(),employee='fictional-browser-worker',pin='4937';
const useEmulators=process.argv.includes('--emulators');
const directory=new URL('../.local/clock-browser-'+randomUUID()+'/',import.meta.url);mkdirSync(directory,{recursive:true});
const chrome=['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
if(!chrome)throw new Error('Chrome/Edge is required for the isolated browser test.');
let browser:ChildProcess|undefined,socket:WebSocket|undefined,server:ReturnType<typeof createServer>|undefined;
let nextId=0;const pending=new Map<number,{resolve:(value:any)=>void;reject:(error:Error)=>void}>();
function send(method:string,params:any={},sessionId?:string):Promise<any>{
  const id=++nextId;return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject});socket!.send(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})}));});
}
async function launch(){
  browser=spawn(chrome!,['--headless=new','--remote-debugging-port=0','--user-data-dir='+fileURLToPath(new URL('profile/',directory)),
    '--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-sync','--disable-component-update','about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
  const url=await new Promise<string>((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Browser startup timeout')),20000);
    browser!.stderr!.on('data',chunk=>{const match=/DevTools listening on (ws:\/\/[^\s]+)/.exec(String(chunk));if(match){clearTimeout(timer);resolve(match[1]);}});
    browser!.once('error',reject);
  });
  socket=new WebSocket(url);await new Promise<void>((resolve,reject)=>{socket!.onopen=()=>resolve();socket!.onerror=()=>reject(new Error('Browser test connection failed'));});
  socket.onmessage=event=>{const data=JSON.parse(String(event.data));if(!data.id)return;const waiter=pending.get(data.id);if(!waiter)return;pending.delete(data.id);
    data.error?waiter.reject(new Error(data.error.message)):waiter.resolve(data.result);};
}
async function stopBrowser(){
  const child=browser;if(!child)return;
  const exited=new Promise<void>(resolve=>child.once('exit',()=>resolve()));
  if(socket?.readyState===WebSocket.OPEN)await send('Browser.close').catch(()=>{});
  await Promise.race([exited,new Promise<void>(resolve=>setTimeout(resolve,5000))]);
  if(child.exitCode===null)child.kill();socket?.close();browser=undefined;pending.clear();
}
async function evaluate(session:string,expression:string){
  const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},session);
  if(result.exceptionDetails)throw new Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result?.value;
}
async function page(origin:string,offline=false){
  const {targetId}=await send('Target.createTarget',{url:'about:blank'}),{sessionId}=await send('Target.attachToTarget',{targetId,flatten:true});
  await send('Runtime.enable',{},sessionId);await send('Network.enable',{},sessionId);
  await send('Network.setBlockedURLs',{urls:['https://*.googleapis.com/*','https://*.firebaseio.com/*','https://*.firebaseapp.com/*','https://*.google.com/*']},sessionId);
  if(offline)await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0},sessionId);
  await send('Page.navigate',{url:origin},sessionId);
  const deadline=Date.now()+20000;
  while(Date.now()<deadline){if(await evaluate(sessionId,'!!window.clockHarnessLoaded').catch(()=>false))return sessionId;await new Promise(resolve=>setTimeout(resolve,100));}
  throw new Error('Offline harness did not load from cache.');
}
let passed=0;const pass=(name:string)=>{console.log('PASS '+name);passed++;};
async function main(){
  const emulator=useEmulators?await prepareClockEmulatorFixture(device,employee,pin):null;
  let loseNextAcknowledgement=true;
  const apiApp=express();
  if(emulator){
    process.env.TSJ_ENABLE_PRODUCTION_CLOCKING='true';process.env.TSJ_CLOCK_PRODUCTION_SECURITY_CONFIRMED='REVIEWED_RULES_IAM_BACKUP';
    process.env.TSJ_ENABLE_SECURE_MANAGEMENT='true';process.env.TSJ_MANAGEMENT_CUTOVER_CONFIRMED='REVIEWED_IDENTITY_RULES_BACKUP';
    apiApp.use((req,res,next)=>{const original=res.json.bind(res);res.json=((body:any)=>{
      if(loseNextAcknowledgement&&req.path.endsWith('/replay')&&body?.result==='committed'){loseNextAcknowledgement=false;res.destroy();return res;}
      return original(body);}) as typeof res.json;next();});
    apiApp.use('/api/clocking/production',productionClockRoutes());apiApp.use('/api/management',managementRoutes());
    pass('actual Auth and named/default Firestore emulators migrate credentials atomically and deny anonymous PIN reads');
  }
  const browserEnv={VITE_ENABLE_PRODUCTION_CLOCKING:'true',VITE_CLOCK_DEVICE_ID:device,
    VITE_FIREBASE_PROJECT_ID:'demo-tsj-clock-test',VITE_FIREBASE_API_KEY:'demo-fixture-key',VITE_FIREBASE_AUTH_DOMAIN:'demo-tsj-clock-test.firebaseapp.com',
    VITE_FIREBASE_APP_ID:'demo-fixture-app',...(emulator?{VITE_TEST_AUTH_EMULATOR:'http://127.0.0.1:19099'}:{})};
  await build({entryPoints:[fileURLToPath(new URL('fixtures/clocking-browser-harness.ts',import.meta.url))],bundle:true,format:'iife',platform:'browser',
    outfile:fileURLToPath(new URL('bundle.js',directory)),define:{'import.meta.env':JSON.stringify(browserEnv)},logLevel:'silent'});
  writeFileSync(new URL('index.html',directory),'<!doctype html><title>Isolated Clocking fixture</title><script src="/assets/fixture.js"></script><script>window.swReady=(async()=>{await navigator.serviceWorker.register("/sw.js");await navigator.serviceWorker.ready;if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener("controllerchange",resolve,{once:true}));return true;})();</script>');
  writeFileSync(new URL('sw.js',directory),readFileSync(new URL('../public/sw.js',import.meta.url)));
  let missingAssetRequested=false;
  server=createServer((req,res)=>{
    if(req.url==='/api/fixture'){res.setHeader('Content-Type','application/json');res.end('{"fictional":true}');return;}
    if(emulator&&req.url?.startsWith('/api/')){apiApp(req,res);return;}
    if(req.url==='/assets/missing-update.js')missingAssetRequested=true;
    const path=req.url==='/'?'index.html':req.url==='/assets/fixture.js'?'bundle.js':req.url?.slice(1);if(!['index.html','bundle.js','sw.js'].includes(path||'')){res.writeHead(404);res.end();return;}
    res.setHeader('Content-Type',path==='index.html'?'text/html':'application/javascript');res.end(readFileSync(new URL(path!,directory)));});
  await new Promise<void>(resolve=>server!.listen(0,'127.0.0.1',()=>resolve()));const address=server.address();assert.ok(address&&typeof address==='object');const origin='http://127.0.0.1:'+address.port+'/';
  await launch();const first=await page(origin);assert.equal(await evaluate(first,'window.swReady'),true);
  const credential=createClockCredential(device,employee,pin).envelope;
  const entry={credential,worker:{id:employee,name:'Fictional',surname:'Browser Fixture',role:'Employee',status:'Out',isArchived:false,
    clockRevision:0,history:[],shifts:[],breaks:[],todayHours:0,yesterdayHours:0,weeklyHours:0,monthlyHours:0,employeeNumber:''}};
  if(emulator){await evaluate(first,`window.clockBrowserTest.enroll(${JSON.stringify(emulator.enrollmentToken)},${JSON.stringify(employee)},${JSON.stringify(pin)})`);
    await emulator.verifyManagement(origin);pass('real custom-token enrollment, authenticated roster and management session work end to end');}
  else await evaluate(first,`window.clockBrowserTest.seed(${JSON.stringify(entry)},${JSON.stringify(pin)})`);
  assert.equal((await evaluate(first,'window.clockBrowserTest.wrongPin()')).rejected,true);
  assert.equal((await evaluate(first,'window.clockBrowserTest.summary()')).attempts,1);pass('real IndexedDB persists wrong-PIN attempt before verification');
  const second=await page(origin);await evaluate(second,`window.clockBrowserTest.configure(${JSON.stringify(employee)},${JSON.stringify(pin)})`);
  const results=await Promise.all([evaluate(first,'window.clockBrowserTest.submit("In")'),evaluate(second,'window.clockBrowserTest.submit("In")')]);
  assert.equal(results.filter(r=>r.saved).length,1);assert.equal(results.find(r=>r.saved).keyExtractable,false);
  const initial=await evaluate(first,'window.clockBrowserTest.summary()');assert.equal(initial.ids.length,1);assert.equal(initial.status,'In');pass('Web Locks prevent duplicate IN across two real browser tabs');
  assert.equal((await evaluate(first,'window.clockBrowserTest.submit("Out")')).saved,true);
  const queued=await evaluate(first,'window.clockBrowserTest.summary()');assert.equal(queued.ids.length,2);assert.deepEqual(queued.actions,['In','Out']);pass('IN and OUT return saved only after actual durable IndexedDB transactions');
  await evaluate(first,'fetch("/api/fixture",{headers:{Authorization:"Bearer fictional-fixture-only"}}).then(r=>r.json())');
  assert.equal(await evaluate(first,'caches.match("/api/fixture").then(r=>!!r)'),false);
  const originalHtml=readFileSync(new URL('index.html',directory),'utf8');
  writeFileSync(new URL('index.html',directory),originalHtml.replace('/assets/fixture.js','/assets/missing-update.js'));
  await evaluate(first,'fetch("/index.html",{headers:{Accept:"text/html"}}).then(r=>r.text())');
  const assetDeadline=Date.now()+5000;while(!missingAssetRequested&&Date.now()<assetDeadline)await new Promise(resolve=>setTimeout(resolve,50));
  assert.equal(missingAssetRequested,true);
  assert.equal(await evaluate(first,'caches.match("/index.html").then(r=>r.text()).then(html=>html.includes("/assets/fixture.js"))'),true);
  pass('missing critical JS during an update cannot replace the last complete offline shell');
  await stopBrowser();const testServer=server;await new Promise<void>(resolve=>testServer!.close(()=>resolve()));server=undefined;
  // The HTTP server is now stopped. Neither the document nor bundle can load from a live server.
  await launch();const cold=await page(origin+'clocking-kiosk',true);await evaluate(cold,`window.clockBrowserTest.configure(${JSON.stringify(employee)},${JSON.stringify(pin)})`);
  const restored=await evaluate(cold,'window.clockBrowserTest.summary()');assert.equal(restored.online,false);assert.deepEqual(restored.ids,queued.ids);assert.equal(restored.revision,2);assert.equal(restored.status,'Out');
  pass('actual app service worker opens /clocking-kiosk cold offline after one visit, despite missing optional icons');
  assert.equal(await evaluate(cold,'fetch("/api/fixture",{headers:{Authorization:"Bearer fictional-fixture-only"}}).then(()=>false).catch(()=>true)'),true);
  pass('authenticated API data is never cached or replaced with a successful offline HTML response');
  assert.equal((await evaluate(cold,'window.clockBrowserTest.submit("In")')).saved,true);const third=await evaluate(cold,'window.clockBrowserTest.summary()');assert.equal(third.ids.length,3);
  assert.equal(third.encryptedCredential,true);pass('existing PIN unlocks cached encrypted credential and saves a new event after cold offline start');
  assert.equal((await evaluate(cold,'window.clockBrowserTest.storageFailure()')).rejected,true);assert.deepEqual((await evaluate(cold,'window.clockBrowserTest.summary()')).ids,third.ids);
  pass('actual IndexedDB write failure cannot acknowledge or persist a phantom clock event');
  const recovery=await evaluate(cold,'window.clockBrowserTest.recovery()');assert.deepEqual(recovery.events.map((e:any)=>e.event.id),third.ids);
  assert.deepEqual(Object.keys(recovery).sort(),['deviceId','events','exportedAt','format','version']);assert.equal('entries' in recovery,false);
  pass('real recovery export retains every pending ID without PIN envelopes, raw keys or tokens');
  let expectedIds=third.ids;
  if(emulator){
    await new Promise<void>(resolve=>testServer!.listen(address.port,'127.0.0.1',()=>resolve()));server=testServer;
    await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1},cold);
    const firstSync=await evaluate(cold,'window.clockBrowserTest.sync()');assert.equal(firstSync.ok,false);
    await emulator.verifyCommitted(third.ids,1);assert.deepEqual((await evaluate(cold,'window.clockBrowserTest.summary()')).statuses,['pending','pending','pending']);
    pass('server commit with deliberately lost HTTP acknowledgement retains all browser events pending');
    assert.equal((await evaluate(cold,'window.clockBrowserTest.sync()')).ok,true);
    const after=await emulator.verifyCommitted(third.ids,3);assert.equal(after?.status,'In');
    assert.deepEqual((await evaluate(cold,'window.clockBrowserTest.summary()')).statuses,['confirmed','confirmed','confirmed']);
    assert.equal((await evaluate(cold,'window.clockBrowserTest.sync()')).ok,true);await emulator.verifyCommitted(third.ids,3);
    pass('reconnect retries original IDs, receives duplicate receipt safely, and commits each signed event exactly once');
    assert.equal((await evaluate(cold,'window.clockBrowserTest.submit("Break","incorrect-fixture-password")')).saved,false);
    assert.deepEqual((await evaluate(cold,'window.clockBrowserTest.summary()')).ids,third.ids);
    const approved=await evaluate(cold,'window.clockBrowserTest.submit("Break")');
    assert.equal(approved.saved,true,approved.error);
    await send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0},cold);
    assert.equal((await evaluate(cold,'window.clockBrowserTest.submit("Return")')).saved,true);
    assert.equal((await evaluate(cold,'window.clockBrowserTest.submit("Out")')).saved,true);
    expectedIds=(await evaluate(cold,'window.clockBrowserTest.summary()')).ids;
    await send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1},cold);
    assert.equal((await evaluate(cold,'window.clockBrowserTest.sync()')).ok,true);
    const closed=await emulator.verifyCommitted(expectedIds,6);
    assert.equal(closed?.status,'Out');
    assert.equal(closed?.breaks[0].reason,'Bank appointment');
    assert.equal(closed?.breaks[0].shiftStartedAt,closed?.shifts.at(-1).clockInDateTime);
    pass('approved personal Time Off, offline return and clock-out replay preserve the shift and reason');
    const leave=await evaluate(cold,'window.clockBrowserTest.workerRequest("leave")');
    assert.equal(leave.notified,2);
    const advance=await evaluate(cold,'window.clockBrowserTest.workerRequest("advance")');
    assert.equal(advance.notified,2);
    assert.deepEqual(await evaluate(cold,'window.clockBrowserTest.retryWorkerRequest()'),advance);
    assert.equal(await evaluate(cold,'window.clockBrowserTest.tamperWorkerRequest()'),true);
    await emulator.verifyWorkerRequests(leave.id,advance.id);
    pass('worker requests save once and notify only active configured recipients without exposing the employee PIN');
  }
  await evaluate(cold,'window.clockBrowserTest.block()');
  assert.equal((await evaluate(cold,emulator?'window.clockBrowserTest.submit("In")':'window.clockBrowserTest.submit("Out")')).saved,false);
  assert.deepEqual((await evaluate(cold,'window.clockBrowserTest.summary()')).ids,expectedIds);pass('blocked device preserves its pending journal and refuses new clocking');
  console.log(`All ${passed} isolated real-browser checks passed. Fake employees only; ${emulator?'demo emulators only, no production access':'no Firebase tokens or writes'}. Test profile: ${fileURLToPath(directory)}`);
}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await stopBrowser();if(server)await new Promise<void>(resolve=>server!.close(()=>resolve()));});
