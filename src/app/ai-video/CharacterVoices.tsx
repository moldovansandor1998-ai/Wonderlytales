'use client';
import { useEffect,useState } from 'react';
import type { AccountVoice,CastCharacter,CastVoice } from '@/lib/ai-video/voices';
import type { DialogueRecording } from '@/lib/ai-video/dialogue';
type Overview={available:AccountVoice[];characters:(CastCharacter&{assigned:CastVoice|null})[]};
const field='mt-2 w-full rounded border border-zinc-700 bg-zinc-950 p-3 text-sm';
const button='rounded border border-zinc-700 px-3 py-2.5 text-sm hover:bg-zinc-800 disabled:opacity-40';
async function call<T>(path:string,body?:unknown):Promise<T> {
  const r=await fetch(`/api/ai-video/${path}`,{cache:'no-store',...(body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});
  const data=await r.json();
  if(!r.ok)throw new Error(data.error==='VOICE_ASSIGNMENT_CHANGED'?'A karakter hangja közben megváltozott. Frissítsd a hangokat.':data.error==='CHARACTER_VOICE_MISSING'?'Először rendelj ElevenLabs-hangot ehhez a karakterhez.':'Az ElevenLabs-hangok most nem érhetők el. Frissíts később.');
  return data;
}
export default function CharacterVoices() {
  const [data,setData]=useState<Overview|null>(null),[characterId,setCharacterId]=useState(''),[voiceId,setVoiceId]=useState('');
  const [text,setText]=useState('Hűha! Ez aztán közel volt! Mi folyik itt ma?');
  const [recording,setRecording]=useState<DialogueRecording|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const character=data?.characters.find(c=>c.id===characterId),assigned=character?.assigned;
  async function refresh() {
    setBusy(true);setError('');
    try {const next=await call<Overview>('voices');setData(next);setCharacterId(id=>id || next.characters.find(c=>c.code==='TV_FELIX')?.id || next.characters[0]?.id || '');}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  useEffect(()=>{void refresh();},[]);
  useEffect(()=>{setVoiceId(assigned?.provider_voice_id || assigned?.voice_id || '');setRecording(null);},[characterId,assigned?.id,assigned?.voice_id,assigned?.provider_voice_id]);
  async function save() {
    if(!character || !voiceId)return;setBusy(true);setError('');
    try {setData(await call<Overview>('voices',{characterId:character.id,voiceId,expectedRowId:character.voice_id}));}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function record() {
    if(!character || !assigned)return;setBusy(true);setError('');
    try {setRecording((await call<{recording:DialogueRecording}>('dialogue',{characterId:character.id,expectedVoiceId:assigned.provider_voice_id||assigned.voice_id,text})).recording);}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  return <section className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-5" aria-label="ElevenLabs karakterhangok">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">ElevenLabs · állandó karakterhangok</h2><button className={button} disabled={busy} onClick={refresh}>Karakterhangok frissítése</button></div>
    <p className="mt-2 text-sm text-zinc-300">Minden megszólalás a kiválasztott karakterhez rögzített ElevenLabs-hanggal készül. Hiányzó vagy nem egyértelmű hozzárendelésnél a beszédgenerálás leáll.</p>
    {error && <p role="alert" className="mt-3 text-red-300">{error}</p>}
    {!data && !error && <p className="mt-3 text-sm text-zinc-400">Karakterek és ElevenLabs-hangok betöltése…</p>}
    {data && <><div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-sm">Beszélő karakter<select className={field} value={characterId} disabled={busy} onChange={e=>setCharacterId(e.target.value)}>{data.characters.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
      <label className="text-sm">ElevenLabs-hang a karakterhez<select className={field} value={voiceId} disabled={busy} onChange={e=>setVoiceId(e.target.value)}><option value="">Válassz hangot…</option>{data.available.map(v=><option key={v.id} value={v.id}>{v.name} · {v.id}</option>)}</select></label></div>
      <p className={`mt-3 text-sm ${assigned?'text-emerald-300':'text-amber-300'}`}>{assigned ? `${character?.name} rögzített hangja: ${data.available.find(v=>v.id===(assigned.provider_voice_id||assigned.voice_id))?.name ?? assigned.voice_id}${assigned.status==='TEMPORARY_WORK_TRACK'?' · korábbi ideiglenes munkahang':''}` : `${character?.name ?? 'A karakter'} hangja még nincs hozzárendelve.`}</p>
      <button className={`${button} mt-3`} disabled={busy || !voiceId || (voiceId===(assigned?.provider_voice_id||assigned?.voice_id) && !!character?.voice_id)} onClick={save}>Hang rögzítése ehhez a karakterhez</button>
      <label className="mt-5 block text-sm">Magyar dialógus<textarea className={field} value={text} maxLength={250} disabled={busy} onChange={e=>{setText(e.target.value);setRecording(null);}}/></label>
      <button className={`${button} mt-3`} disabled={busy || !assigned || !text.trim() || voiceId!==(assigned.provider_voice_id||assigned.voice_id)} onClick={record}>Felvétel a karakter hangjával · legfeljebb 0,25 USD</button>
      <p className="mt-2 text-xs text-zinc-400">Az elkészült hang külön felvétel. A videóhoz illesztés és a szájmozgás ellenőrzése a következő lépés.</p>
      {recording && <div className="mt-4">{recording.status==='COMPLETED'?<><audio controls src={`/api/ai-video/dialogue/${recording.id}`} className="w-full"/><a className="mt-2 block text-sm text-amber-300 underline" href={`/api/ai-video/dialogue/${recording.id}`} target="_blank" rel="noreferrer">Karakterhang megnyitása</a><p className="mt-2 text-xs text-zinc-400">Rögzített ElevenLabs-hangazonosító: {recording.voiceId}</p></>:<p className="text-sm text-amber-300">A felvétel állapota: {recording.status}. Azonos szöveghez és hanghoz nem indul automatikusan új fizetős felvétel.</p>}</div>}
    </>}
  </section>;
}
