'use client';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type {GalleryItem} from '@/lib/ai-video/gallery-shared';
import EpisodeMaster from './EpisodeMaster';
import AutomaticProduction from './AutomaticProduction';
const MediaGallery=dynamic(()=>import('./MediaGallery'),{loading:()=> <p>Galéria betöltése…</p>});
import VideoElements from './VideoElements';
import PostProduction from './PostProduction';
import type {Language} from '@/lib/ai-video/post-shared';
import {useCallback,useEffect,useRef,useState} from 'react';
import {CAST,timecode,type CastKey,type EpisodeOverview,type EpisodeScene,type SceneState} from '@/lib/ai-video/episode-shared';
import {STATUS_LABELS,TERMINAL_STATUSES,type VideoJob} from '@/lib/ai-video/shared';
import {CREATIVE_LABELS} from '@/lib/ai-video/creative-shared';
import {uploadImage,lastFrame} from './client-media';

const button='rounded-lg bg-amber-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40';
const secondary='rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-800 disabled:opacity-40';
const field='w-full rounded-lg border border-zinc-700 bg-zinc-950 p-3 text-sm';
const errors:Record<string,string>={
 SCENE_CHANGED:'A jelenet közben másik ablakban változott. Frissíts, és ellenőrizd a mentett változatot.',
 APPROVE_IMAGE:'Előbb nézd meg és hagyd jóvá a kezdőképet.',
 VIDEO_CHARACTER_REQUIRED:'Előbb rögzítsd a kiválasztott szereplők videóreferenciáit a Karakterreferenciák a videóhoz panelen.',
 TOO_MANY_VIDEO_CHARACTERS:'Ehhez a videóhoz legfeljebb három karakterreferencia választható.',
 SCENE_BREAK_REQUIRED:'Új képhez jelöld meg, hogy itt valóban lezárul a korábbi jelenet.',
 CHARACTER_REFERENCE_MISSING:'Az egyik kiválasztott szereplő referenciaképe hiányzik.',
 PREVIOUS_POST_APPROVAL_REQUIRED:'Előbb hagyd jóvá az előző jelenet szájmozgását és hangkeverését.',
 FINAL_FRAME_REQUIRED:'A forrásnak az előző jóváhagyott videó utolsó képkockájának kell lennie. Vedd át újra.',
 SCENE_VISUAL_REVIEW_REQUIRED:'A hibásnak jelölt jelenetet előbb javítani és képi szempontból ellenőrizni kell.',
 PREVIOUS_VIDEO_REQUIRED:'Ehhez előbb az előző jelenet videójának kell elkészülnie.',
 PREVIOUS_VIDEO_CHANGED:'Az előző jelenet videója megváltozott. Vedd át újra a képkockát.',
 BUDGET_NOT_CONFIGURED:'A képgenerálás költségkerete még nincs beállítva.',
 WAVESPEED_BALANCE_LOW:'A meglévő WaveSpeed-egyenleg kevés ehhez a művelethez.',
 CREATIVE_PRICE_TOO_HIGH:'A kép ára meghaladja a beállított 0,04 USD felső határt.',
 PRICE_CHANGED:'A videó ára változott. Kérj friss árat.',
 JOB_ACTIVE:'A korábbi kérés még fut vagy ellenőrzést igényel. Nem indítunk mellé új fizetős kérést.',
 CHARACTER_VOICE_MISSING:'A szereplőhöz nincs használható magyar karakterhang rendelve.',
 INVALID_INPUT:'Ellenőrizd a mezőket és a vágási időpontokat.',
 VIDEO_EXISTS:'Ehhez a jelenethez már tartozik videó.',
 UNAUTHORIZED:'A bejelentkezés lejárt. Jelentkezz be újra.',
};
async function api<T>(path:string,body?:unknown):Promise<T>{
 const response=await fetch('/api/ai-video'+path,{cache:'no-store',...(body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
 if(!response.headers.get('content-type')?.includes('application/json'))throw new Error('A bejelentkezés vagy a kapcsolat ellenőrzése szükséges.');
 const data=await response.json();if(!response.ok)throw new Error(errors[data.error]??'A művelet nem fejeződött be. Frissítsd az állapotot; a mentett kérésből folytatjuk.');
 return data;
}
function editable(s:SceneState){return {sceneBreak:s.sceneBreak,mode:s.mode,imagePrompt:s.imagePrompt,prompt:s.prompt,characters:s.characters,dialogue:s.dialogue,note:s.note,review:s.review,trimStart:s.trimStart,trimEnd:s.trimEnd,sound:s.sound};}
type Quote={price:number;balance:number};
export default function EpisodeStudio(){
 const [overview,setOverview]=useState<EpisodeOverview|null>(null),[selected,setSelected]=useState(''),[draft,setDraft]=useState<SceneState|null>(null);
 const [busy,setBusy]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[dirty,setDirty]=useState(false),[quote,setQuote]=useState<Quote|null>(null);
 const [language,setLanguage]=useState<Language>('hu'),[languageBusy,setLanguageBusy]=useState('');
 const [galleryOpened,setGalleryOpened]=useState(false);
 const [history,setHistory]=useState<VideoJob[]>([]),[attach,setAttach]=useState('');
 const attempted=useRef(new Set<string>()),lock=useRef(false),player=useRef<HTMLVideoElement>(null),[playlist,setPlaylist]=useState(false);
 const current=overview?.scenes.find(s=>s.state.id===selected),previous=overview?.scenes[(current?.definition.order??0)-1];
 const merge=useCallback((scene:EpisodeScene)=>setOverview(o=>o?{...o,scenes:o.scenes.map(s=>s.state.id===scene.state.id?{...scene,post:s.post}:s)}:o),[]);
 const load=useCallback(async()=>{
  const data=await api<EpisodeOverview>('/episode');setOverview(data);return data;
 },[]);
 useEffect(()=>{void load().then(o=>{const next=o.scenes.find(s=>!s.post?.hu?.approved)||o.scenes[0];setSelected(next.state.id);setDraft(next.state);}).catch(e=>setError(e.message));},[load]);
 function choose(s:EpisodeScene){if(lock.current)return;if(dirty){setError('Mentsd a módosításokat, vagy válaszd a módosítások elvetését.');return;}setSelected(s.state.id);setDraft(s.state);setQuote(null);setError('');setNotice('');setAttach('');setPlaylist(false);}
 function edit(value:Partial<SceneState>){setDraft(d=>d?{...d,...value}:d);setDirty(true);setQuote(null);}
 async function run(action:string,data?:unknown,label='Mentés…'){
  if(lock.current||!current||!draft)return;
  lock.current=true;setBusy(label);setError('');setNotice('');
  try{
   let state=current.state;
   if(dirty){const saved=await api<{scene:EpisodeScene}>('/episode',{id:state.id,action:'save',revision:state.revision,data:editable(draft)});merge(saved.scene);state=saved.scene.state;setDraft(state);setDirty(false);}
   if(action==='save'){await load();setNotice('A jelenet mentve.');return;}
   const result=await api<{scene:EpisodeScene;quote?:Quote}>('/episode',{id:state.id,action,revision:state.revision,data});
   merge(result.scene);setDraft(result.scene.state);if(result.quote)setQuote(result.quote);else setQuote(null);
   if(action==='approve-image')setNotice('A kezdőkép jóváhagyva. A videót a gombbal indíthatod.');
   if(['new-video','attach-video','use-gallery-image','restore-image'].includes(action)){await load();setNotice(action==='new-video'?'A régi változat megőrizve. Az előző jelenet jóváhagyott utolsó képkockájával folytathatsz.':'A megőrzött média hozzárendelve. Ellenőrizd, mielőtt továbbmész.');}
   if(action==='video')setNotice('A videókérés mentve. Az oldalt bezárhatod; ugyanitt folytathatod.');
  }catch(e){setError(e instanceof Error?e.message:'A művelet nem sikerült.');try{const o=await load();const s=o.scenes.find(x=>x.state.id===selected);if(s&&!dirty)setDraft(s.state);}catch{/* keep prior evidence */}}
  finally{setBusy('');lock.current=false;}
 }
 async function useGallery(item:GalleryItem){
  if(!current||!draft)return;
  if(item.kind==='images'&&(draft.mode!=='image'||!draft.sceneBreak))throw new Error('A folytatáshoz az előző videó utolsó képkockáját használd. Galériaképet új beállításnál választhatsz: előbb állítsd át a kezdőkép forrását, és jelöld a tudatos jelenetváltást.');
  await run(item.kind==='images'?'use-gallery-image':'attach-video',item.kind==='images'?{sha256:item.sha256}:{jobId:item.jobId},'Megőrzött média hozzárendelése…');
 }
 const active=(overview?.scenes??[]).filter(s=>s.imageJob?.status==='PROCESSING'||(s.video?.taskId&&!TERMINAL_STATUSES.includes(s.video.status))).map(s=>s.state.id+':'+(s.imageJob?.status==='PROCESSING'?'image-poll':'video-poll')).join(',');
 useEffect(()=>{
  if(!active)return;
  let stopped=false;
  const tick=async()=>{if(document.visibilityState!=='visible'||lock.current)return;const results=await Promise.allSettled(active.split(',').map(async x=>{const [id,action]=x.split(':');return api<{scene:EpisodeScene}>('/episode',{id,action});}));if(stopped)return;for(const r of results)if(r.status==='fulfilled'){merge(r.value.scene);if(r.value.scene.state.id===selected&&!dirty)setDraft(r.value.scene.state);}else setError(r.reason instanceof Error?r.reason.message:'Állapotfrissítés szükséges.');};
  const timer=setInterval(()=>{void tick();},10000);return()=>{stopped=true;clearInterval(timer);};
 },[active,merge,selected,dirty]);
 async function frame(){
  if(lock.current||!previous?.video||!current||!draft)return;
  lock.current=true;setBusy('Az előző videó utolsó képkockájának átvétele…');setError('');
  try{
   let state=current.state;
   if(dirty){const r=await api<{scene:EpisodeScene}>('/episode',{id:state.id,action:'save',revision:state.revision,data:editable(draft)});merge(r.scene);state=r.scene.state;setDirty(false);}
   const asset=previous.post?.hu?.finalAsset;if(!previous.post?.hu?.approved||!asset)throw new Error('Előbb hagyd jóvá az előző jelenet hangos változatát.');
   const got=await lastFrame('/api/ai-video/assets/'+asset);
   const image=await uploadImage(got.file);
   const r=await api<{scene:EpisodeScene}>('/episode',{id:state.id,action:'frame',revision:state.revision,data:{sha256:image.sha256,sourceJobId:previous.video.id,sourceAsset:previous.post!.hu!.finalAsset,sourceTime:got.time}});
   merge(r.scene);setDraft(r.scene.state);setQuote(null);setNotice('A képkocka mentve. Ellenőrizd az arcot, a mozdulatot és a képkivágást, majd hagyd jóvá.');
  }catch(e){setError(e instanceof Error?e.message:'Nem sikerült átvenni a képkockát.');}
  finally{lock.current=false;setBusy('');}
 }
 useEffect(()=>{
  const key=selected+':'+previous?.post?.hu?.finalAsset;
  if(!current||!draft||draft.mode!=='last-frame'||draft.imageSha256||current.video||!previous?.post?.hu?.approved||dirty||busy||lock.current||attempted.current.has(key))return;
  attempted.current.add(key);void frame();
  // Only free frame extraction, never paid image/video generation on scene open.
  // eslint-disable-next-line react-hooks/exhaustive-deps
 },[selected,previous?.post?.hu?.approved,previous?.post?.hu?.finalAsset,draft?.mode,draft?.imageSha256,dirty,busy]);
 async function analyze(){
  if(!current?.video||lock.current)return;lock.current=true;setBusy('A videó képi elemzése…');setError('');
  try{await api('/jobs/'+current.video.id+'/analysis',{});const o=await load();const row=o.scenes.find(s=>s.state.id===selected);if(row&&!dirty)setDraft(row.state);}
  catch(e){setError(e instanceof Error?e.message:'Az elemzés nem sikerült.');}finally{lock.current=false;setBusy('');}
 }
 async function pollAnalysis(){if(!current?.analysis)return;try{await api('/creative/analysis/'+current.analysis.id,{});await load();}catch(e){setError(e instanceof Error?e.message:'Frissítés nem sikerült.');}}
 function playNext(){if(!playlist||!overview||!current)return;const next=overview.scenes[current.definition.order+1];if(!next?.video||next.video.status!=='COMPLETED'){setPlaylist(false);setNotice(next?'Itt még hiányzik a következő videó. A lejátszás megállt.':'Az elkészült jelenetsor véget ért.');return;}setSelected(next.state.id);setDraft(next.state);setQuote(null);}
 useEffect(()=>{if(playlist&&player.current)void player.current.play().catch(()=>setNotice('Nyomd meg a videó lejátszás gombját.'));},[selected,playlist]);
 if(!overview||!current||!draft)return <section className="rounded-xl border border-zinc-800 p-6"><p role="status">{error||'Az első rész jeleneteinek betöltése…'}</p>{error&&<button className={secondary} onClick={()=>location.reload()}>Újratöltés</button>}</section>;
 const completed=overview.scenes.filter(s=>s.video?.status==='COMPLETED').length;
 const ready=overview.scenes.filter(s=>s.post?.[language]?.approved).length;
 const previousApproved=!previous||previous.post?.hu?.approved;
 const imageActive=current.imageJob&&['PROCESSING','SUBMITTING','UNCERTAIN'].includes(current.imageJob.status);
 const videoActive=current.video&&['SUBMITTING','RUNNING','QUEUED','SUBMISSION_UNCERTAIN'].includes(current.video.status);
 return <div className="space-y-5">
  <section className="rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-950/40 to-zinc-900 p-5 md:p-7">
   <p className="text-xs font-semibold uppercase tracking-[.2em] text-amber-300">WonderlyTales · epizódműhely</p>
   <h2 className="mt-2 text-2xl font-bold md:text-3xl">1. rész – A rossz kanyar</h2>
   <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-300">10 perces rész · 58 folytatható történeti szakasz + főcím és lezárás. Alapesetben az előző jóváhagyott videó utolsó képkockájából folytatunk, a szereplők rögzített videóreferenciáival. Az automatikus gyártás elkészíti a hangot, időzíti a párbeszédet és illeszti a szájmozgást. Akár 10 jelenet készülhet egymás után, majd átnézheted az eredményt.</p>
   <div className="mt-5 grid grid-cols-3 gap-3"><div><strong className="text-2xl">{completed}/60</strong><p className="text-xs text-zinc-400">elkészült videó</p></div><div><strong className="text-2xl">{ready}</strong><p className="text-xs text-zinc-400">hanggal jóváhagyva · {language.toUpperCase()}</p></div><div><strong className="text-2xl">10:00</strong><p className="text-xs text-zinc-400">tervezett filmhossz</p></div></div>
   <div className="mt-4 flex flex-wrap items-center gap-3"><label className="text-sm">Kiadás nyelve<select aria-label="Kiadás nyelve" className={field+' mt-1'} value={language} onChange={e=>setLanguage(e.target.value as Language)}><option value="hu">Magyar</option><option value="en">English</option></select></label><button className={secondary} disabled={!!languageBusy||dirty} onClick={async()=>{setLanguageBusy('Angol jelenetszövegek előkészítése…');setError('');try{for(const scene of overview.scenes){const r=await fetch('/api/ai-video/post',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:scene.state.id,language:'en',action:'english'})});if(!r.ok)throw new Error('A '+scene.definition.order+'. jelenet magyar szövege változott; az angol fordítást ehhez kell igazítani.');}setLanguage('en');setNotice('Az egész rész angol szövege előkészítve. Jelenetenként ellenőrizd, majd készítsd el a hangot.');await load();}catch(e){setError((e as Error).message);}finally{setLanguageBusy('');}}}>Teljes rész angol változatának előkészítése</button>{languageBusy&&<p role="status" className="text-sm">{languageBusy}</p>}</div>
   <EpisodeMaster language={language} approved={ready}/>
   <div className="mt-4 h-1.5 rounded bg-zinc-800"><div className="h-full rounded bg-amber-400" style={{width:completed/60*100+'%'}}/></div>
   <div className="mt-5 flex flex-wrap gap-3"><Link className={secondary} href="/ai-video/gallery">Minden kép és videó · Galéria</Link><a className={secondary} href="/api/ai-video/episode?export=1" download>Vágási terv és forráslista letöltése</a><button className={secondary} disabled={!!busy||dirty} onClick={()=>{setError('');void load().then(o=>{setDraft(o.scenes.find(s=>s.state.id===selected)!.state);}).catch(e=>setError(e.message));}}>Állapotok frissítése</button><button className={secondary} disabled={!!busy||dirty||!overview.scenes[0].video} onClick={()=>{setSelected(overview.scenes[0].state.id);setDraft(overview.scenes[0].state);setPlaylist(true);}}>Jelenetsor lejátszása</button></div>
   <p className="mt-4 text-sm text-sky-200">Új kép nem készül automatikusan. Az utolsó képkocka átvétele díjmentes; a fizetős videót mindig te indítod.</p>
   <button className={secondary+' mt-3'} disabled={!!busy||dirty} onClick={async()=>{if(lock.current)return;lock.current=true;setBusy('A hátralévő jelenetek folyamatos tervének mentése…');setError('');try{await api('/episode/continuity',{});const o=await load();setDraft(o.scenes.find(s=>s.state.id===selected)!.state);setNotice('A hátralévő jelenetek folyamatos terve mentve. A kész videók és a korábbi képek megmaradtak.');}catch(e){setError((e as Error).message);}finally{setBusy('');lock.current=false;}}}>Folyamatos terv alkalmazása a hátralévő jelenetekre</button>

  </section>
  <details className="rounded-xl border border-zinc-800 p-4"><summary className="cursor-pointer font-semibold">Az öt jóváhagyott karakter és hangja</summary><div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-5">{(Object.keys(CAST) as CastKey[]).map(k=><div key={k} className="rounded-lg bg-zinc-900 p-2">{overview.cast[k].sha256&&<a href={'/api/ai-video/image?sha256='+overview.cast[k].sha256} target="_blank" rel="noreferrer"><img loading="lazy" className="aspect-video w-full rounded object-contain" src={'/api/ai-video/image?sha256='+overview.cast[k].sha256} alt={CAST[k].name+' referencialap'}/></a>}<p className="mt-2 font-medium">{CAST[k].name}</p><p className="text-xs text-zinc-400">{CAST[k].description}</p><p className="mt-1 text-xs text-amber-300">Hang: {CAST[k].voiceName}</p></div>)}</div></details>
  <VideoElements/>
  {error&&<p role="alert" className="rounded-lg border border-red-800 bg-red-950/40 p-4 text-red-200">{error}</p>}
  {notice&&<p role="status" className="rounded-lg border border-emerald-900 p-4 text-emerald-200">{notice}</p>}
  {busy&&<p role="status" aria-live="polite" className="text-amber-300">{busy}</p>}
  <div className="grid items-start gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
   <nav aria-label="Az első rész jelenetei" className="max-h-64 overflow-auto rounded-xl border border-zinc-800 lg:sticky lg:top-4 lg:max-h-[80vh]">
    {overview.scenes.map(s=><button key={s.state.id} disabled={!!busy} onClick={()=>choose(s)} aria-current={s.state.id===selected?'step':undefined} className={'flex w-full gap-3 border-b border-zinc-800/70 p-3 text-left text-sm '+(s.state.id===selected?'bg-amber-400/15 text-amber-200':'hover:bg-zinc-900')}>
     <span className="pt-0.5 text-xs tabular-nums text-zinc-500">{timecode(s.definition.order*10)}</span><span className="min-w-0 flex-1"><span className="block font-medium">{s.definition.order===0?'Főcím':s.definition.order===59?'Befejezés':String(s.definition.order).padStart(2,'0')+'. '+s.definition.title}</span><span className="mt-1 block text-xs text-zinc-400">{s.video?STATUS_LABELS[s.video.status]:s.imageJob?CREATIVE_LABELS[s.imageJob.status]:s.state.imageSha256?'Kezdőkép kész':'Tervezett jelenet'}</span></span>{s.post?.[language]?.approved&&<span aria-label="hanggal jóváhagyva">✓</span>}
    </button>)}
   </nav>
   <div className="min-w-0 space-y-5">
    {language==='hu'&&<AutomaticProduction overview={overview} selected={selected} dirty={dirty} onUpdated={async()=>{const o=await load();const next=o.scenes.find(s=>s.state.id===selected);if(next&&!dirty)setDraft(next.state);}}/>}
    <details className="rounded-xl border border-zinc-800 p-4"><summary className="cursor-pointer font-semibold">Részletes beállítások, forgatókönyv és javítás</summary><div className="mt-5 space-y-5">
    <section className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 md:p-5"><p className="text-xs uppercase tracking-wider text-amber-300">{current.definition.act} · {timecode(current.definition.order*10)}–{timecode((current.definition.order+1)*10)}</p><h3 className="mt-1 text-xl font-bold">{current.definition.title}</h3><p className="mt-2 text-sm text-zinc-400">{current.definition.location}</p>
     <fieldset disabled={!!busy} className="mt-5 space-y-4">
      <label className="block text-sm font-medium">Kezdőkép forrása<select className={field+' mt-2'} value={draft.mode} onChange={e=>edit({mode:e.target.value as SceneState['mode'],sceneBreak:false})}><option value="last-frame">Előző videó utolsó képkockája · alapértelmezett</option><option value="image">Új beállítás · lezárt jelenet után</option></select></label>
      {draft.mode==='image'&&<label className="flex items-start gap-2 text-sm text-amber-200"><input type="checkbox" className="!w-4 shrink-0" checked={!!draft.sceneBreak} onChange={e=>edit({sceneBreak:e.target.checked})}/>Tudatos jelenetváltás: lezárult az előző helyzet, ezért indokolt új kezdőkép.</label>}
      {draft.mode==='last-frame'&&<div className="rounded-lg border border-sky-900 p-3"><p className="mb-3 text-sm text-zinc-300">{previous?.video?.status==='COMPLETED'?'Az előző jóváhagyott, hangos videó utolsó képkockáját vesszük át. A kép ellenőrzése után indítható a folytatás.':'Előbb az előző jelenet videójának kell elkészülnie.'}</p><button className={secondary} disabled={!previous?.post?.hu?.approved} onClick={frame}>Utolsó képkocka átvétele</button></div>}
      <div><p className="mb-2 text-sm font-medium">Szereplők a képen · legfeljebb 3 videóreferencia</p><div className="flex flex-wrap gap-2">{(Object.keys(CAST) as CastKey[]).map(k=><label key={k} className={'flex cursor-pointer items-center gap-2 rounded-full border px-3 py-2 text-sm '+(draft.characters.includes(k)?'border-amber-500/60 bg-amber-400/10':'border-zinc-700')}><input type="checkbox" className="!w-4 shrink-0" checked={draft.characters.includes(k)} disabled={!draft.characters.includes(k)&&draft.characters.length>=3} onChange={e=>edit({characters:e.target.checked?[...draft.characters,k]:draft.characters.filter(x=>x!==k)})}/>{CAST[k].name}</label>)}</div></div>
      {draft.characters.length>0&&<div className="grid grid-cols-3 gap-2">{draft.characters.map(k=><div key={k} className="rounded border border-zinc-700 p-2">{overview.cast[k].sha256&&<img loading="lazy" className="aspect-video w-full object-contain" src={'/api/ai-video/image?sha256='+overview.cast[k].sha256} alt={CAST[k].name+' ellenőrző referencia'}/>}<p className="text-xs">{CAST[k].name} · ehhez hasonlítsd az arcot és a ruhát</p></div>)}</div>}
      {draft.review==='needs-work'&&<p className="rounded-lg border border-amber-600/50 bg-amber-950/30 p-3 text-sm text-amber-200">Ellenőrzést / javítást igényel: {draft.note}</p>}
      {draft.imageSha256?<img className="aspect-video w-full rounded-lg bg-zinc-950 object-contain" src={'/api/ai-video/image?sha256='+draft.imageSha256} alt={current.definition.title+' kezdőképe'}/>:<div className="flex aspect-video items-center justify-center rounded-lg border border-dashed border-zinc-700 p-6 text-center text-zinc-400">{current.imageJob?CREATIVE_LABELS[current.imageJob.status]:'A jelenet kezdőképe itt jelenik meg.'}</div>}
      <div className="flex flex-wrap gap-2">{draft.mode==='image'&&current.definition.kind!=='intro'&&<button className={secondary} disabled={!draft.sceneBreak||!previousApproved||!!imageActive&&!!current.imageJob?.taskId} onClick={()=>run('image',{force:!!draft.imageSha256||!!current.imageJob&&['FAILED','BLOCKED_BUDGET'].includes(current.imageJob.status)},'Kezdőkép kérése…')}>{draft.imageSha256?'Új képváltozat · legfeljebb 0,04 USD':'Kezdőkép készítése / kérés folytatása'}</button>}{draft.imageJobId&&<button className={secondary} onClick={()=>run('image-poll',undefined,'Kép állapotának frissítése…')}>Kép állapota</button>}{draft.imageSha256&&<button className={button} disabled={draft.imageApproved&&!dirty} onClick={()=>run('approve-image')}>{draft.imageApproved?'Kezdőkép jóváhagyva':'Az arcok és a képkocka jó · jóváhagyom'}</button>}</div>
      <details><summary className="cursor-pointer text-sm text-zinc-300">A kezdőkép promptja</summary><textarea aria-label="Kezdőkép promptja" className={field+' mt-2 min-h-36'} maxLength={2000} value={draft.imagePrompt} onChange={e=>edit({imagePrompt:e.target.value})}/></details>
      {draft.imageHistory.length>0&&<details><summary className="cursor-pointer text-sm text-zinc-400">Korábbi képek megőrizve ({draft.imageHistory.length})</summary><div className="mt-2 grid grid-cols-3 gap-2">{draft.imageHistory.map(sha=><div key={sha}><a href={'/api/ai-video/image?sha256='+sha} target="_blank" rel="noreferrer"><img loading="lazy" className="rounded" src={'/api/ai-video/image?sha256='+sha} alt="Korábbi megőrzött kezdőkép"/></a><button className={secondary+' mt-2'} disabled={!!imageActive||sha===draft.imageSha256||draft.mode!=='image'||!draft.sceneBreak} onClick={()=>run('restore-image',{sha256:sha})}>Régi kép új beállításhoz</button></div>)}</div></details>}
     </fieldset>
    </section>
    <section className="rounded-xl border border-zinc-800 p-4 md:p-5"><h3 className="font-semibold">Jelenet promptja és videó</h3>{current.definition.beats&&<div className="mt-3 space-y-2 rounded-lg bg-sky-950/30 p-3 text-sm"><p className="font-semibold text-sky-200">Mi történik ebben a 10 másodpercben?</p><p><b>0–2 mp ·</b> {current.definition.beats.start}</p><p><b>2–8 mp ·</b> {current.definition.beats.event}</p><p><b>8–10 mp ·</b> {current.definition.beats.handoff}</p><p className="text-xs text-zinc-400">A ténylegesen elkészült előző videóhoz igazítsd a promptot; a hibás karaktert ne vidd tovább.</p></div>}{!previousApproved&&previous&&<div role="status" className="mt-3 space-y-3 rounded-lg border border-amber-800 p-3 text-sm text-amber-200"><p>A videóindítás ehhez vár: <strong>{previous.definition.title}</strong> — {previous.state.review==='needs-work'?'az előző videó javításra van jelölve':previous.video?.status!=='COMPLETED'?'még nincs kész az előző videó':'a hangos, szájmozgással elkészült változat jóváhagyása hiányzik'}.</p><button className={secondary} disabled={!!busy||dirty} onClick={()=>choose(previous)}>Előző jelenet megnyitása · utómunka és jóváhagyás</button>{dirty&&<p>Előbb mentsd a jelenet módosításait.</p>}</div>}<fieldset disabled={!!busy} className="mt-3 space-y-3"><textarea aria-label="Jelenet promptja" className={field+' min-h-48'} maxLength={2200} value={draft.prompt} onChange={e=>edit({prompt:e.target.value})}/><label className="flex gap-2 text-sm"><input type="checkbox" className="!w-4 shrink-0" checked={draft.sound} onChange={e=>edit({sound:e.target.checked})}/>Környezeti hang és hangeffektek a videóhoz</label>
     {current.video&&<><video ref={player} key={current.video.id} className="w-full rounded-lg bg-black" controls playsInline preload="metadata" src={current.video.status==='COMPLETED'?'/api/ai-video/jobs/'+current.video.id+'/media':undefined} onEnded={playNext}/><p className="text-sm text-amber-200">{STATUS_LABELS[current.video.status]}</p>{current.video.error&&<p className="text-sm text-red-200">{current.video.error}</p>}</>}
     {quote&&<p className="rounded-lg bg-zinc-900 p-3 text-sm">10 mp aktuális ára: <strong>{quote.price.toFixed(3)} USD</strong> · Egyenleg: {quote.balance.toFixed(2)} USD</p>}
     <div className="flex flex-wrap gap-2">{!current.state.videoJobId&&current.definition.kind!=='intro'&&<><button className={secondary} disabled={!draft.imageApproved||!previousApproved} onClick={()=>run('quote',{},'Videó árának lekérése…')}>Videó árának ellenőrzése</button><button className={button} disabled={!quote||!draft.imageApproved||quote.balance<quote.price||!previousApproved} onClick={()=>run('video',{maxCostUsd:quote!.price},'10 mp videó indítása…')}>10 mp videó generálása</button></>}{current.state.videoJobId&&<button className={secondary} onClick={()=>run(current.video?'video-poll':'video',{},'Mentett videókérés ellenőrzése…')}>Videó állapotának frissítése</button>}{current.video?.status==='COMPLETED'&&<a className={secondary} href={'/api/ai-video/jobs/'+current.video.id+'/media'} target="_blank" rel="noreferrer">MP4 megnyitása</a>}</div>
     {current.state.videoJobId&&current.definition.kind!=='intro'&&!videoActive&&<details><summary className="cursor-pointer text-sm text-zinc-400">Másik változat készítése</summary><p className="my-2 text-xs text-zinc-400">A jelenlegi klip és kezdőkép megmarad a galériában. A történet új változata ismét az előző jóváhagyott videó utolsó képkockájából indul. Előbb képkocka-ellenőrzés, majd árlekérés és külön indítás következik.</p><button className={secondary} onClick={()=>run('new-video')}>Új videóváltozat előkészítése</button></details>}
     <details><summary className="cursor-pointer text-sm text-zinc-400">Meglévő videó hozzárendelése</summary><button className={secondary+' mt-2'} onClick={()=>{void api<{jobs:VideoJob[]}>('/jobs').then(r=>setHistory(r.jobs.filter(j=>j.status==='COMPLETED'))).catch(e=>setError(e.message));}}>Előzmények betöltése</button><select aria-label="Meglévő videó" className={field+' mt-2'} value={attach} onChange={e=>setAttach(e.target.value)}><option value="">Válassz videót</option>{[...new Set([...draft.videoHistory,...history.map(j=>j.id)])].map(id=><option value={id} key={id}>{history.find(j=>j.id===id)?.createdAt.slice(0,16)??'Korábbi változat'} · {id.slice(0,8)}</option>)}</select><button className={secondary+' mt-2'} disabled={!attach} onClick={()=>run('attach-video',{jobId:attach})}>Ezt használom</button></details>
    </fieldset></section>
    <details className="rounded-xl border border-zinc-800 p-4" onToggle={e=>{if(e.currentTarget.open)setGalleryOpened(true);}}><summary className="cursor-pointer font-semibold">Galéria · megőrzött képek és videók újrahasználata</summary>{galleryOpened&&<div className="mt-4"><MediaGallery onUse={useGallery} disabled={!!busy||current.definition.kind==='intro'}/></div>}</details>
    <section className="rounded-xl border border-zinc-800 p-4 md:p-5"><h3 className="font-semibold">Magyar párbeszéd · rögzített karakterhangok</h3><p className="mt-2 text-sm leading-6 text-zinc-400">Itt szerkesztheted a magyar szöveget és az időzítést. A videó után az alábbi utómunkapanel készíti el a karakterhangot, a szájmozgást és a végleges hangos videót.</p>
     <fieldset disabled={!!busy} className="mt-4 space-y-4">{draft.dialogue.map((l,i)=>{const rec=current.recordings[String(i)];return <div key={i} className="rounded-lg bg-zinc-900 p-3"><div className="grid gap-2 sm:grid-cols-3"><select aria-label={'Beszélő '+(i+1)} className={field} value={l.character} onChange={e=>edit({dialogue:draft.dialogue.map((x,j)=>i===j?{...x,character:e.target.value as CastKey}:x)})}>{(Object.keys(CAST) as CastKey[]).map(k=><option key={k} value={k}>{CAST[k].name} · {CAST[k].voiceName}</option>)}</select><label className="text-xs text-zinc-400">Kezdés a jeleneten belül (mp)<input aria-label={'Beszéd kezdése '+(i+1)} type="number" step=".1" min="0" max="9.5" className={field} value={l.offset} onChange={e=>edit({dialogue:draft.dialogue.map((x,j)=>i===j?{...x,offset:Number(e.target.value)}:x)})}/></label><select aria-label={'Beszéd módja '+(i+1)} className={field} value={l.delivery} onChange={e=>edit({dialogue:draft.dialogue.map((x,j)=>i===j?{...x,delivery:e.target.value as 'visible'|'offscreen'}:x)})}><option value="visible">Látható beszélő · szájmozgás kell</option><option value="offscreen">Képen kívüli beszéd</option></select></div><textarea aria-label={'Párbeszéd '+(i+1)} className={field+' mt-2'} maxLength={250} value={l.text} onChange={e=>edit({dialogue:draft.dialogue.map((x,j)=>i===j?{...x,text:e.target.value}:x)})}/><div className="mt-2 flex flex-wrap gap-2"><p className="text-xs text-sky-300">Az új karakterhangot a lenti Utómunka panelen készítheted el.</p><button className={secondary} onClick={()=>edit({dialogue:draft.dialogue.filter((_,j)=>i!==j)})}>Sor eltávolítása</button></div>{rec&&<p className="mt-2 text-xs text-zinc-400">{rec.status==='COMPLETED'?'Elkészült':rec.status==='UNCERTAIN'?'Bizonytalan kérés; nincs automatikus újrafizetés':rec.status==='FAILED'?'Nem készült el':'Feldolgozás'}</p>}{rec?.status==='COMPLETED'&&<><audio className="mt-3 w-full" controls src={'/api/ai-video/dialogue/'+rec.id}/>{(rec.duration??0)+l.offset>10&&<p className="mt-2 text-sm text-amber-200">A beszéd túlnyúlik a jeleneten. Hozd előrébb vagy rövidítsd a szöveget; a végső vágásban is igazítható.</p>}</>}</div>;})}
     {!draft.dialogue.length&&<p className="text-sm text-zinc-400">Ehhez a beállításhoz nincs tervezett megszólalás.</p>}
     <button className={secondary} disabled={draft.dialogue.length>=3} onClick={()=>edit({dialogue:[...draft.dialogue,{character:'felix',text:'Új megszólalás',offset:1,delivery:'visible'}]})}>Párbeszédsor hozzáadása</button></fieldset>
    </section>
    <PostProduction key={selected+language} id={selected} language={language} sourceRevision={current.state.revision} hasVideo={current.video?.status==='COMPLETED'} dirty={dirty} onApproved={load} onNext={()=>{const next=overview.scenes[current.definition.order+1];if(next)choose(next);}}/>
    <section className="rounded-xl border border-zinc-800 p-4 md:p-5"><h3 className="font-semibold">Folytonosság és vágási megjegyzés</h3><fieldset disabled={!!busy} className="mt-3 space-y-3"><textarea aria-label="Folytonossági megjegyzés" className={field+' min-h-28'} maxLength={2000} value={draft.note} onChange={e=>edit({note:e.target.value})}/><div className="grid gap-3 sm:grid-cols-3"><label className="text-sm">Értékelés<select className={field+' mt-1'} value={draft.review} onChange={e=>edit({review:e.target.value as SceneState['review']})}><option value="pending">Ellenőrzésre vár</option><option value="keep">Megtartjuk</option><option value="trim">Vágással használható</option><option value="needs-work">Illesztést / javítást igényel</option></select></label><label className="text-sm">Használt rész eleje (mp)<input className={field+' mt-1'} type="number" min="0" max="9.9" step=".1" value={draft.trimStart} onChange={e=>edit({trimStart:Number(e.target.value)})}/></label><label className="text-sm">Használt rész vége (mp)<input className={field+' mt-1'} type="number" min=".1" max="10" step=".1" value={draft.trimEnd} onChange={e=>edit({trimEnd:Number(e.target.value)})}/></label></div><div className="flex flex-wrap gap-2"><button className={button} disabled={!dirty} onClick={()=>run('save')}>Módosítások mentése</button>{dirty&&<button className={secondary} onClick={()=>{setDraft(current.state);setDirty(false);setQuote(null);}}>Módosítások elvetése</button>}<button className={secondary} disabled={current.video?.status!=='COMPLETED'||dirty} onClick={analyze}>AI képi elemzés · legfeljebb 0,02 USD</button></div>{current.analysis&&<div className="rounded-lg bg-zinc-900 p-3"><p className="text-sm">{CREATIVE_LABELS[current.analysis.status]}</p>{current.analysis.text?<p className="mt-2 whitespace-pre-wrap text-sm text-zinc-300">{current.analysis.text}</p>:<button className={secondary+' mt-2'} onClick={pollAnalysis}>Elemzés frissítése</button>}</div>}</fieldset></section>
    </div></details>
   </div>
  </div>
 </div>;
}
