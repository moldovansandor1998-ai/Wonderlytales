import {R2VideoStore,digest} from './storage';
import {CAST,type SceneState,type SceneLine,type CastKey} from './episode-shared';
import {EPISODE_SCENES,defaultSceneState,normalizeSceneState} from './episode-data';
import {readCast,characterVoice} from './voices';
import {newVersion,type Language,type LanguageVersion,type PostScene,type PostJob} from './post-shared';
import type {DialogueRecording} from './dialogue';
import {WaveSpeedError} from '../providers/wavespeed';
export async function currentVoices(){const {characters,voices}=await readCast();return Object.fromEntries(Object.entries(CAST).map(([key,c])=>[key,characterVoice(characters.find(x=>x.id===c.id)??{...c,code:'',voice_id:null},voices)?.voice_id??null])) as Record<CastKey,string|null>;}
export function sourceHash(lines:SceneLine[]){return digest(JSON.stringify(lines));}
export function fingerprint(state:SceneState,variant:LanguageVersion,lang:Language,voices:Record<CastKey,string|null>){const lines=lang==='hu'?state.dialogue:variant.dialogue??[];return digest(JSON.stringify({video:state.videoJobId,start:state.trimStart,end:state.trimEnd,lines,voices:lines.map(l=>voices[l.character]),recordings:lines.map((_,i)=>variant.recordings[String(i)]??(lang==='hu'?state.recordings[String(i)]:null)),mix:variant.mix,lang,source:lang==='en'?sourceHash(state.dialogue):undefined}));}
export async function postContext(store:R2VideoStore,id:string,language:Language,voiceMap?:Record<CastKey,string|null>){
 const definition=EPISODE_SCENES.find(d=>d.id===id);if(!definition)throw new WaveSpeedError('SCENE_NOT_FOUND',404);
 const [scene,saved,voices]=await Promise.all([store.readRecord<SceneState>('episode-scene',id),store.readRecord<PostScene>('post-scene',id),voiceMap??currentVoices()]);
 const state=normalizeSceneState(scene?.value??defaultSceneState(definition)),post=saved?.value??{id,revision:0,variants:{}},variant=post.variants[language]??{...newVersion(),mix:{...newVersion().mix,...(definition.kind==='intro'?{sourceSpeech:'loop-intro' as const}:{})}};
 const lines=language==='hu'?state.dialogue:variant.dialogue??[];
 const recordings=Object.fromEntries((await Promise.all(lines.map(async(_,i)=>{const key=String(i),rec=variant.recordings[key]??(language==='hu'?state.recordings[key]:undefined);return [key,rec?await store.readDialogue<DialogueRecording>(rec):null];}))).filter(([,r])=>r)) as Record<string,DialogueRecording>;
 const job=variant.jobId?(await store.readRecord<PostJob>('post-job',variant.jobId))?.value??null:null;
 const hash=fingerprint(state,variant,language,voices);
 return {language,definition,state,post,etag:saved?.etag,variant,lines,recordings,job,voices,fingerprint:hash,approved:state.review!=='needs-work'&&!!job?.finalAsset&&job.status==='READY'&&variant.approvedFingerprint===hash&&job.fingerprint===hash,translationCurrent:language==='hu'||variant.sourceHash===sourceHash(state.dialogue)};
}
export async function requirePreviousApproval(store:R2VideoStore,order:number){
 if(order<1)return;
 const prev=await postContext(store,EPISODE_SCENES[order-1].id,'hu');
 if(!prev.approved)throw new WaveSpeedError('PREVIOUS_POST_APPROVAL_REQUIRED',409);
}
export function validateRecordings(ctx:Awaited<ReturnType<typeof postContext>>){
 for(const [i,line] of ctx.lines.entries()){
  const rec=ctx.recordings[String(i)];
  if(!rec||rec.status!=='COMPLETED'||rec.voiceId!==ctx.voices[line.character]||rec.text!==line.text||(rec.language??'hu')!==ctx.language)throw new WaveSpeedError('CURRENT_VOICE_RECORDING_REQUIRED',409);
  if(line.offset<ctx.state.trimStart||line.offset+(rec.duration??60)>ctx.state.trimEnd-.1)throw new WaveSpeedError('DIALOGUE_OUTSIDE_TRIM',409);
 }
 const spans=ctx.lines.map((l,i)=>({s:l.offset,e:l.offset+(ctx.recordings[String(i)].duration??0)})).sort((a,b)=>a.s-b.s);
 if(spans.some((s,i)=>i>0&&s.s<spans[i-1].e))throw new WaveSpeedError('DIALOGUE_OVERLAP',409);
 const visible=[...new Set(ctx.lines.filter(l=>l.delivery==='visible').map(l=>l.character))];
 if(visible.length>2)throw new WaveSpeedError('TOO_MANY_VISIBLE_SPEAKERS',409);
 if(visible.length===2&&(!ctx.variant.mix.layoutConfirmed||!visible.includes(ctx.variant.mix.leftSpeaker!)))throw new WaveSpeedError('SPEAKER_LAYOUT_REQUIRED',409);
 return visible;
}
