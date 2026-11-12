import React, { useEffect, useRef, useState } from 'react';
import { auth } from '../firebase';
import type { Employee } from '../types';

const MODEL = 'human-3.3.6-faceres';
const env = (import.meta as any).env || {};
// Never activate the existing payroll flow through a browser face result.
export const FACE_INTEGRATION_PREVIEW = env.VITE_TSJ_FACE_INTEGRATION === 'true';

type Props = { employee: Employee; mode: 'manage' | 'verify'; onClose: () => void };
type FaceStatus = { registered: boolean; model: string };

function validSamples(value: unknown): value is number[][] {
  return Array.isArray(value) && value.length === 3 &&
    value.every(sample => Array.isArray(sample) && sample.length === 1024 &&
      sample.every(n => typeof n === 'number' && Number.isFinite(n)));
}

async function request(employeeId:string, action:string, body?:unknown):Promise<any> {
  const user=auth.currentUser;
  if(!user||user.isAnonymous)throw new Error('Sign in with an authorized Firebase account first.');
  const token=await user.getIdToken();
  const base=String(env.VITE_TSJ_FACE_API_BASE_URL||'').replace(/\/+$/,'');
  if(base && !/^https:\/\/[^/]+$/.test(base))throw new Error('Face API requires a configured HTTPS origin.');
  const response=await fetch(base+'/api/face-profiles/'+encodeURIComponent(employeeId)+'/'+action,{
    method:body===undefined?'GET':'POST',
    headers:{Authorization:'Bearer '+token,...(body===undefined?{}:{'Content-Type':'application/json'})},
    body:body===undefined?undefined:JSON.stringify(body),cache:'no-store'
  });
  const payload=await response.json().catch(()=>null);
  if(!response.ok||!payload)throw new Error(payload?.error||'Face profile API unavailable.');
  return payload;
}

export function EmployeeFaceRegistration({employee,mode,onClose}:Props) {
  const [status,setStatus]=useState<FaceStatus|null>(null);
  const [message,setMessage]=useState('Checking registration…');
  const [error,setError]=useState(false);
  const [busy,setBusy]=useState(false);
  const [capture,setCapture]=useState<{nonce:string;intent:'enroll'|'compare'}|null>(null);
  const [matched,setMatched]=useState(false);
  const frame=useRef<HTMLIFrameElement>(null);
  const submitted=useRef(false);
  const alive=useRef(true);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;};},[]);
  useEffect(()=>{
    let cancelled=false;
    setStatus(null);setCapture(null);setMatched(false);setError(false);
    setMessage('Checking registration…');
    request(employee.id,'status').then(result=>{
      if(cancelled)return;
      if(typeof result.registered!=='boolean'||result.model!==MODEL)throw new Error('Invalid face profile status.');
      setStatus(result);setMessage(result.registered?'Face registered.':'Not registered.');
    }).catch(err=>{if(!cancelled){setError(true);setMessage(err.message);}});
    return()=>{cancelled=true;};
  },[employee.id]);
  useEffect(()=>{
    if(!capture)return;
    const handle=async(event:MessageEvent)=>{
      if(event.origin!==window.location.origin||event.source!==frame.current?.contentWindow||
        event.data?.type!=='TSJ_FACE_CAPTURE_COMPLETE'||event.data?.nonce!==capture.nonce||
        event.data?.model!==MODEL||!validSamples(event.data?.samples)||submitted.current)return;
      submitted.current=true;
      setBusy(true);setCapture(null);setError(false);
      setMessage(capture.intent==='enroll'?'Saving protected face profile…':'Checking registered face…');
      try{
        const result=await request(employee.id,capture.intent,{
          model:MODEL,samples:event.data.samples,
          ...(capture.intent==='enroll'?{supervised:true}:{})
        });
        if(!alive.current)return;
        if(capture.intent==='enroll'){
          if(result.registered!==true)throw new Error('Registration was not confirmed.');
          setStatus({registered:true,model:MODEL});
          setMessage('Face registered successfully. Existing photo and PIN unchanged.');
        }else{
          const pass=result.matched===true&&result.preview===true&&result.clockEventCreated===false;
          setMatched(pass);setError(!pass);
          setMessage(pass?'FACE VERIFIED — preview only. No clock event or hours changed.':'FACE NOT VERIFIED — no clock event created.');
        }
      }catch(err){if(alive.current){setError(true);setMessage(err instanceof Error?err.message:'Face service unavailable.');}}
      finally{if(alive.current)setBusy(false);}
    };
    window.addEventListener('message',handle);
    return()=>window.removeEventListener('message',handle);
  },[capture,employee.id]);

  function begin(intent:'enroll'|'compare'){
    if(intent==='enroll'&&mode!=='manage')return;
    if(intent==='enroll'&&!window.confirm('Confirm the named employee is physically present, has been informed about biometric processing, and you are authorized to register their face.'))return;
    submitted.current=false;setMatched(false);setError(false);
    setMessage('Complete the three-step camera scan below.');
    setCapture({nonce:crypto.randomUUID(),intent});
  }
  async function remove(){
    if(mode!=='manage'||!window.confirm('Remove this employee’s registered face? Existing profile photo, PIN and clock history will remain.'))return;
    setBusy(true);setError(false);setMatched(false);
    try{
      await request(employee.id,'remove',{confirm:true});
      if(alive.current){setStatus({registered:false,model:MODEL});setMessage('Face profile removed.');}
    }catch(err){if(alive.current){setError(true);setMessage(err instanceof Error?err.message:'Removal failed.');}}
    finally{if(alive.current)setBusy(false);}
  }
  return (
    <div className="fixed inset-0 z-[2000] bg-black/95 flex items-center justify-center p-3 overflow-y-auto text-white">
      <section className="w-full max-w-xl max-h-[96vh] overflow-y-auto rounded-3xl bg-[#151518] border border-white/15 p-5">
        <header className="flex justify-between items-start gap-3">
          <div>
            <p className="text-[10px] font-bold text-amber-400 uppercase">Controlled preview • no payroll writes</p>
            <h2 className="text-xl font-black">{mode==='manage'?'Face Registration':'Face Verification'}</h2>
            <p className="text-sm text-gray-300">{employee.name} {employee.surname}</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="p-3 bg-white/10 rounded-xl disabled:opacity-40">Close</button>
        </header>
        <p role="status" className={'my-4 p-3 rounded-xl text-sm font-bold '+(error?'bg-red-950 text-red-200':matched?'bg-emerald-950 text-emerald-200':'bg-white/10 text-white')}>{message}</p>
        {!capture&&status&&(
          <div className="flex flex-col gap-2">
            {mode==='manage'&&!status.registered&&<button type="button" disabled={busy} onClick={()=>begin('enroll')} className="bg-[#ff8c00] text-black rounded-xl p-4 font-black">Register Employee Face</button>}
            {status.registered&&<button type="button" disabled={busy} onClick={()=>begin('compare')} className="bg-emerald-700 rounded-xl p-4 font-bold">Verify Face</button>}
            {mode==='manage'&&status.registered&&<button type="button" disabled={busy} onClick={()=>void remove()} className="bg-red-950 rounded-xl p-3 text-sm">Remove Face Registration</button>}
            {mode==='verify'&&!status.registered&&<p className="text-amber-300 text-sm">Ask an authorized supervisor to register this employee. No PIN-only bypass in this preview.</p>}
          </div>
        )}
        {capture&&<div className="space-y-2">
          <iframe key={capture.nonce} ref={frame} title="Local face capture" allow="camera" src={'/face-verification/index.html?embedded=capture&nonce='+capture.nonce} className="w-full h-[72vh] rounded-xl border border-white/10" />
          <button type="button" onClick={()=>{setCapture(null);setMessage('Scan cancelled.');}} className="w-full p-3 rounded-xl bg-white/10">Cancel scan</button>
        </div>}
        <p className="mt-4 text-xs text-gray-400">Only face descriptors are sent to the protected service. Existing photos, PINs and recorded hours are unchanged. This preview cannot approve a real clock event.</p>
      </section>
    </div>
  );
}
