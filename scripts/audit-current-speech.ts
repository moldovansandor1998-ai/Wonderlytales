/** Offline audit of exact downloaded recordings; no paid provider calls. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { dialogueRecording } from '../src/lib/dialogueRecording';
import { validateRecordedReview } from '../src/lib/speechTiming';
import type { Db } from '../src/lib/db';

async function main() {
  const [root, out] = process.argv.slice(2);
  if (!root || !out) throw new Error('Usage: audit-current-speech.ts DOWNLOAD_DIRECTORY OUTPUT_JSON');
  const snapshot = JSON.parse(await fs.readFile(path.join(root,'snapshot.json'),'utf8'));
  const downloads = JSON.parse(await fs.readFile(path.join(root,'download-evidence.json'),'utf8'));
  const db = {get:async(table:string,id:string)=>snapshot[table].find((r:any)=>r.id===id),
    find:async(table:string,predicate:any)=>snapshot[table].filter(predicate)} as unknown as Db;
  const rows=[];
  for(const line of snapshot.dialogue_lines) {
    const recording=await dialogueRecording(db,line.id);
    const audio=await fs.readFile(path.join(root,line.id+'.mp3'));
    const evidence=downloads.find((r:any)=>r.id===line.id);
    if (!evidence?.decoded || evidence.audio_sha256!==createHash('sha256').update(audio).digest('hex')) throw new Error('Invalid decode evidence');
    let review=null;
    try {review=validateRecordedReview(JSON.parse(await fs.readFile(path.join(root,line.id+'.review.json'),'utf8')),audio,line.text);}
    catch(error:any){if(error.code!=='ENOENT') throw error;}
    rows.push({id:line.id,scene_id:recording.scene.id,scene:recording.scene.number,sequence:line.sequence,
      character:recording.character.code,text:line.text,path:recording.path,audio_sha256:evidence.audio_sha256,
      duration:evidence.duration,decoded:true,voice_path_matches:true,
      duration_delta:Math.abs((line.duration_sec??evidence.duration)-evidence.duration),
      alignment:review ? {language:review.language,text_matches:review.textMatches,word_timings_valid:review.word_timings_valid,
        character_timings_valid:review.character_timings_valid,usable_for_lipsync:review.usable_for_lipsync} : null});
  }
  const report={checked_at:new Date().toISOString(),total:rows.length,decoded:rows.length,voice_paths_match:rows.length,
    cached_current_alignments:rows.filter(r=>r.alignment).length,usable_alignments:rows.filter(r=>r.alignment?.usable_for_lipsync).length,
    missing_alignments:rows.filter(r=>!r.alignment).length,phonetics_approved:false,production_approved:false,rows};
  await fs.writeFile(out,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({...report,rows:undefined}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
