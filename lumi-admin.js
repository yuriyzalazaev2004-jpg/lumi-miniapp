const ENDPOINT='https://umdoukuwhnzdywytcmun.supabase.co/functions/v1/lumi-admin';
export async function adminApi(initData,action,payload={}){
 if(!initData)throw Error('Откройте LUMI через Telegram');
 const res=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...payload,initData,action}),signal:AbortSignal.timeout(15000)});
 const data=await res.json().catch(()=>({}));if(!res.ok||!data.ok)throw Error(data.error||`Ошибка сервера ${res.status}`);return data;
}
