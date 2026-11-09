import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
/** In-memory atomic store for management integration fixtures; no SDK/network initialization. */
export class MemoryManagementFirestore {
  records=new Map<string,any>();versions=new Map<string,number>();counter=0;failProjection=false;
  snapshot=(path:string):any=>({id:path.split('/').at(-1),exists:this.records.has(path),
    updateTime:this.records.has(path)?{seconds:0,nanoseconds:this.versions.get(path)||0}:undefined,
    data:()=>structuredClone(this.records.get(path))});
  query=(path:string)=>{
    const docs=[...this.records.keys()].filter(key=>key.startsWith(path+'/')&&key.split('/').length===path.split('/').length+1)
      .sort().map(key=>this.snapshot(key));return {docs,size:docs.length,empty:docs.length===0};
  };
  write=(method:string,path:string,data?:any)=>{
    if(method==='delete'){this.records.delete(path);this.versions.delete(path);return;}
    this.records.set(path,method==='update'?{...this.records.get(path),...structuredClone(data)}:structuredClone(data));this.versions.set(path,++this.counter);
  };
  doc=(path:string):any=>({id:path.split('/').at(-1),path,collection:(name:string)=>this.collection(path+'/'+name),get:async()=>this.snapshot(path),
    set:async(data:any)=>this.write('set',path,data),update:async(data:any)=>this.write('update',path,data),delete:async()=>this.write('delete',path)});
  collection=(path:string):any=>({path,isCollection:true,doc:(id=randomUUID())=>this.doc(path+'/'+id),get:async()=>this.query(path),
    add:async(data:any)=>{const ref=this.doc(path+'/'+randomUUID());await ref.set(data);return ref;}});
  runTransaction=async(fn:any)=>{
    const changes:Array<{method:string;path:string;data?:any}>=[];let writing=false;
    const add=(method:string,ref:any,data?:any)=>{writing=true;changes.push({method,path:ref.path,data:structuredClone(data)});};
    const result=await fn({get:async(ref:any)=>{assert.equal(writing,false,'Firestore reads must precede writes');return ref.isCollection?this.query(ref.path):this.snapshot(ref.path);},
      set:(ref:any,data:any)=>add('set',ref,data),create:(ref:any,data:any)=>{if(this.records.has(ref.path))throw new Error('already exists');add('set',ref,data);},
      update:(ref:any,data:any)=>{if(!this.records.has(ref.path))throw new Error('missing document');add('update',ref,data);},delete:(ref:any)=>add('delete',ref)});
    if(this.failProjection&&changes.some(c=>c.path.includes('/private/users/active/')))throw new Error('Simulated projection outage');
    for(const c of changes)this.write(c.method,c.path,c.data);return result;
  };
}
