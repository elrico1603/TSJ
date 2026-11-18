import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {MANAGED_USER_UI,managedUserRequest} from '../services/managedUserClient';
import {permissionService} from '../services/permissionService';

type BranchId='BR-001'|'BR-002';
type EmployeeAssignment={employeeId:string;employeeName:string;branchId:BranchId|null};
const BRANCHES:Record<BranchId,string>={'BR-001':'Brandfort','BR-002':'Bloemfontein'};
const isBranch=(v:unknown):v is BranchId=>v==='BR-001'||v==='BR-002';
interface Props {currentUser?:any;announce?:(message:string)=>void}

/**
 * Self-contained, opt-in managed-user administration screen. Does NOT modify
 * employee documents. Disabled in legacy production mode.
 */
export const ClockingBranchManagement:React.FC<Props>=({currentUser,announce})=>{
  const [employees,setEmployees]=useState<EmployeeAssignment[]>([]);
  const [draft,setDraft]=useState<Record<string,BranchId>>({});
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [initiallyAssigned,setInitiallyAssigned]=useState<number|null>(null);
  const allowed=MANAGED_USER_UI&&
    permissionService.hasPermission(currentUser,'User Assignments','View')&&
    permissionService.hasPermission(currentUser,'User Assignments','Edit');

  const load=useCallback(async()=>{
    if(!allowed)return;
    setLoading(true);setError('');
    try{
      const response=await managedUserRequest('clocking/branches/list',{});
      const rows=(response.employees||[]) as EmployeeAssignment[];
      if(!Array.isArray(rows))throw Error('Invalid employee branch response.');
      setEmployees(rows);
      setInitiallyAssigned(Number(response.assigned)||0);
      setDraft(Object.fromEntries(rows.map(row=>[row.employeeId,isBranch(row.branchId)?row.branchId:'BR-001'])));
    }catch(e){setError(e instanceof Error?e.message:'Unable to load Clocking branches.');}
    finally{setLoading(false);}
  },[allowed]);
  useEffect(()=>{void load();},[load]);
  const unassigned=useMemo(()=>employees.filter(e=>!isBranch(e.branchId)),[employees]);
  const canInitialize=allowed&&!busy&&!loading&&employees.length>0&&
    initiallyAssigned===0&&unassigned.length===employees.length&&
    employees.every(row=>isBranch(draft[row.employeeId]));
  const save=async()=>{
    if(!canInitialize)return;
    if(!window.confirm('Assign all existing employees to their selected branches? This changes ONLY Clocking branch mappings, never shifts or employee records.'))return;
    setBusy(true);setError('');setNotice('');
    try{
      const assignments=employees.map(row=>({
        employeeId:row.employeeId,employeeName:row.employeeName,branchId:draft[row.employeeId]
      }));
      const result=await managedUserRequest('clocking/branches/initialize',{assignments});
      setNotice(String(result.assigned)+' Clocking branch assignments saved.');
      announce?.('Clocking branches saved.');
      await load();
    }catch(e){setError(e instanceof Error?e.message:'Branch assignment failed.');}
    finally{setBusy(false);}
  };
  const transfer=async(row:EmployeeAssignment)=>{
    if(!allowed||busy||!isBranch(row.branchId))return;
    const destination=draft[row.employeeId];
    if(!isBranch(destination)||destination===row.branchId)return;
    if(!window.confirm('Move '+row.employeeName+' from '+BRANCHES[row.branchId]+' to '+BRANCHES[destination]+'? Historical shifts remain unchanged.'))return;
    setBusy(true);setError('');setNotice('');
    try{
      await managedUserRequest('clocking/branches/transfer',{
        employeeId:row.employeeId,expectedBranchId:row.branchId,destinationBranchId:destination
      });
      setNotice(row.employeeName+' moved to '+BRANCHES[destination]+'.');
      announce?.('Clocking branch updated.');
      await load();
    }catch(e){setError(e instanceof Error?e.message:'Branch transfer failed.');}
    finally{setBusy(false);}
  };
  if(!MANAGED_USER_UI)return <p className="text-sm text-gray-400">Clocking branch management is available only after the managed login cutover.</p>;
  if(!allowed)return <p className="text-sm text-red-400">User Assignments View and Edit permissions are required. The server also enforces full administrative access.</p>;
  return <section className="space-y-4 font-sans">
    <header className="border-b border-white/10 pb-4">
      <h2 className="text-xl font-black uppercase tracking-tight text-white">Clocking Employee Branches</h2>
      <p className="text-xs text-gray-400 mt-1">Assign or transfer employees without modifying their clocking history, employee documents or payroll data.</p>
    </header>
    {error&&<div role="alert" className="p-3 rounded-xl border border-red-500/30 text-red-300 text-xs">{error}</div>}
    {notice&&<div role="status" className="p-3 rounded-xl border border-green-500/30 text-green-300 text-xs">{notice}</div>}
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-gray-400">{employees.length} employees · {unassigned.length} unassigned</span>
      <button type="button" disabled={busy||loading} onClick={()=>void load()} className="px-3 py-2 rounded-xl bg-white/10 text-white text-xs disabled:opacity-50">Refresh</button>
    </div>
    {loading&&<p className="text-sm text-gray-400">Loading employee branches…</p>}
    <div className="space-y-2">
      {employees.map(row=><div key={row.employeeId} className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl p-3 bg-black/40 border border-white/10">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-white">{row.employeeName}</p>
          <p className="text-xs text-gray-400">{isBranch(row.branchId)?BRANCHES[row.branchId]:'Not yet assigned'}</p>
        </div>
        <select aria-label={'Branch for '+row.employeeName} disabled={busy||loading}
          value={draft[row.employeeId]||'BR-001'}
          onChange={e=>setDraft(current=>({...current,[row.employeeId]:e.target.value as BranchId}))}
          className="bg-slate-900 border border-white/20 rounded-xl px-3 py-2 text-white text-xs">
          <option value="BR-001">Brandfort</option>
          <option value="BR-002">Bloemfontein</option>
        </select>
        {isBranch(row.branchId)&&<button type="button"
          disabled={busy||loading||draft[row.employeeId]===row.branchId}
          onClick={()=>void transfer(row)}
          className="bg-[#ff8c00] rounded-xl px-4 py-2 font-bold text-black text-xs disabled:opacity-40">Save Branch</button>}
      </div>)}
    </div>
    {initiallyAssigned===0&&employees.length>0&&<div className="space-y-2 border-t border-white/10 pt-4">
      <p className="text-xs text-gray-400">Initial mapping: approve the selected branches once. Existing employee records and shifts are not rewritten.</p>
      <button type="button" disabled={!canInitialize} onClick={()=>void save()}
        className="bg-[#ff8c00] rounded-xl px-4 py-3 font-bold text-black text-xs disabled:opacity-40">Initialize Clocking Branches</button>
    </div>}
  </section>;
};
