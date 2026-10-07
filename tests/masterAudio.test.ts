import { describe,it,expect,vi } from 'vitest';
import { masterAudioBatch } from '@/lib/masterAudio';
import { ttsCacheKey } from '@/lib/providers/tts';
import type { Db } from '@/lib/db';
import type { StorageProvider } from '@/lib/providers/storage';
function fixture() {
  const rows:Record<string,any[]>={episodes:[{id:'ep',master_language:'hu',script_version:'V1'}],scenes:[{id:'sc',episode_id:'ep',number:1}],
    voices:[{character_id:'mark',language:'hu',provider:'elevenlabs',voice_id:'Voice123',model:'eleven_multilingual_v2',stability:0.5,style:0}],
    dialogue_lines:[{id:'a',scene_id:'sc',character_id:'mark',language:'hu',sequence:1,text:'Szia!',audio_path:null}],cost_events:[]};
  const db={get:async(t:string,id:string)=>rows[t].find(r=>r.id===id),list:async(t:string)=>rows[t],find:async(t:string,p:any)=>rows[t].filter(p),
    update:async(t:string,id:string,p:any)=>Object.assign(rows[t].find(r=>r.id===id),p),insert:async(t:string,r:any)=>{rows[t].push(r);return r;}} as unknown as Db;
  const stored=new Set<string>();
  const storage={exists:vi.fn(async(k:string)=>stored.has(k)),put:vi.fn(async(k:string)=>{stored.add(k);})} as unknown as StorageProvider;
  const tts={name:'elevenlabs',synthesize:vi.fn(async(text:string,cfg:any)=>({path:`audio/tts/hu/${cfg.voiceId}/${ttsCacheKey(text,cfg)}.mp3`,audio:Buffer.alloc(256),costUsd:0.01,durationSec:1,provider:'elevenlabs'}))};
  return {rows,db,stored,storage,tts};
}
describe('Hungarian master recordings',()=>{
  it('replaces unsupported V2 recordings instead of considering them complete',async()=>{
    const f=fixture();
    const legacy = 'audio/tts/hu/Voice123/legacy-v2.mp3';
    f.rows.dialogue_lines[0].audio_path=legacy; f.stored.add(legacy);
    await masterAudioBatch(f.db,'ep',1,f);
    expect(f.tts.synthesize.mock.calls[0][1].model).toBe('eleven_flash_v2_5');
    expect(f.rows.dialogue_lines[0].audio_path).not.toBe(legacy);
    expect(f.stored.has(legacy)).toBe(true);
  });
  it('persists bytes before marking the line and resumes without paid regeneration',async()=>{
    const f=fixture();
    expect(await masterAudioBatch(f.db,'ep',3,f)).toEqual({completed:1,total:1,done:true});
    expect(f.stored.has(f.rows.dialogue_lines[0].audio_path)).toBe(true);
    await masterAudioBatch(f.db,'ep',3,f);
    expect(f.tts.synthesize).toHaveBeenCalledTimes(1);
    expect(f.rows.cost_events).toHaveLength(1);
  });
  it('recovers an uploaded clip after a database write failure without another paid call',async()=>{
    const f=fixture();const update=f.db.update; f.db.update=vi.fn().mockRejectedValueOnce(new Error('database unavailable'));
    await expect(masterAudioBatch(f.db,'ep',3,f)).rejects.toThrow('database unavailable');
    expect(f.rows.dialogue_lines[0].audio_path).toBeNull();
    f.db.update=update;
    await masterAudioBatch(f.db,'ep',3,f);
    expect(f.tts.synthesize).toHaveBeenCalledTimes(1);
  });
  it('validates all character voices before spending on the first line',async()=>{
    const f=fixture();f.rows.dialogue_lines.push({...f.rows.dialogue_lines[0],id:'b',sequence:2,character_id:'missing'});
    await expect(masterAudioBatch(f.db,'ep',3,f)).rejects.toThrow('Hiányzó magyar');
    expect(f.tts.synthesize).not.toHaveBeenCalled();
  });
});
