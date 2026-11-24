// LUMI: verified Telegram identity -> private Supabase Edge Function -> per-key CAS storage.
const ENDPOINT='https://umdoukuwhnzdywytcmun.supabase.co/functions/v1/lumi-sync';
export const DATA_KEYS=["lumi-items", "lumi-kitchen-plans-v1", "lumi-kitchen-catalog-v1", "lumi-kitchen-shopping-v1", "lumi-sport-groups-v1", "lumi-body-metrics-v1", "lumi-cycle-periods-v1", "lumi-cycle-settings-v1", "lumi-cycle-notes-v1", "lumi-cycle-confirmations-v1", "lumi-habits-v1", "lumi-goals-v1", "lumi-reminder-settings-v1", "lumi60-savings", "lumi60-limits", "lumi60-pantry", "lumi60-recipes", "lumi60-training", "lumi60-sessions", "lumi60-shared", "lumi60-challenges", "lumi60-shopping", "lumi60-programs", "lumi60-shared-drafts"];
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const BACKGROUND_SYNC_MS = 60000;
// Three-way merge: independent edits survive; unchanged records deleted on one device stay deleted.
export function merge(base,local,remote){
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
  const out=Object.create(null);for(const k of new Set([...Object.keys(base&&typeof base==='object'?base:{}),...Object.keys(local),...Object.keys(remote)])){
   const bv=base?.[k],lv=local[k],rv=remote[k];
   if(!Object.hasOwn(local,k)&&equal(rv,bv))continue;
   if(!Object.hasOwn(remote,k)&&equal(lv,bv))continue;
   if(!Object.hasOwn(local,k)){out[k]=rv;continue}if(!Object.hasOwn(remote,k)){out[k]=lv;continue}
   out[k]=merge(bv,lv,rv);
  }return out;
 }
 if (Array.isArray(local) && Array.isArray(remote) &&
     [...local, ...remote, ...(Array.isArray(base) ? base : [])].every(value => typeof value === 'string')) {
  const previous = new Set(Array.isArray(base) ? base : []);
  return [...new Set([...local, ...remote])].filter(value =>
   !previous.has(value) || (local.includes(value) && remote.includes(value)));
 }
 return local==null?remote:local; // simultaneous scalar edit: current device wins
}
export function startCloudSync(initData, userId, onStatus, storage, onChange) {
 const metaKey = `lumi-sync-base-${userId}`;
 const meta = storage.read(metaKey) || {};
 const controller = new AbortController();
 let busy = false;
 let timeout;
 let lastSync = 0;

 async function api(action, changes) {
  const response = await fetch(ENDPOINT, {
   method: 'POST',
   headers: { 'Content-Type': 'application/json' },
   body: JSON.stringify({ initData, action, changes }),
   signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
  });
  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error('Синхронизация недоступна');
  return data;
 }

 async function flush() {
  if (controller.signal.aborted || document.hidden) return;
  if (busy) { schedule(); return; }
  busy = true;
  onStatus('syncing');
  let changed = false;
  try {
   const snapshot = (await api('read')).records;
   if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) throw new Error('Некорректный ответ');
   for (const key of DATA_KEYS) {
    if (controller.signal.aborted) return;
    const reported = Object.hasOwn(snapshot, key);
    if (!reported && meta[key]?.version > 0) continue;
    const remote = reported ? snapshot[key] : { value: null, version: 0 };
    if (!remote || !Number.isInteger(remote.version) || !Object.hasOwn(remote, 'value')) {
     throw new Error('Некорректная версия данных');
    }
    const before = storage.read(key);
    const combined = merge(meta[key]?.value ?? null, before, remote.value);
    let version = remote.version;
    if (!equal(combined, remote.value)) {
     const result = (await api('write', [{ key, value: combined, version }])).results?.[key];
     if (result?.conflict) { schedule(); throw new Error('Обновление версии'); }
     if (!result?.ok) throw new Error('Запись отклонена');
     version = result.version;
    }
    if (controller.signal.aborted) return;
    const current = storage.read(key);
    const next = equal(current, before) ? combined : merge(before, current, combined);
    if (!equal(next, current)) { storage.write(key, next); changed = true; }
    if (!equal(next, combined)) schedule();
    meta[key] = { value: combined, version };
    storage.write(metaKey, meta);
   }
   lastSync = Date.now();
   onStatus('synced');
  } catch {
   if (!controller.signal.aborted) onStatus('error');
  } finally {
   busy = false;
   if (changed && !controller.signal.aborted) onChange();
  }
 }

 function schedule() {
  clearTimeout(timeout);
  timeout = setTimeout(flush, 850);
 }
 function refresh() {
  if (!document.hidden && Date.now() - lastSync > 5000) schedule();
 }
 const interval = setInterval(refresh, BACKGROUND_SYNC_MS);
 window.addEventListener('online', schedule);
 window.addEventListener('focus', refresh);
 document.addEventListener('visibilitychange', refresh);
 flush();

 return {
  schedule,
  stop() {
   controller.abort();
   clearTimeout(timeout);
   clearInterval(interval);
   window.removeEventListener('online', schedule);
   window.removeEventListener('focus', refresh);
   document.removeEventListener('visibilitychange', refresh);
  },
 };
}
