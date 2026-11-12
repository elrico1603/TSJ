import {LIMITS,frameCheck,matchScore,profileMatch,yawAngle} from './checks.js';
const el=id=>document.getElementById(id);
const camera=el('camera'), canvas=document.createElement('canvas');
const ctx=canvas.getContext('2d',{alpha:false});
let engine=null, stream=null, profile=null, busy=false, generation=0, retryStep=null;
function controls(){
  el('start').disabled=busy||!!stream;
  el('enroll').disabled=busy||!stream||!!profile;
  el('verify').disabled=busy||!stream||!profile;
  el('retry').disabled=!busy||!retryStep;
  el('cancel').disabled=!stream&&!busy;
  el('clear').disabled=busy||!profile;
}
function tell(message){el('instruction').textContent=message;}
function quality(message){el('quality').textContent=message;}
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
function clearDiagnostics(){for(const id of ['faces','confidence','real','live','match','challenge','yaw'])el(id).textContent='—';quality('');}
function setProfile(value){
  profile=value;
  el('profile').textContent=profile?'Temporary profile enrolled in this page only.':'No temporary profile enrolled.';
  controls();
}
function stopCamera(){
  generation++;
  if(stream){for(const track of stream.getTracks())track.stop();}
  stream=null;camera.srcObject=null;busy=false;retryStep=null;
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
  const capturedAt=performance.now();
  ctx.drawImage(camera,0,0,w,h);
  const data=await engine.detect(canvas);
  assertCurrent(id);
  return {data,time,capturedAt};
}
// Simple, three-step pilot. An unsuccessful pose or quality check retries
// ONLY the current stage. Never approve an unverified frame or substitute
// a different person's face for the person who began the challenge.
async function scan(mode){
  if(busy||!engine||!stream||(mode==='verify'&&!profile)||(mode==='enroll'&&profile))return;
  const id=++generation;
  busy=true;clearDiagnostics();result(mode==='enroll'?'Enrolling…':'Verifying…');
  const instructions=[
    'Step 1 of 3 — Look straight at the camera. Blink normally.',
    'Step 2 of 3 — Turn your head slightly to EITHER side. Hold there until the next instruction.',
    'Step 3 of 3 — Look straight at the camera again. We will finish automatically.'
  ];
  const TURN=0.20, RETURN=0.16, HOLD_MS=300, CUE_MS=850;
  const STEP_MS=20000, SESSION_MS=300000;
  let step=0,cueAt=performance.now(),holdAt=null,holdCount=0,holdDirection=0;
  let base=null,baselineYaw=null,identityFailures=0;
  let lastTime=-1,collected=[],lastAcceptedAt=0,lastReason='Waiting for a clear, live face.';
  const deadline=performance.now()+SESSION_MS;
  function resetHold(){holdAt=null;holdCount=0;holdDirection=0;}
  function resetStep(message=''){
    resetHold();cueAt=performance.now();collected=[];lastAcceptedAt=0;
    // Keep the baseline, identity and already completed stages.
    tell(instructions[step]);
    el('challenge').textContent='Step '+(step+1)+' / 3';
    quality(message||'Follow the instruction above.');
    result((mode==='enroll'?'Enrolling':'Verifying')+' — step '+(step+1)+' of 3');
  }
  function stable(ok,capturedAt,direction=0){
    if(!ok||capturedAt<cueAt){resetHold();return false;}
    if(holdAt===null||holdDirection!==direction){
      holdAt=capturedAt;holdCount=1;holdDirection=direction;
    }else holdCount++;
    return holdCount>=2&&capturedAt-holdAt>=HOLD_MS&&capturedAt-cueAt>=CUE_MS;
  }
  function next(){step++;resetStep('Previous step accepted.');}
  retryStep=()=>{
    if(id===generation&&busy&&performance.now()<deadline){
      resetStep('Retrying this step only. Your earlier steps are kept.');
    }
  };
  resetStep();controls();
  try{
    while(performance.now()<deadline){
      if(performance.now()-cueAt>=STEP_MS){
        resetStep('Still on this step. Retrying automatically — '+lastReason);
      }
      const {data,time,capturedAt}=await freshFrame(id,lastTime);lastTime=time;
      if(performance.now()>=deadline)break;
      // A manual retry may have happened during inference. Ignore that frame.
      if(capturedAt<cueAt)continue;
      const check=frameCheck(data);
      if(!check.ok){
        diagnostics(data);lastReason=check.reason;resetHold();
        collected=[];lastAcceptedAt=0;
        if(data?.face?.length>1){
          identityFailures++;
          if(identityFailures>=2)throw Error('Multiple faces detected. Verification refused; use one person only.');
        }else identityFailures=0;
        quality(lastReason+' Stay on this step.');await sleep(120);continue;
      }
      const f=check.face;
      const own=mode==='verify'?profileMatch(engine,profile,f.embedding):null;
      diagnostics(data,own);
      const continuity=base?matchScore(engine,base,f.embedding):1;
      // A momentary poor match during a turn is not an automatic restart.
      // Two consecutive high-quality mismatches are an identity failure.
      const wrongIdentity=(mode==='verify'&&(own===null||own<LIMITS.similarity))||
        continuity===null||continuity<0.50;
      if(wrongIdentity){
        resetHold();collected=[];lastAcceptedAt=0;identityFailures++;
        lastReason='Face match not confirmed. Face the camera and adjust your position.';
        quality(lastReason);
        if(identityFailures>=2)throw Error('Face does not match the enrolled or original test profile.');
        await sleep(120);continue;
      }
      identityFailures=0;
      const yaw=yawAngle(f);
      el('yaw').textContent=yaw===null?'—':(yaw*180/Math.PI).toFixed(1)+'°';
      if(yaw===null){
        lastReason='Face rotation unavailable. Keep one clear face in view.';
        resetHold();collected=[];lastAcceptedAt=0;quality(lastReason);await sleep(120);continue;
      }
      if(step===0){
        const centered=Math.abs(yaw)<=0.35;
        lastReason=centered?'Hold this natural position briefly.':'Turn your face toward the camera.';
        quality(lastReason);
        if(stable(centered,capturedAt)){
          base=f.embedding.slice();baselineYaw=yaw;next();
        }
      }else if(step===1){
        const delta=yaw-baselineYaw,direction=Math.sign(delta);
        const correct=Math.abs(delta)>=TURN;
        lastReason=correct?'Head turn detected. Hold there briefly.':'Turn a little further to either side.';
        quality(lastReason);
        if(stable(correct,capturedAt,direction))next();
      }else if(step===2){
        const centered=Math.abs(yaw-baselineYaw)<=RETURN;
        if(!centered){
          collected=[];lastAcceptedAt=0;
          lastReason='Return your head to the centre.';
          quality(lastReason);
        }else if(capturedAt-cueAt>=CUE_MS&&capturedAt-lastAcceptedAt>=250){
          collected.push(f.embedding.slice());lastAcceptedAt=capturedAt;
          lastReason='Finishing: '+collected.length+' / '+LIMITS.samples+' valid frames.';
          quality(lastReason);
          if(collected.length===LIMITS.samples){
            assertCurrent(id);
            if(step!==2||!base||performance.now()>=deadline)throw Error('Challenge incomplete or expired.');
            if(mode==='enroll'){
              setProfile(collected);result('TEST PROFILE ENROLLED','pass');
              tell('Done! Select Verify my face.');
            }else{
              result('TEST VERIFIED — SAME FACE','pass');
              tell('Done! Face match, anti-spoofing, liveness and movement checks passed. No real clock event was created.');
            }
            quality('All required checks passed.');
            return;
          }
        }
      }
      await sleep(120);
    }
    throw Error('Test session expired after five minutes. Start a fresh scan for security.');
  }catch(error){
    if(id===generation){
      result('TEST REFUSED — '+(error?.message||String(error)),'fail');
      tell('No verification granted. Retry with the enrolled person and a working camera.');
      quality('');
    }
  }finally{
    if(id===generation){busy=false;retryStep=null;controls();}
    base=null;collected=[];ctx?.clearRect(0,0,canvas.width,canvas.height);
  }
}
el('start').addEventListener('click',()=>void start());
el('enroll').addEventListener('click',()=>void scan('enroll'));
el('verify').addEventListener('click',()=>void scan('verify'));
el('retry').addEventListener('click',()=>retryStep?.());
el('cancel').addEventListener('click',()=>{stopCamera();result('Camera stopped');clearDiagnostics();});
el('clear').addEventListener('click',()=>{setProfile(null);clearDiagnostics();result('Test profile cleared');tell('Enroll again if you want another test.');});
window.addEventListener('pagehide',()=>{stopCamera();setProfile(null);});
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'){stopCamera();result('Camera paused');}});
controls();
