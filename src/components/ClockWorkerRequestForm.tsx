import { useRef, useState, type FormEvent } from 'react';
import { signWorkerRequest, submitWorkerRequest, verifyProductionPin, WorkerRequestRejected } from '../services/productionClockClient';
import { workerLeaveTypes, type WorkerRequest, type WorkerRequestFields } from '../services/clockWorkerRequest';
import type { LeaveType } from '../types';

type Props = {
  kind:'leave'|'advance';
  employeeId:string;
  authorization:Awaited<ReturnType<typeof verifyProductionPin>>|null;
  onClose:()=>void;
  onSaved:(result:{id:string;notified:number})=>void;
};

async function readAttachment(file:File) {
  if (file.size>600*1024) throw new Error('Use a PDF or image attachment up to 600 KB.');
  return new Promise<string>((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result));
    reader.onerror=()=>reject(new Error('Attachment could not be read.'));
    reader.readAsDataURL(file);
  });
}

export function ClockWorkerRequestForm({kind,employeeId,authorization,onClose,onSaved}:Props) {
  const signed=useRef<WorkerRequest|null>(null);
  const inFlight=useRef(false);
  const [busy,setBusy]=useState(false);
  const [retry,setRetry]=useState(false);
  const [error,setError]=useState('');
  const label=kind==='leave'?'Apply for Leave':'Borrow Money';
  const needsPin=!authorization || Date.now()>authorization.until;
  const inputClass='w-full rounded border bg-black p-2';

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current=true;
    setBusy(true);
    setError('');
    const data=new FormData(event.currentTarget);
    try {
      if (!navigator.onLine) throw new Error('Connect to the internet to submit this request.');
      if (!signed.current) {
        const reason=String(data.get('reason')||'').trim();
        if (!reason) throw new Error('Enter a reason.');
        let fields:WorkerRequestFields;
        if (kind==='leave') {
          const file=data.get('attachment');
          fields={kind,reason,leaveType:String(data.get('leaveType')) as LeaveType,startDate:String(data.get('startDate')),endDate:String(data.get('endDate')),
            ...(file instanceof File && file.size ? {attachmentUrl:await readAttachment(file),attachmentName:file.name} : {})};
        } else {
          fields={kind,reason,baseAmount:Number(data.get('amount')),method:data.get('method')==='Immediate Payment'?'Immediate Payment':'Cash',
            months:Number(data.get('months'))};
        }
        const auth=needsPin || !authorization
          ? await verifyProductionPin(employeeId,String(data.get('pin')||''))
          : authorization;
        signed.current=await signWorkerRequest(employeeId,auth,fields);
      }
      onSaved(await submitWorkerRequest(signed.current));
    } catch (problem) {
      if (problem instanceof WorkerRequestRejected) signed.current=null;
      setError(problem instanceof Error?problem.message:'Request could not be confirmed.');
      setRetry(!!signed.current);
    } finally {
      inFlight.current=false;
      setBusy(false);
    }
  }

  return <form onSubmit={submit} className="mt-5 space-y-3 text-left">
    <h3 className="text-xl font-bold">{label}</h3>
    <fieldset disabled={busy || retry} className="space-y-3">
      {kind==='leave'?<>
        <label className="block">Leave type<select name="leaveType" className={inputClass}>{workerLeaveTypes.map(type=><option key={type}>{type}</option>)}</select></label>
        <label className="block">From<input type="date" name="startDate" required className={inputClass}/></label>
        <label className="block">To<input type="date" name="endDate" required className={inputClass}/></label>
        <label className="block">Attachment (optional, up to 600 KB)<input type="file" name="attachment" accept="application/pdf,image/png,image/jpeg,image/webp" className={inputClass}/></label>
      </>:<>
        <label className="block">Amount (R)<input type="number" name="amount" min="0.01" step="0.01" required className={inputClass}/></label>
        <label className="block">Payment method<select name="method" className={inputClass}><option value="Cash">Cash advance</option><option value="Immediate Payment">Immediate payment (EFT, R75 fee)</option></select></label>
        <label className="block">Repayment term<select name="months" className={inputClass}>{[1,2,3].map(month=><option key={month} value={month}>{month} {month===1?'month':'months'}</option>)}</select></label>
      </>}
      <label className="block">Reason<textarea name="reason" required maxLength={500} className={inputClass}/></label>
      {needsPin && <label className="block">Employee PIN<input name="pin" type="password" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} required autoComplete="off" className={inputClass}/></label>}
    </fieldset>
    {error && <p role="alert" className="text-red-300">{error}</p>}
    <button disabled={busy} className="w-full rounded bg-amber-500 p-3 font-bold text-black">{busy?'Submitting…':retry?'Retry same request':'Submit request'}</button>
    <button type="button" disabled={busy} onClick={onClose} className="w-full rounded border p-3">Close</button>
  </form>;
}
