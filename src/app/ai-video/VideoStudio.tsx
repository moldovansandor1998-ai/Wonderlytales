'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { FELIX_SCENES, STATUS_LABELS, TERMINAL_STATUSES, WAVESPEED_CEILING_USD, documentedPrice, type VideoInput, type VideoJob } from '@/lib/ai-video/shared';
import CharacterVoices from './CharacterVoices';

type UploadedImage = { sha256: string; width: number; height: number; mime: string };
type Connection = { configured: boolean; connected: boolean; balance: number | null;
  budget: { dailyLimit: number; remaining: number; reservationUsd: number; ready: boolean } | null };
type Quote = { price: number; balance: number; reservationUsd: number };
const btn = 'rounded bg-amber-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed';
const secondary = 'rounded border border-zinc-700 px-3 py-2.5 text-sm hover:bg-zinc-800 disabled:opacity-40';
const panel = 'rounded-xl border border-zinc-800 bg-zinc-900/60 p-4 md:p-5';
const field = 'mt-2 w-full rounded border border-zinc-700 bg-zinc-950 p-3 text-sm';
const messages: Record<string,string> = {
  WAVESPEED_NOT_CONFIGURED: 'A WaveSpeed-kulcs még nincs beállítva ehhez az oldalhoz.',
  WAVESPEED_AUTH_FAILED: 'A WaveSpeed nem fogadta el a kulcsot. Ellenőrizd a kulcs jogosultságát.',
  WAVESPEED_BALANCE_LOW: 'A meglévő WaveSpeed-egyenleg nem fedezi a generálást.',
  WAVESPEED_RATE_LIMIT: 'A WaveSpeed átmenetileg túl sok kérést kapott. Később frissítsd az állapotot.',
  PRICE_CHANGED: 'A díj megváltozott. Kérj új árat a generálás előtt.',
  PRICE_ABOVE_CEILING: 'Az aktuális ár magasabb az ellenőrzött 1,68 USD munkánkénti plafonnál.',
  INVALID_IMAGE: 'JPEG vagy PNG szükséges, legfeljebb 10 MB, legalább 300 × 300 képpont, 1:2,5 és 2,5:1 közötti képarány.',
  IMAGE_CHECKSUM_MISMATCH: 'A feltöltött kép ellenőrzése nem sikerült. Töltsd fel újra.',
  INVALID_INPUT: 'Ellenőrizd a képet és a jelenetleírást (10–2500 karakter).',
  JOB_ALREADY_EXISTS: 'Ez a munkaazonosító már foglalt. Frissítsd az előzményeket.',
  UNAUTHORIZED: 'A bejelentkezés lejárt. Jelentkezz be újra.',
  FORBIDDEN: 'Ehhez a művelethez stúdiós jogosultság szükséges.',
  VIDEO_SERVICE_UNAVAILABLE: 'A szolgáltatás most nem érhető el. Az előzményekben ellenőrizd, elindult-e a munka, mielőtt új próbát kérsz.',
};
class ApiError extends Error { constructor(public code: string, message: string) { super(message); } }
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`/api/ai-video${path}`,{ ...init, cache: 'no-store' });
  if (!r.headers.get('content-type')?.includes('application/json')) throw new Error(messages.UNAUTHORIZED);
  const data = await r.json();
  if (!r.ok) throw new ApiError(data.error,messages[data.error] ?? 'A művelet nem sikerült. Ellenőrizd a kapcsolatot és próbálj állapotot frissíteni.');
  return data;
}
const post = (body?: unknown): RequestInit => ({ method: 'POST', ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) });
const errorText = (e: unknown) => e instanceof Error ? e.message : 'A művelet nem sikerült.';

async function uploadImage(file: File): Promise<UploadedImage> {
  if (!['image/png','image/jpeg'].includes(file.type) || file.size > 10 * 1024 * 1024) throw new Error(messages.INVALID_IMAGE);
  const bytes = await file.arrayBuffer();
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(v => v.toString(16).padStart(2,'0')).join('');
  const size = 3 * 1024 * 1024;
  const query = `sha256=${hash}&size=${file.size}`;
  for (let i=0; i<Math.ceil(file.size/size); i++) {
    await request(`/upload?action=chunk&${query}&index=${i}`,{ method: 'POST', body: file.slice(i*size,(i+1)*size) });
  }
  return request<UploadedImage>(`/upload?action=complete&${query}`,post());
}

export default function VideoStudio() {
  const [connection,setConnection] = useState<Connection | null>(null);
  const [jobs,setJobs] = useState<VideoJob[]>([]);
  const [image,setImage] = useState<UploadedImage | null>(null);
  const [endImage,setEndImage] = useState<UploadedImage | null>(null);
  const [scene,setScene] = useState(0);
  const [prompt,setPrompt] = useState<string>(FELIX_SCENES[0].prompt);
  const [duration,setDuration] = useState<5 | 10>(10);
  const [sound,setSound] = useState(true);
  const [quote,setQuote] = useState<Quote | null>(null);
  const [busy,setBusy] = useState('');
  const [error,setError] = useState('');
  const [notice,setNotice] = useState('');
  const [pending,setPending] = useState<VideoInput | null>(null);
  const submitLock = useRef(false);
  const mergeJob = useCallback((job: VideoJob) => setJobs(old => [job,...old.filter(x => x.id !== job.id)].sort((a,b) => b.createdAt.localeCompare(a.createdAt))),[]);
  const refresh = useCallback(async () => {
    const [c,j] = await Promise.allSettled([request<Connection>('/connection'),request<{jobs:VideoJob[]}>('/jobs')]);
    if (c.status === 'fulfilled') setConnection(c.value);
    else { setConnection(null); setError(errorText(c.reason)); }
    if (j.status === 'fulfilled') setJobs(j.value.jobs);
    else setError(errorText(j.reason));
  },[]);
  useEffect(() => { void refresh(); },[refresh]);
  const active = jobs.filter(j => j.taskId && (!TERMINAL_STATUSES.includes(j.status) || j.status === 'SUBMISSION_UNCERTAIN')).map(j => j.id).join(',');
  useEffect(() => {
    if (!active) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      if (stopped) return;
      if (document.visibilityState === 'visible') {
        const results = await Promise.allSettled(active.split(',').map(id => request<{job:VideoJob}>(`/jobs/${id}`,post())));
        if (!stopped) results.forEach(r => r.status === 'fulfilled' ? mergeJob(r.value.job) : setError(errorText(r.reason)));
      }
      if (!stopped) timer = setTimeout(poll,12000);
    };
    timer = setTimeout(poll,8000);
    return () => { stopped = true; clearTimeout(timer); };
  },[active,mergeJob]);
  const invalidate = () => { setQuote(null); setNotice(''); };
  async function chooseImage(file: File | undefined, ending = false) {
    if (!file) return;
    setBusy(ending ? 'Zárókép feltöltése…' : 'Kép feltöltése…'); setError(''); invalidate();
    try { const uploaded = await uploadImage(file); ending ? setEndImage(uploaded) : setImage(uploaded); }
    catch (e) { setError(errorText(e)); }
    finally { setBusy(''); }
  }
  function input(id = crypto.randomUUID()): VideoInput {
    if (!image) throw new Error('Először tölts fel egy kiinduló képet.');
    return { id, imageSha256: image.sha256, ...(endImage ? { endImageSha256: endImage.sha256 } : {}),
      prompt, duration, sound, maxCostUsd: quote?.price ?? WAVESPEED_CEILING_USD };
  }
  async function getQuote() {
    setBusy('Aktuális díj ellenőrzése…'); setError('');
    try { setQuote(await request<Quote>('/quote',post(input()))); }
    catch (e) { setError(errorText(e)); }
    finally { setBusy(''); }
  }
  async function generate() {
    if (submitLock.current || !quote) return;
    submitLock.current = true; setBusy('Generálás indítása…'); setError('');
    const req = pending ?? input(); setPending(req);
    try {
      const {job} = await request<{job:VideoJob}>('/jobs',post(req));
      mergeJob(job); setPending(null); setQuote(null);
      setNotice('A munka mentve. Az oldalt bezárhatod; az előzményekből folytathatod az ellenőrzést.');
      void refresh();
    } catch (e) {
      setError(errorText(e));
      // These explicit rejections occur before any claim or paid submission.
      if (e instanceof ApiError && ['PRICE_CHANGED','WAVESPEED_BALANCE_LOW','WAVESPEED_NOT_CONFIGURED','INVALID_INPUT','INVALID_IMAGE'].includes(e.code)) {setPending(null);setQuote(null);}
      // An uncertain network/storage response keeps the same id and payload.
    }
    finally { setBusy(''); submitLock.current = false; }
  }
  async function reconcile() {
    if (!pending) return;
    setBusy('Beküldés ellenőrzése…'); setError('');
    try {
      const result = await request<{jobs:VideoJob[]}>('/jobs');
      setJobs(result.jobs);
      const existing = await fetch(`/api/ai-video/jobs/${pending.id}`,{ cache:'no-store' });
      if (existing.status === 404) {
        // No permanent claim exists. A retry still uses the same id and payload.
        setNotice('Még nincs mentett munka. A „Beküldés folytatása” ugyanazt az azonosítót használja.');
      } else if (existing.ok) {
        const data = await existing.json(); mergeJob(data.job); setPending(null); setQuote(null);
        setNotice('A korábbi beküldés előkerült az előzményekben.');
      } else throw new Error('A mentett állapot nem ellenőrizhető.');
    } catch (e) { setError(errorText(e)); }
    finally { setBusy(''); }
  }
  async function pollOne(id: string) {
    setBusy('Állapot frissítése…'); setError('');
    try { mergeJob((await request<{job:VideoJob}>(`/jobs/${id}`,post())).job); }
    catch (e) { setError(errorText(e)); }
    finally { setBusy(''); }
  }
  async function continueFromFrame(job: VideoJob) {
    if (!job.outputUrl) return;
    setBusy('Utolsó képkocka átvétele…'); setError(''); invalidate();
    const video = document.createElement('video'); video.crossOrigin = 'anonymous'; video.preload = 'auto'; video.muted = true;
    try {
      const blob = await new Promise<Blob>((resolve,reject) => {
        const timeout = setTimeout(() => reject(new Error('A videó nem tölthető be képkocka-kivételhez. Töltsd fel külön az utolsó képkockát.')),45000);
        const fail = () => { clearTimeout(timeout); reject(new Error('A szolgáltató videója nem engedi a képkocka átvételét. Töltsd fel külön az utolsó képkockát.')); };
        video.onerror = fail;
        video.onloadedmetadata = () => {
          if (!Number.isFinite(video.duration) || video.duration <= 0) { fail(); return; }
          video.currentTime = Math.max(0,video.duration - 0.001);
        };
        video.onseeked = () => {
          try {
            const canvas = document.createElement('canvas'); canvas.width = video.videoWidth; canvas.height = video.videoHeight;
            canvas.getContext('2d')!.drawImage(video,0,0);
            canvas.toBlob(b => { clearTimeout(timeout); b ? resolve(b) : fail(); },'image/png');
          } catch { fail(); }
        };
        video.src = job.outputUrl!;
      });
      const frame = await uploadImage(new File([blob],`last-frame-${job.id}.png`,{type:'image/png'}));
      setImage(frame); setEndImage(null);
      const sourceScene = FELIX_SCENES.findIndex(s => s.prompt === job.prompt);
      const next = Math.min(2,(sourceScene >= 0 ? sourceScene : scene)+1); setScene(next); setPrompt(FELIX_SCENES[next].prompt); setDuration(10);
      setNotice('Az elkészült videó utolsó dekódolt képkockája lett az új kiinduló kép. Ellenőrizd a következő jelenet leírását.');
    } catch (e) { setError(errorText(e)); }
    finally { video.removeAttribute('src'); video.load(); setBusy(''); }
  }
  async function transcript(job: VideoJob) {
    setBusy('Beszéd ellenőrzése…');setError('');
    try { mergeJob((await request<{job:VideoJob}>(`/jobs/${job.id}/transcript`,post())).job); }
    catch(e) {setError(errorText(e));}
    finally {setBusy('');}
  }
  const canGenerate = !!connection?.connected && !!connection.budget?.ready && connection.budget.remaining >= (connection.budget.reservationUsd ?? Infinity);
  return <div className="space-y-5">
    <section className={panel} aria-label="WaveSpeed kapcsolat">
      <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold">Kling 3.0 Pro · kép → videó</h2>
        <p className="mt-1 text-sm text-zinc-400">5 vagy 10 másodperc · választható zene és környezeti hangok · saját kiinduló és zárókép</p></div>
        <button className={secondary} disabled={!!busy} onClick={() => { setError(''); void refresh(); }}>Kapcsolat és előzmények frissítése</button></div>
      <p className={`mt-4 text-sm ${connection?.connected ? 'text-emerald-300' : 'text-amber-300'}`}>{!connection ? 'Kapcsolat ellenőrzése…' : connection.connected ? `Csatlakoztatva · WaveSpeed-egyenleg: ${connection.balance?.toFixed(2)} USD` : 'A bekötés elkészült. A WaveSpeed-kulcs megadása szükséges.'}</p>
      {connection && !connection.configured && <p className="mt-2 text-sm text-zinc-300">A WonderlyTales <a className="text-amber-400 underline" href="https://vercel.com/moldovansandor1998-ais-projects/wonderlytales/settings/environment-variables" target="_blank" rel="noreferrer">Vercel-beállításainál</a> add meg a <code>WAVESPEED_API_KEY</code> titkos változót a Production környezethez, majd telepítsd újra az oldalt. A kulcs a <a className="text-amber-400 underline" href="https://wavespeed.ai/accesskey" target="_blank" rel="noreferrer">WaveSpeed-fiókban</a> érhető el.</p>}
      {connection?.budget && <p className="mt-2 text-sm text-zinc-400">Napi keret: {connection.budget.dailyLimit} USD · szabad: {connection.budget.remaining.toFixed(2)} USD · egy indítás foglalása: {connection.budget.reservationUsd.toFixed(2)} USD{!connection.budget.ready ? ' · a WaveSpeed költségkerete még nincs beállítva' : ''}</p>}
    </section>
    {error && <div role="alert" className="rounded border border-red-900 bg-red-950/30 p-4 text-red-200">{error}</div>}
    {notice && <p role="status" className="rounded border border-emerald-900 p-3 text-emerald-200">{notice}</p>}
    {pending && <div className={panel}><p className="text-amber-300">A legutóbbi beküldést még ellenőrizni kell. Az új jelenet indítása addig zárolva van.</p><p className="mt-1 break-all text-xs text-zinc-400">Munka: {pending.id}</p><div className="mt-3 flex flex-wrap gap-3"><button className={secondary} disabled={!!busy} onClick={reconcile}>Beküldés ellenőrzése</button><button className={secondary} disabled={!!busy} onClick={generate}>Beküldés folytatása ugyanazzal az azonosítóval</button></div></div>}
    <fieldset disabled={!!busy || !!pending} className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
      <section className={panel}><h2 className="mb-4 font-semibold">1. Kiinduló kép</h2>
        <label className="block text-sm">PNG vagy JPEG · legfeljebb 10 MB<input className="mt-2 block w-full text-sm file:mr-3 file:rounded file:border-0 file:bg-zinc-800 file:px-3 file:py-3 file:text-zinc-100" type="file" accept="image/png,image/jpeg" onChange={e => { void chooseImage(e.target.files?.[0]); e.target.value=''; }}/></label>
        {image ? <div className="mt-4"><img className="max-h-96 w-full rounded object-contain bg-zinc-950" src={`/api/ai-video/image?sha256=${image.sha256}`} alt="A következő videó kiinduló képe"/><p className="mt-2 text-xs text-zinc-400">{image.width} × {image.height} képpont · eredeti képarány</p>{Math.abs(image.width/image.height-16/9)>0.02 && <p className="mt-2 text-sm text-amber-200">Ez a kép nem 16:9 arányú. A rendszer az eredeti képet küldi be; a Full HD végső filmhez külön képkivágás vagy keretezés szükséges.</p>}</div> : <div className="mt-4 flex aspect-video items-center justify-center rounded border border-dashed border-zinc-700 p-6 text-center text-sm text-zinc-500">Töltsd fel Félix referenciaképét, vagy egy előző jelenet utolsó képkockáját.</div>}
        <details className="mt-5"><summary className="cursor-pointer text-sm text-amber-400">Zárókép megadása (opcionális)</summary><label className="mt-3 block text-sm">Kívánt utolsó képkocka<input type="file" accept="image/png,image/jpeg" className="mt-2 block w-full text-sm" onChange={e => { void chooseImage(e.target.files?.[0],true); e.target.value=''; }}/></label>{endImage && <div className="mt-3"><img className="max-h-40 rounded" src={`/api/ai-video/image?sha256=${endImage.sha256}`} alt="Kívánt zárókép"/><button type="button" className={`${secondary} mt-2`} onClick={() => {setEndImage(null);invalidate();}}>Zárókép törlése ebből a kérésből</button></div>}</details>
      </section>
      <section className={panel}><h2 className="font-semibold">2. Jelenet és hang</h2><label className="mt-4 block text-sm">Titokváros jelenetterv<select value={scene} className={field} onChange={e => { const i=Number(e.target.value);setScene(i);setPrompt(FELIX_SCENES[i].prompt);invalidate(); }}>{FELIX_SCENES.map((s,i)=><option key={s.title} value={i}>{s.title}</option>)}</select></label>
        <label className="mt-4 block text-sm">Mozgás, kamera és hang<textarea className={`${field} min-h-56`} maxLength={2500} minLength={10} value={prompt} onChange={e=>{setPrompt(e.target.value);invalidate();}}/></label><p className="mt-1 text-right text-xs text-zinc-500">{prompt.length} / 2500</p>
        <div className="mt-3 flex flex-wrap gap-6 items-center"><label className="text-sm">Hossz<select className={`${field} !w-auto ml-3 !mt-0`} value={duration} onChange={e=>{setDuration(Number(e.target.value) as 5|10);invalidate();}}><option value={5}>5 mp</option><option value={10}>10 mp</option></select></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={sound} onChange={e=>{setSound(e.target.checked);invalidate();}}/>Zene és környezeti hangok</label></div>
        <p className="mt-4 text-sm text-zinc-400">Tájékoztató listaár: {documentedPrice(duration,sound).toFixed(2)} USD. Indítás előtt lekérjük a fiókod aktuális árát és egyenlegét.</p>
        {quote && <div className="mt-3 rounded bg-zinc-950 p-3 text-sm"><p>Aktuális becsült díj: <strong>{quote.price.toFixed(3)} USD</strong> · egyenleg: {quote.balance.toFixed(2)} USD</p><p className="mt-1 text-zinc-400">A napi keretből {quote.reservationUsd.toFixed(2)} USD foglalódik. A végleges díjat a WaveSpeed számlázza.</p></div>}
        <div className="mt-4 flex flex-wrap gap-3"><button type="button" className={secondary} disabled={!image || !canGenerate || prompt.trim().length<10} onClick={getQuote}>Aktuális díj lekérése</button><button type="button" className={btn} disabled={!quote || !canGenerate || quote.balance<quote.price} onClick={generate}>{duration} mp videó generálása</button></div>
        <p className="mt-4 text-xs leading-5 text-zinc-400">A képet és a jelenetleírást a WaveSpeed dolgozza fel. A beszéd külön, az ElevenLabs karakterhangjával készül. A szájmozgást és karakterazonosságot a végső videón kell ellenőrizni.</p>
      </section>
    </fieldset>
    <CharacterVoices/>
    {busy && <p role="status" aria-live="polite" className="text-amber-300">{busy}</p>}
    <section aria-label="Generált jelenetek" className="space-y-4"><h2 className="text-xl font-semibold">Jeleneteim</h2><p className="text-sm text-zinc-400">Az elkészült MP4-et mentsd le: a szolgáltatói videólink idővel lejárhat. A három 10 másodperces jelenet összevágása és a végső Full HD ellenőrzése külön lépés.</p>
      {!jobs.length && <p className={`${panel} text-zinc-400`}>Még nincs mentett WaveSpeed-generálásod.</p>}
      {jobs.map(job=><article key={job.id} className={panel}><div className="flex flex-wrap justify-between gap-3"><h3 className="font-semibold">{job.duration} mp · {job.sound ? 'hanggal' : 'hang nélkül'}</h3><span className={job.status==='COMPLETED'?'text-emerald-300':'text-amber-300'}>{STATUS_LABELS[job.status]}</span></div><p className="mt-1 text-xs text-zinc-500">{new Date(job.createdAt).toLocaleString('hu-HU', {timeZone:'Asia/Saigon'})} (Asia/Saigon) · becsült díj: {job.estimatedCostUsd.toFixed(3)} USD</p>
        {job.error && <p className="mt-3 text-sm text-amber-200">{job.error}</p>}
        {job.status==='SUBMITTING' && <p className="mt-3 text-sm text-amber-200">Ha a beküldés tartósan ebben az állapotban marad, előbb ellenőrizd a WaveSpeed előzményeit.</p>}
        {job.outputUrl && <video controls playsInline preload="metadata" className="my-4 max-h-[560px] w-full rounded bg-black" src={`/api/ai-video/jobs/${job.id}/media`}/>}
        <div className="mt-3 flex flex-wrap gap-3">{job.taskId && job.status!=='COMPLETED' && <button className={secondary} disabled={!!busy} onClick={()=>void pollOne(job.id)}>Állapot frissítése</button>}{job.outputUrl && <><a className={btn} href={`/api/ai-video/jobs/${job.id}/media`} target="_blank" rel="noreferrer">MP4 megnyitása / letöltés</a><button className={secondary} disabled={!!busy || !!pending} onClick={()=>void continueFromFrame(job)}>Folytatás az utolsó képkockából</button></>}</div>
        {job.outputUrl && <div className="mt-4 border-t border-zinc-800 pt-4"><button className={secondary} disabled={!!busy || ['COMPLETED','FAILED','UNCERTAIN','SUBMITTING'].includes(job.transcript?.status ?? '')} onClick={()=>void transcript(job)}>{job.transcript?.status === 'PROCESSING' ? 'Átirat állapotának frissítése' : 'Beszéd felismerése · legfeljebb 0,03 USD'}</button>{job.transcript && <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-300">{job.transcript.status === 'COMPLETED' ? (job.transcript.text || 'Nem talált felismerhető beszédet.') : job.transcript.status === 'PROCESSING' ? 'Beszédfelismerés folyamatban. A frissítés nem indít új fizetős feladatot.' : job.transcript.status === 'SUBMITTING' ? 'Beszédfelismerési kérés beküldése; új beküldés zárolva.' : 'A beszédellenőrzés nem fejeződött be. Nincs automatikus újraküldés.'}</p>}<p className="mt-2 text-xs text-zinc-500">Automatikus átirat; a kiejtést, színészi játékot és szájmozgást külön is meg kell hallgatni és nézni.</p></div>}
        <details className="mt-4 text-sm"><summary className="cursor-pointer text-zinc-400">Jelenetleírás és azonosítók</summary><p className="mt-3 whitespace-pre-wrap">{job.prompt}</p><p className="mt-3 break-all text-xs text-zinc-500">Munka: {job.id}{job.taskId ? ` · WaveSpeed: ${job.taskId}` : ''}</p></details>
      </article>)}
    </section>
  </div>;
}
