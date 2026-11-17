import React, {useMemo,useState} from 'react';
import {GENERATED_PERMISSION_MODULE_GROUPS} from '../generated/modulePermissionCatalog';

type Device = 'desktop'|'tablet'|'phone'|'terminal';
type Grant = Record<string,Record<string,boolean>>;
type DemoUser={id:string;name:string;email:string;branch:string;active:boolean;devices:Record<Device,boolean>;grants:Grant;notifications:string[]};
const BASE=[
  {category:'SYSTEM',modules:['User Assignments','Roles & Permissions','Branch Management','Company Information']},
  {category:'OPERATIONS',modules:['Clocking','Leave Management','Kanban Designer','Product Master']},
  {category:'PROCUREMENT',modules:['QR Scan Service','Basket','Stock Requests','Purchase Orders','Inventory']},
  {category:'LOGISTICS',modules:['Dispatch Creation','Receiving Inspection','Waybills & Delivery Notes']},
  {category:'REPORTS',modules:['Dashboard','Reports','Exports']},
  {category:'SETTINGS',modules:['Notifications','Email Templates']}
];
const EVENTS=[
  'LEAVE_REQUEST_SUBMITTED','LEAVE_REQUEST_APPROVED','LEAVE_REQUEST_REJECTED',
  'LOW_STOCK','STOCK_REQUEST_SUBMITTED','STOCK_REQUEST_ORDERED','DISPATCH_CREATED',
  'LATE_CLOCK_IN','MISSING_CLOCK_OUT','RECEIVING_DISCREPANCY','BREAK_RETURN',
  'BORROW_MONEY_REQUESTED','BORROW_MONEY_PAID'
];
const ACTIONS=['View','Create','Edit','Delete','Approve','Process','Print','Export'];
const DEVICES:Device[]=['desktop','tablet','phone','terminal'];
const ALL_MODULES=[...BASE.flatMap(group=>group.modules),...GENERATED_PERMISSION_MODULE_GROUPS.flatMap(group=>group.modules)];
const grantAll=():Grant=>Object.fromEntries(ALL_MODULES.map(name=>[name,Object.fromEntries(ACTIONS.map(action=>[action,true]))]));
const grantSome=(names:string[]):Grant=>Object.fromEntries(names.map(name=>[name,{View:true}]));
const initial:DemoUser[]=[
 {id:'demo-master',name:'Demo — Administrator',email:'admin@example.test',branch:'Bloemfontein',active:true,
  devices:{desktop:true,tablet:true,phone:true,terminal:false},grants:grantAll(),notifications:[...EVENTS]},
 {id:'demo-stock',name:'Demo — Stock',email:'stock@example.test',branch:'Brandfort',active:true,
  devices:{desktop:false,tablet:true,phone:false,terminal:false},grants:grantSome(['Kanban Designer','QR Scan Service','Inventory','Stock Requests']),notifications:['LOW_STOCK','STOCK_REQUEST_SUBMITTED']},
 {id:'demo-office',name:'Demo — Office',email:'office@example.test',branch:'Bloemfontein',active:true,
  devices:{desktop:true,tablet:false,phone:true,terminal:false},grants:grantSome(['Leave Management','Dashboard','Notifications']),notifications:['LEAVE_REQUEST_SUBMITTED']}
];
const cap=(s:string)=>s.replace(/_/g,' ').toLowerCase().replace(/\b\w/g,m=>m.toUpperCase());
const check='rounded border border-white/20 accent-orange-500 h-4 w-4';
export default function UserManagementDemo(){
  const [users,setUsers]=useState<DemoUser[]>(initial);
  const [selected,setSelected]=useState(initial[0].id);
  const [device,setDevice]=useState<Device>('phone');
  const [customModules,setCustomModules]=useState<string[]>([]);
  const [moduleDraft,setModuleDraft]=useState('');
  const [tab,setTab]=useState<'permissions'|'notifications'|'device'>('permissions');
  const [notice,setNotice]=useState('');
  const user=users.find(u=>u.id===selected)||users[0];
  const modules=[...ALL_MODULES,...customModules];
  const visible=useMemo(()=>user.active&&user.devices[device]?
    modules.filter(name=>user.grants[name]?.View===true):[],[user,device,customModules]);
  const patch=(changes:Partial<DemoUser>)=>setUsers(prev=>prev.map(u=>u.id===user.id?{...u,...changes}:u));
  const toggleGrant=(mod:string,action:string)=>patch({grants:{...user.grants,
     [mod]:{...user.grants[mod],[action]:!user.grants[mod]?.[action]}}});
  const card='rounded-2xl border border-white/10 bg-[#1b1b1b] p-4';
  const btn='px-3 py-2 rounded-lg border border-white/20 hover:bg-white/10 text-xs font-semibold';
  return <div className="min-h-screen bg-[#101010] text-white p-4 md:p-8 overflow-y-auto" style={{minHeight:'100vh',height:'100vh'}}>
    <div className="max-w-6xl mx-auto space-y-5 pb-16">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><div className="text-[10px] tracking-[0.2em] font-black text-orange-400">TIMBERSMITH · ISOLATED TEST PREVIEW</div>
          <h1 className="text-2xl md:text-3xl font-black mt-1">User, Branch & Permissions</h1>
          <p className="text-sm text-gray-400 mt-1">Fictional local-only test data. No live Firebase users or employee clock records are read or changed.</p></div>
        <button className={btn} onClick={()=>{setUsers(initial);setSelected(initial[0].id);setCustomModules([]);setModuleDraft('');setNotice('Demo reset.')}}>Reset test</button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">
        <div className="space-y-4">
          <div className={card}>
            <div className="text-xs font-black uppercase text-gray-400 mb-2">Selected user</div>
            <div className="flex gap-2 flex-wrap">
              <select value={user.id} onChange={e=>setSelected(e.target.value)} className="bg-[#303030] rounded-lg border border-white/20 p-2 flex-1 min-w-44" aria-label="Select test user">
                {users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
              <button className={btn} onClick={()=>{const id='demo-'+(users.length+1);setUsers(prev=>[...prev,{id,name:'New Test User '+(users.length+1),email:id+'@example.test',branch:'Bloemfontein',active:true,devices:{desktop:false,tablet:false,phone:false,terminal:false},grants:{},notifications:[]}]);setSelected(id)}}>+ Create test user</button>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-4">
              <label className="text-xs text-gray-300">Branch
                <select className="mt-1 w-full bg-[#303030] rounded-lg p-2 text-white border border-white/20" value={user.branch} onChange={e=>patch({branch:e.target.value})}>
                  <option>Bloemfontein</option><option>Brandfort</option>
                </select>
              </label>
              <label className="text-xs text-gray-300">Account status
                <select className="mt-1 w-full bg-[#303030] rounded-lg p-2 text-white border border-white/20" value={user.active?'active':'suspended'} onChange={e=>patch({active:e.target.value==='active'})}>
                  <option value="active">Active</option><option value="suspended">Suspended</option>
                </select>
              </label>
            </div>
            <div className="text-xs text-gray-500 mt-3">{user.email} · Changes apply only to this browser session</div>
          </div>
          <div className={card}>
            <div className="flex gap-2 flex-wrap mb-4">
              {(['permissions','notifications','device'] as const).map(t=><button key={t} onClick={()=>setTab(t)} className={btn+' '+(tab===t?'border-orange-400 text-orange-300':'')}>{cap(t)}</button>)}
            </div>
            {tab==='permissions'&&<div className="space-y-4">
              <div className="text-xs text-gray-400">New modules register in this grid from module manifests. All new grants default to DENY.</div>
              <div className="flex gap-2">
                <input aria-label="Test new module name" value={moduleDraft} onChange={e=>setModuleDraft(e.target.value)} placeholder="Try a new module name" maxLength={60} className="bg-[#303030] border border-white/20 rounded-lg px-3 py-2 flex-1 min-w-0"/>
                <button className={btn} onClick={()=>{const name=moduleDraft.trim();if(!name||modules.includes(name))return;setCustomModules(prev=>[...prev,name]);setModuleDraft('');setNotice(name+' added to the demo permission catalog.')}}>Register demo module</button>
              </div>
              {[...BASE,...GENERATED_PERMISSION_MODULE_GROUPS,...(customModules.length?[{category:'NEW TEST MODULES',modules:customModules}]:[])].map(group=><div key={group.category} className="rounded-xl border border-white/10 overflow-hidden">
                <div className="bg-[#2a2a2a] text-xs font-bold tracking-wide px-3 py-2">{group.category}</div>
                {group.modules.map(mod=><div key={mod} className="px-3 py-3 border-t border-white/10">
                  <div className="text-sm font-semibold mb-2">{mod}</div><div className="flex flex-wrap gap-x-3 gap-y-2">{ACTIONS.map(action=><label key={action} className="inline-flex items-center gap-1 text-[11px] text-gray-300">
                    <input type="checkbox" className={check} checked={user.grants[mod]?.[action]===true} onChange={()=>toggleGrant(mod,action)}/>{action}
                  </label>)}</div></div>)}
              </div>)}
            </div>}
            {tab==='notifications'&&<div className="space-y-2">
              <p className="text-xs text-gray-400">Events are assigned to individual users, not inferred from roles.</p>
              {EVENTS.map(event=><label key={event} className="flex items-center gap-3 text-sm bg-[#252525] rounded-lg p-2">
                <input type="checkbox" className={check} checked={user.notifications.includes(event)} onChange={()=>patch({notifications:user.notifications.includes(event)?user.notifications.filter(v=>v!==event):[...user.notifications,event]})}/>
                {cap(event)}
              </label>)}
            </div>}
            {tab==='device'&&<div className="space-y-3">
              <p className="text-xs text-gray-400">Device access is separate from each module’s View permission.</p>
              {DEVICES.map(d=><label key={d} className="flex justify-between items-center bg-[#252525] rounded-lg p-3 capitalize text-sm">{d}
                <input type="checkbox" className={check} checked={user.devices[d]} onChange={()=>patch({devices:{...user.devices,[d]:!user.devices[d]}})}/>
              </label>)}
            </div>}
          </div>
        </div>
        <div className="space-y-4">
          <div className={card}>
            <div className="text-sm font-black uppercase mb-3">Live device preview</div>
            <div className="flex flex-wrap gap-1 mb-3">{DEVICES.map(d=><button key={d} className={btn+' '+(d===device?'text-orange-300 border-orange-400':'')} onClick={()=>setDevice(d)}>{cap(d)}</button>)}</div>
            <div className="mx-auto max-w-[360px] border-[5px] border-[#3a3a3a] rounded-[28px] overflow-hidden min-h-[420px] bg-black">
              <div className="bg-[#222] p-4 text-center"><div className="text-orange-400 font-black text-sm tracking-widest">TS HUB</div>
                <div className="text-[11px] text-gray-400 mt-1">{user.name} · {user.branch}</div></div>
              {!user.active?<p className="text-red-300 text-sm p-5">Account suspended — no access.</p>:
              !user.devices[device]?<p className="text-red-300 text-sm p-5">{cap(device)} is not authorized for this user.</p>:
              <div className="p-3 space-y-2">{visible.length?visible.map(mod=><div key={mod} className="rounded-lg border border-white/10 bg-[#272727] px-3 py-3 text-xs font-semibold">{mod}</div>):
                <p className="text-yellow-300 text-sm">No permitted modules. Default DENY.</p>}</div>}
            </div>
            <p className="text-[11px] text-gray-400 mt-3">This simulates visibility, not backend data permissions or real camera/PIN clocking.</p>
          </div>
          <div className={card}>
            <div className="text-xs text-gray-400">Notifications assigned: <strong className="text-white">{user.notifications.length}</strong></div>
            <div className="text-xs text-gray-400 mt-1">Viewable modules on {device}: <strong className="text-white">{visible.length}</strong></div>
            <div className="text-xs text-gray-400 mt-1">Branch: <strong className="text-white">{user.branch}</strong></div>
          </div>
        </div>
      </div>
      {notice&&<div role="status" className="fixed bottom-3 left-3 right-3 max-w-lg mx-auto rounded-xl bg-[#3b2d16] border border-orange-500/40 p-3 text-sm">{notice}<button className="float-right text-orange-300" onClick={()=>setNotice('')}>Close</button></div>}
    </div>
  </div>;
}
