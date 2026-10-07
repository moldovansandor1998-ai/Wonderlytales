import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getStudioUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import type { Episode,Scene,DialogueLine,Character } from '@/lib/types';
import { getStorage } from '@/lib/providers/storage';
import { audioZip } from '@/lib/audioArchive';
export const dynamic='force-dynamic';
export const maxDuration=300;
export async function GET(_request:Request,{params}:{params:{id:string}}) {
  const user=await getStudioUser();
  if(!user || !['admin','studio'].includes(user.role)) return NextResponse.json({error:'UNAUTHORIZED'},{status:401});
  const db=await getDb(),ep=await db.get<Episode>('episodes',params.id);
  if(!ep) return NextResponse.json({error:'NOT_FOUND'},{status:404});
  const scenes=await db.find<Scene>('scenes',s=>s.episode_id===ep.id);
  const order=new Map(scenes.map(s=>[s.id,s.number]));
  const lines=(await db.find<DialogueLine>('dialogue_lines',l=>order.has(l.scene_id)&&l.language==='hu')).sort((a,b)=>order.get(a.scene_id)!-order.get(b.scene_id)!||a.sequence-b.sequence);
  if(!lines.length || lines.some(l=>!l.audio_path?.startsWith('audio/tts/hu/'))) return NextResponse.json({error:'A magyar dialógus még nincs teljesen rögzítve.'},{status:409});
  const chars=await db.list<Character>('characters');
  const manifest=lines.map(l=>({id:l.id,scene:order.get(l.scene_id),sequence:l.sequence,character:chars.find(c=>c.id===l.character_id)?.code,text:l.text,path:l.audio_path,
    file:`SC${String(order.get(l.scene_id)).padStart(3,'0')}/D${String(l.sequence).padStart(3,'0')}_${l.id}.mp3`}));
  const hash=createHash('sha256').update(JSON.stringify(manifest)).digest('hex').slice(0,24);
  const key=`audio/episodes/${ep.id}/hu/${hash}.zip`,storage=getStorage();
  if(!(await storage.exists(key))) {
    const entries:{name:string;data:Buffer}[]=[];
    for(let i=0;i<manifest.length;i+=8) {
      entries.push(...await Promise.all(manifest.slice(i,i+8).map(async l=>({name:l.file,data:await storage.get(l.path!)}))));
    }
    entries.push({name:'manifest.json',data:Buffer.from(JSON.stringify({episode:ep.title,script:ep.script_version,status:'DIALOGUE_RECORDINGS_DRAFT',dialogue:manifest},null,2))});
    await storage.put(key,audioZip(entries),'application/zip');
  }
  const data=await storage.get(key);
  const stream=new ReadableStream<Uint8Array>({start(controller){
    for(let offset=0;offset<data.length;offset+=65536) controller.enqueue(data.subarray(offset,offset+65536));
    controller.close();
  }});
  return new NextResponse(stream,{headers:{'Content-Type':'application/zip','Content-Disposition':'attachment; filename="Csodakapu_S1E1_magyar_dialogusok_DRAFT.zip"','Cache-Control':'private, no-store'}});
}
