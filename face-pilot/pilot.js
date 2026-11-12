import {LIMITS,frameCheck,matchScore,profileMatch,eyeOpenness,yawAngle} from './checks.js';
const el=id=>document.getElementById(id);
const camera=el('camera'), canvas=document.createElement('canvas');
const ctx=canvas.getContext('2d',{alpha:false});
let engine=null, stream=null, profile=null, busy=false, generation=0;
const buttons=['start','enroll','verify','cancel','clear'];
function controls(){
  el('start').disabled=busy||!!stream;
  el('enroll').disabled=busy||!stream||!!profile;
  el('verify').disabled=busy||!stream||!profile;
  el('cancel').disabled=!stream&&!busy;
  el('clear').disabled=busy||!profile;
}
function tell(message){el('instruction').textContent=message;}
function result(message,kind='neutral'){
  el('result').textContent=message;
  el('result').className='result '+kind;
}
function score(v){return Number.isFinite(v)?(v*100).toFixed(1)+'%':'—';}
function diagnostics(data,similarity=null){
  const f=data?.face?.length===1?data.face[0]:null;
  el('faces').textContent=String(data?.face?.length??0);
  el('confidence').textContent=score(f?.faceScore??f?.boxScore);
  el('real').textContent=score(f?.real);
  el('live').textContent=score(f?.live);
  el('match').textContent=score(similarity);
}
function clearDiagnostics(){for(const id of ['faces','confidence','real','live','match','challenge'])el(id).textContent='—';}
function setProfile(value){
  profile=value;
  el('profile').textContent=profile?'Temporary profile enrolled in this page only.':'No temporary profile enrolled.';
  controls();
}
function stopCamera(){
  generation++;
  if(stream){for(const track of stream.getTracks())track.stop();}
  stream=null;camera.srcObject=null;busy=false;
  el('camera-label').textContent='Camera off';
  tell('Camera stopped. Start it again to continue.');
  controls();
}
function assertCurrent(id){
  if(id!==generation || !stream || document.visibilityState==='hidden')throw Error('Scan cancelled.');
}
async function start(){
  if(busy||stream)return;
  if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia){
    result('Camera unavailable: open this page over HTTPS or localhost.','fail');return;
  }
  const id=++generation;busy=true;controls();clearDiagnostics();
  result('Loading…');tell('Allow front-camera access. The first load may take a moment.');
  let incoming=null;
  try{
    incoming=await navigator.mediaDevices.getUserMedia({audio:false,video:{
      facingMode:{ideal:'user'},width:{ideal:960},height:{ideal:720}
    }});
    if(id!==generation){incoming.getTracks().forEach(t=>t.stop());return;}
    stream=incoming;camera.srcObject=stream;await camera.play();assertCurrent(id);
    el('camera-label').textContent='Live camera';
    if(!engine){
      if(!window.Human?.Human)throw Error('Local recognition library did not load.');
      tell('Loading the local face and anti-spoof models…');
      const model=new window.Human.Human({
        backend:'webgl',modelBasePath:new URL('./models/',location.href).href,
        cacheModels:false,cacheSensitivity:0,skipAllowed:false,debug:false,
        face:{
          enabled:true,detector:{rotation:true,maxDetected:2,return:false,skipFrames:0,skipTime:0},
          mesh:{enabled:true},attention:{enabled:false},iris:{enabled:false},
          description:{enabled:true,skipFrames:0,skipTime:0},
          emotion:{enabled:false},antispoof:{enabled:true,skipFrames:0,skipTime:0},
          liveness:{enabled:true,skipFrames:0,skipTime:0}
        },
        body:{enabled:false},hand:{enabled:false},object:{enabled:false},
        segmentation:{enabled:false},gesture:{enabled:false}
      });
      await model.load();assertCurrent(id);engine=model;
    }
    result('Camera and models ready','pass');
    tell(profile?'Select Verify my face.':'Select Enroll my face. Look at the camera in good lighting.');
  }catch(error){
    if(id!==generation){incoming?.getTracks().forEach(t=>t.stop());return;}
    stopCamera();result('Cannot start: '+(error?.message||String(error)),'fail');
    tell('Check camera permission, HTTPS and browser WebGL support. No verification was granted.');
  }finally{if(id===generation){busy=false;controls();}}
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function freshFrame(id,lastTime){
  assertCurrent(id);
  // Use a fresh live-camera frame, not an uploaded picture or reused result.
  let wait=0;
  while((camera.readyState<2||camera.currentTime<=lastTime)&&wait<100){
    await sleep(50);wait++;assertCurrent(id);
  }
  if(camera.readyState<2||camera.currentTime<=lastTime)throw Error('Camera stopped delivering fresh frames.');
  if(!ctx||!camera.videoWidth||!camera.videoHeight)throw Error('Camera frame unavailable.');
  const max=960, scale=Math.min(1,max/Math.max(camera.videoWidth,camera.videoHeight));
  const w=Math.round(camera.videoWidth*scale),h=Math.round(camera.videoHeight*scale);
  if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}
  const time=camera.currentTime;
  ctx.drawImage(camera,0,0,w,h);
  const data=await engine.detect(canvas);
  assertCurrent(id);
  return {data,time};
}
function randomActions(){
  return crypto.getRandomValues(new Uint8Array(1))[0]%2===0?['blink','turn']:['turn','blink'];
}
async function scan(mode){
  if(busy||!engine||!stream||(mode==='verify'&&!profile)||(mode==='enroll'&&profile))return;
  const id=++generation;
  busy=true;controls();clearDiagnostics();result(mode==='enroll'?'Enrolling…':'Verifying…');
  const actions=randomActions(), completed=[];
  let phase='center', base=null, eyesOpen=null, closed=false, turned=false;
  let lastTime=-1, collected=[], lastReason='Waiting for a clear, live face.';
  let lastAcceptedAt=0;
  const deadline=performance.now()+60000;
  function prompt(){
    if(phase==='center')return 'Look straight at the camera. Keep your eyes open.';
    if(phase==='blink')return closed?'Open your eyes and look straight at the camera.':'Close both eyes briefly, then open them.';
    if(phase==='turn')return turned?'Turn your head back to the centre.':'Slowly turn your head slightly to either side.';
    return 'Look straight at the camera while we confirm three matching frames.';
  }
  function advance(){
    if(phase==='blink'||phase==='turn')completed.push(phase);
    phase=actions.shift()||'samples';closed=false;turned=false;
    el('challenge').textContent=completed.length+' / 2 completed';
    tell(prompt());
  }
  tell(prompt());el('challenge').textContent='0 / 2 completed';
  try{
    while(performance.now()<deadline){
      const {data,time}=await freshFrame(id,lastTime);lastTime=time;
      if(performance.now()>=deadline)break;
      const check=frameCheck(data);
      if(!check.ok){
        diagnostics(data);lastReason=check.reason;
        // A second face or interrupted presence invalidates the active challenge.
        if(base && data?.face?.length!==1)throw Error(check.reason+' Start a new scan.');
        tell(lastReason+' '+prompt());await sleep(100);continue;
      }
      const f=check.face;
      const own=mode==='verify'?profileMatch(engine,profile,f.embedding):null;
      diagnostics(data,own);
      if(mode==='verify' && (own===null || own<LIMITS.similarity)){
        throw Error('Face does not match the enrolled test profile.');
      }
      if(base){
        const continuity=matchScore(engine,base,f.embedding);
        if(continuity===null||continuity<0.50)throw Error('The face changed during the challenge.');
      }
      const yaw=yawAngle(f), eye=eyeOpenness(f);
      if(yaw===null||eye===null){lastReason='Face landmarks unavailable.';tell(lastReason);continue;}
      if(phase==='center'){
        if(Math.abs(yaw)>0.18||eye<0.12){lastReason='Face the camera with eyes open.';tell(lastReason);continue;}
        base=f.embedding.slice();eyesOpen=eye;advance();
      }else if(phase==='blink'){
        if(Math.abs(yaw)<=0.25){
          if(!closed&&eye<eyesOpen*0.58){closed=true;tell(prompt());}
          else if(closed&&eye>eyesOpen*0.80){advance();}
        }
      }else if(phase==='turn'){
        if(!turned&&Math.abs(yaw)>0.25){turned=true;tell(prompt());}
        else if(turned&&Math.abs(yaw)<0.15){advance();}
      }else if(phase==='samples'){
        if(Math.abs(yaw)<0.18&&eye>eyesOpen*0.75&&performance.now()-lastAcceptedAt>250){
          collected.push(f.embedding.slice());lastAcceptedAt=performance.now();
          el('challenge').textContent='2 / 2 complete • '+collected.length+' / '+LIMITS.samples+' samples';
          if(collected.length===LIMITS.samples){
            assertCurrent(id);
            if(completed.length!==2||performance.now()>=deadline)throw Error('Challenge incomplete or expired.');
            if(mode==='enroll'){
              setProfile(collected);
              result('TEST PROFILE ENROLLED','pass');tell('Now select Verify my face. No employee data was changed.');
            }else{
              result('TEST VERIFIED — SAME FACE','pass');
              tell('Face match, anti-spoofing, liveness and both challenges passed. No real clock event was created.');
            }
            return;
          }
        }
      }
      lastReason='Challenge not yet completed.';
      await sleep(80);
    }
    throw Error('Timed out. '+lastReason);
  }catch(error){
    if(id===generation){
      result('TEST REFUSED — '+(error?.message||String(error)),'fail');
      tell('No verification granted. Improve lighting or try again with the enrolled person.');
    }
  }finally{
    if(id===generation){busy=false;controls();}
    // Only the enrolled in-memory descriptor array survives a completed scan.
    base=null;collected=[];ctx?.clearRect(0,0,canvas.width,canvas.height);
  }
}
el('start').addEventListener('click',()=>void start());
el('enroll').addEventListener('click',()=>void scan('enroll'));
el('verify').addEventListener('click',()=>void scan('verify'));
el('cancel').addEventListener('click',()=>{stopCamera();result('Camera stopped');clearDiagnostics();});
el('clear').addEventListener('click',()=>{setProfile(null);clearDiagnostics();result('Test profile cleared');tell('Enroll again if you want another test.');});
window.addEventListener('pagehide',()=>{stopCamera();setProfile(null);});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){stopCamera();result('Camera paused');}});
controls();
