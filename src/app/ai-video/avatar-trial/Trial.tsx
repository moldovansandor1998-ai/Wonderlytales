'use client';
import {useEffect,useState} from 'react';
import Link from 'next/link';
import type {AvatarTrial} from '@/lib/ai-video/avatar-trial';
const endpoint='/api/ai-video/post-avatar';
const labels:Record<string,string>={PREPARED:'Előkészítve',SUBMITTING:'Indítás folyamatban',PROCESSING:'Videó készül',UNCERTAIN:'Az indítás eredménye bizonytalan — új kérés nem indul',READY:'Elkészült · ellenőrzésre vár',FAILED:'A próba megállt'};
export default function Trial(){
 const [job,setJob]=useState<AvatarTrial|null>(null),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[error,setError]=useState(''),[price,setPrice]=useState<number|null>(null);
 async function act(action:string){setBusy(true);setError('');try{const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...(action==='start'?{maxCostUsd:.56}:{})})}),d=await r.json();if(!r.ok)throw new Error(d.error??'A kérés sikertelen.');setJob(d.job);if(d.quote)setPrice(d.quote.price);}catch(e){setError(String(e instanceof Error?e.message:e));}finally{setBusy(false);}}
 useEffect(()=>{fetch(endpoint,{cache:'no-store'}).then(async r=>{const d=await r.json();if(!r.ok)throw new Error(d.error??'Betöltési hiba');setJob(d.job);}).catch(e=>setError(e.message)).finally(()=>setLoaded(true));},[]);
 useEffect(()=>{if(job?.status!=='PROCESSING'||busy)return;const t=setTimeout(()=>void act('poll'),10000);return()=>clearTimeout(t);},[job,busy]);
 const media=job?.finalAsset?`/api/ai-video/assets/${job.finalAsset}?type=mp4`:null;
 return <main style={{maxWidth:960,margin:'auto',padding:24}}><Link href="/ai-video">← Vissza a stúdióba</Link><h1>Félix · 5 másodperces beszédpróba</h1><p>A 2. jelenet eredeti záróképéből, Félix meglévő magyar hangjával. Kling Avatar 2.0 Pro · egyszeri próba · legfeljebb 0,56 USD.</p><p>„Hűha! Ez aztán közel volt! Mi folyik itt ma?”</p>
 <p role="status">{job?labels[job.status]:loaded?'A próba még nincs előkészítve.':'Betöltés…'}</p>{error&&<p role="alert">{error}</p>}{job?.error&&<p>{job.error}</p>}
 {loaded&&!job&&<button disabled={busy} onClick={()=>void act('prepare')}>Próba előkészítése</button>}
 {job?.status==='PREPARED'&&<><button disabled={busy} onClick={()=>void act('quote')}>Ár ellenőrzése</button>{price!==null&&<p>Aktuális ár: {price.toFixed(2)} USD</p>}<button disabled={busy||price===null} onClick={()=>void act('start')}>Egyetlen próba indítása · legfeljebb 0,56 USD</button></>}
 {job?.status==='PROCESSING'&&<button disabled={busy} onClick={()=>void act('poll')}>Állapot frissítése</button>}
 {media&&<><video controls playsInline src={media} style={{width:'100%',marginTop:20}}/><p><a href={media} download="WonderlyTales_Felix_Kling_Avatar_5s.mp4">Próbavideó letöltése</a></p><p>A próba a galériában is megmarad. Az eredeti jeleneteket nem cseréli le; a sorozatgyártás nem indul tovább.</p></>}
 </main>;
}
