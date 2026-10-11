'use client';
import {useEffect,useState} from 'react';
import {AUTO_LABELS,AUTO_ERRORS,postCostCeiling,type AutoRun} from '@/lib/ai-video/automatic-shared';
import type {Language} from '@/lib/ai-video/post-shared';
import type {SceneLine} from '@/lib/ai-video/episode-shared';
import type {postOverview} from '@/lib/ai-video/post';
type View={automatic:Pick<AutoRun,'id'|'phase'|'error'|'videoId'|'finalAsset'>|null;post:Awaited<ReturnType<typeof postOverview>>};
const button='rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 disabled:opacity-40';
export default function AutomaticProduction({id,language,sourceId,dirty,lines,onReady,onNext,playSequence,onEnded}:{id:string;language:Language;sourceId?:string;dirty:boolean;lines:SceneLine[];onReady:()=>unknown;onNext:()=>void;playSequence?:boolean;onEnded?:()=>void}){
 const [view,setView]=useState<View|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let stopped=false,last='';async function load(){try{const r=await fetch(`/api/ai-video/automatic?id=${id}&language=${language}`,{cache:'no-store'});if(!r.ok)return;const data:View=await r.json();if(stopped)return;setView(data);const ready=data.post.current&&data.post.job?.status==='READY'?data.post.job.id:'';if(ready&&ready!==last){last=ready;onReady();}}catch{/* next read retries without submitting */}}void load();const timer=setInterval(()=>{if(document.visibilityState==='visible')void load();},5000);return()=>{stopped=true;clearInterval(timer);};},[id,language,sourceId,onReady]);
 async function action(name:'finish'|'resume'|'approve'){
  setBusy(true);setError('');try{
   const r=await fetch('/api/ai-video/'+(name==='approve'?'post':'automatic'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,language,action:name,...(name==='approve'?{}:{maxPostCostUsd:postCostCeiling(view?.post.lines??lines)})})});
   const data=await r.json();if(!r.ok)throw new Error(AUTO_ERRORS[data.error]??'A feldolgozás nem indult el. Ellenőrizd a mentett állapotot.');
   if(name==='approve'){setView(v=>v?{...v,post:data}:v);onReady();}else setView(v=>v?{...v,automatic:data.automatic}:v);
  }catch(e){setError((e as Error).message);}finally{setBusy(false);}
 }
 const run=view?.automatic&&view.automatic.videoId===sourceId?view.automatic:null;
 const ready=view?.post.current&&view.post.job?.status==='READY'&&view.post.job.finalAsset;
 const active=run&&!['PAUSED','READY'].includes(run.phase);
 if(!sourceId)return null;
 return <section className="space-y-4 rounded-xl border border-amber-500/30 bg-zinc-900/50 p-5" aria-label="Automatikus hangos videó">
  <h3 className="font-semibold">Kész videó · karakterhanggal és szájmozgással</h3>
  {ready?<><video autoPlay={playSequence} onEnded={onEnded} key={ready} className="aspect-video w-full rounded-lg bg-black" controls playsInline preload="metadata" src={'/api/ai-video/assets/'+ready}/><div className="flex flex-wrap gap-3"><a className={button} href={'/api/ai-video/assets/'+ready+'?download=1'} download>Hangos MP4 letöltése</a><button className={button} disabled={busy||dirty||view!.post.approved} onClick={()=>action('approve')}>{view!.post.approved?'Videó jóváhagyva':'A kép és a hang jó · jóváhagyom'}</button>{view!.post.approved&&<button className={button} disabled={dirty} onClick={onNext}>Következő jelenet</button>}</div></>:<>
   <div className="rounded-lg border border-zinc-700 p-5" role="status" aria-live="polite">{run?AUTO_LABELS[run.phase]:'A hangos változat elkészíthető a meglévő videóból.'}{active&&<p className="mt-2 text-sm text-zinc-400">A szereplőfelismerés, a hang, az időzítés és a hangkeverés automatikus. Az oldalt bezárhatod.</p>}</div>
   {run?.phase==='PAUSED'&&<p role="alert" className="text-sm text-amber-200">{AUTO_ERRORS[run.error??'']??'A mentett kérés ellenőrzést igényel. Új fizetős generálás nem indul magától.'}</p>}
   {!active&&<button className={button} disabled={busy||dirty} onClick={()=>action(run?.phase==='PAUSED'?'resume':'finish')}>{run?.phase==='PAUSED'?'Mentett feldolgozás folytatása':'Kész hangos videó elkészítése'} · legfeljebb {postCostCeiling(view?.post.lines??lines).toFixed(2)} USD</button>}
  </>}
  {error&&<p role="alert" className="text-sm text-red-200">{error}</p>}
  <a className="inline-block text-sm text-amber-200 underline" href="/gallery">Minden kép és videó a galériában</a>
 </section>;
}
