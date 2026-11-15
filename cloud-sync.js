// LUMI: verified Telegram identity -> private Supabase Edge Function -> per-key CAS storage.
const ENDPOINT='https://umdoukuwhnzdywytcmun.supabase.co/functions/v1/lumi-sync';
export const DATA_KEYS=['lumi-items','lumi-kitchen-plans-v1','lumi-kitchen-catalog-v1','lumi-kitchen-shopping-v1','lumi-sport-groups-v1','lumi-body-metrics-v1','lumi-cycle-periods-v1','lumi-cycle-settings-v1','lumi-cycle-notes-v1','lumi-cycle-confirmations-v1'];
const tracked=new Set(DATA_KEYS);
const read=k=>{try{return JSON.parse(localStorage.getItem(k))}catch{return null}};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const empty=x=>x==null||(Array.isArray(x)&&!x.length)||(typeof x==='object'&&!Array.isArray(x)&&!Object.keys(x).length);
let signal=()=>{};
export function persist(key,value){try{localStorage.setItem(key,JSON.stringify(value));if(tracked.has(key))signal()}catch(e){console.warn('LUMI: local save failed',e)}}
// Three-way merge: independent edits survive; unchanged records deleted on one device stay deleted.
function merge(base,local,remote){
 if(equal(local,remote))return local;
 if(equal(local,base))return remote;
 if(equal(remote,base))return local;
 if(Array.isArray(local)&&Array.isArray(remote)&&local.every(x=>x&&typeof x==='object'&&x.id!=null)&&remote.every(x=>x&&typeof x==='object'&&x.id!=null)){
  const b=new Map((Array.isArray(base)?base:[]).filter(x=>x?.id!=null).map(x=>[String(x.id),x]));
  const l=new Map(local.map(x=>[String(x.id),x]));const r=new Map(remote.map(x=>[String(x.id),x]));
  const ids=new Set([...l.keys(),...r.keys(),...b.keys()]);const out=[];
  for(const id of ids){const bv=b.get(id),lv=l.get(id),rv=r.get(id);
   if(!l.has(id)&&b.has(id)&&equal(rv,bv))continue;
   if(!r.has(id)&&b.has(id)&&equal(lv,bv))continue;
   if(!l.has(id)&&!r.has(id))continue;
   if(!l.has(id)&&b.has(id)&&!equal(rv,bv)){out.push(rv);continue}
   if(!r.has(id)&&b.has(id)&&!equal(lv,bv)){out.push(lv);continue}
   if(!l.has(id)){out.push(rv);continue}if(!r.has(id)){out.push(lv);continue}
   out.push(merge(bv,lv,rv));
  }return out;
 }
 if(local&&remote&&typeof local==='object'&&typeof remote==='object'&&!Array.isArray(local)&&!Array.isArray(remote)){
  const out={};for(const k of new Set([...Object.keys(base&&typeof base==='object'?base:{}),...Object.keys(local),...Object.keys(remote)])){
   const bv=base?.[k],lv=local[k],rv=remote[k];
   if(!(k in local)&&equal(rv,bv))continue;
   if(!(k in remote)&&equal(lv,bv))continue;
   if(!(k in local)){out[k]=rv;continue}if(!(k in remote)){out[k]=lv;continue}
   out[k]=merge(bv,lv,rv);
  }return out;
 }
 return local==null?remote:local; // simultaneous scalar edit: current device wins
}
export function startCloudSync(initData,userId,onStatus){
 let active=true,busy=false,ready=false,dirty=false,timeout=null,interval=null;
 const metaKey=`lumi-sync-base-${userId}`;
 let meta=read(metaKey)||{};
 const status=(s)=>{if(active)onStatus(s)};
 const api=async(action,changes)=>{
  const response=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({initData,action,changes})});
  const data=await response.json().catch(()=>({}));
  if(!response.ok||!data.ok)throw Error(data.error||`Ошибка сервера ${response.status}`);
  return data;
 };
 const flush=async()=>{
  if(!active||busy)return;busy=true;status('syncing');let changed=false;
  try{
   const snapshot=(await api('read')).records||{};
   const updates=[];
   for(const key of DATA_KEYS){
    const record=snapshot[key]||{value:null,version:0};const remote=record.value;
    const local=read(key);const previous=meta[key];
    const base=previous?previous.value:null;
    // On a new device, merge existing local records with the cloud, never silently discard them.
    const combined=merge(base,local,remote);
    if(!equal(combined,local)){localStorage.setItem(key,JSON.stringify(combined));changed=true}
    if(!equal(combined,remote))updates.push({key,value:combined,version:record.version});
    else meta[key]={value:remote,version:record.version};
   }
   for(const change of updates){
    let result=await api('write',[change]);let outcome=result.results?.[change.key];
    if(outcome?.conflict){
     // Concurrent edits: merge against the latest server revision and retry.
     const newest=(await api('read')).records?.[change.key]||{value:null,version:0};
     const revised=merge(meta[change.key]?.value,read(change.key),newest.value);
     result=await api('write',[{key:change.key,value:revised,version:newest.version}]);outcome=result.results?.[change.key];
     if(!equal(read(change.key),revised)){localStorage.setItem(change.key,JSON.stringify(revised));changed=true}
    }
    if(!outcome?.ok)throw Error('Конфликт записи '+change.key);
    meta[change.key]={value:read(change.key),version:outcome.version};
   }
   localStorage.setItem(metaKey,JSON.stringify(meta));ready=true;status('synced');
   // React initializes state from localStorage. Rehydrate once after remote changes.
   if(changed&&active){window.location.reload();return}
  }catch(e){console.error('LUMI sync',e);status('error: '+e.message)}
  finally{busy=false;if(dirty&&active){dirty=false;queue()}}
 };
 const queue=()=>{if(!active)return;dirty=true;if(timeout)clearTimeout(timeout);timeout=setTimeout(()=>{dirty=false;flush()},850)};
 signal=()=>{if(ready)queue()};
 flush();interval=setInterval(()=>{if(!busy)flush()},12000);
 const onOnline=()=>queue();window.addEventListener('online',onOnline);
 return()=>{active=false;signal=()=>{};clearInterval(interval);clearTimeout(timeout);window.removeEventListener('online',onOnline)};
}
