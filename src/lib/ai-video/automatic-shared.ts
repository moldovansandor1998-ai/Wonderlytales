import type {CastKey,SceneLine} from './episode-shared';
import type {Language} from './post-shared';

export type AutoPhase='QUEUED'|'VIDEO'|'CHARACTERS'|'VOICES'|'TIMING'|'LIPSYNC'|'MIX'|'READY'|'PAUSED';
export type AutoRun={id:string;sceneId:string;language:Language;sourceHash:string;videoId:string;createdAt:string;updatedAt:string;phase:AutoPhase;workflowId?:string;budget:'CLAIMED'|'RESERVED'|'UNCERTAIN';services:string[];voices:Record<CastKey,string|null>;voiceRows:Record<string,{id:string;voice_id:string}>;maxPostCostUsd:number;error?:string;finalAsset?:string};
export type AutoPointer={id:string;runId:string};
export const AUTO_LABELS:Record<AutoPhase,string>={QUEUED:'Indításra vár',VIDEO:'A jelenet videója készül',CHARACTERS:'A képen látható szereplők felismerése',VOICES:'A szereplők saját hangjának felvétele',TIMING:'A párbeszéd automatikus időzítése',LIPSYNC:'A beszélők szájmozgásának illesztése',MIX:'A végleges hangos videó összeállítása',READY:'A kész videó megtekinthető',PAUSED:'A feldolgozás megállt · az elkészült anyagok megmaradtak'};
export const AUTO_ERRORS:Record<string,string>={
 AUTO_UNEXPECTED_CHARACTER:'A nyers videóban nem tervezett főszereplő jelent meg. A szájmozgás nem indul; ellenőrizd a jelenetet.',
 LIPSYNC_VISUAL_DRIFT:'A szájmozgás megváltoztatta a jelenet képét. A sor megállt; a nyers videó és a hang megmaradt.',
 LIPSYNC_TIMING_CHANGED:'A szájmozgás kimenetének hossza eltér a forrástól. A sor megállt, hogy a kép és a beszéd ne csússzon el.',
 AUTO_SOURCE_CHANGED:'A jelenet vagy a karakterhang közben megváltozott. Indítsd el a hangos változatot a mentett, új szöveggel.',
 AUTO_DIALOGUE_TOO_LONG:'A szöveg felolvasva nem fér a jelenetbe. Rövidítsd a párbeszédet; a rendszer újra időzíti.',
 AUTO_CHARACTER_UNCERTAIN:'A videón nem azonosítható biztosan minden beszélő. A nyers videó megmaradt a galériában; ellenőrizd a karaktereket.',
 AUTO_TOO_MANY_SPEAKERS:'Egy beállításban legfeljebb két látható beszélő szájmozgása illeszthető. A többi megszólalást külön beállításba kell tenni.',
 AUTO_RECORDING_UNCERTAIN:'Az egyik hangfelvétel eredménye ellenőrzést igényel. Ugyanazt a kérést nem fizetjük ki újra.',
 AUTO_BUDGET_UNCERTAIN:'A költségkeret foglalása nem zárult le biztosan. Fizetős generálás nem indul.',
 AUTO_PROVIDER_UNCERTAIN:'A szolgáltatói kérés eredménye ellenőrzést igényel. Nem indul új fizetős próbálkozás.',
 AUTO_PROVIDER_FAILED:'A szolgáltató nem fejezte be a feladatot. A már elkészült képek, videó és hangok megmaradtak.',
 AUTO_TIMEOUT:'A feldolgozás a vártnál tovább tart. A mentett kérés folytatható új generálás nélkül.',
};
export function postCostCeiling(lines:SceneLine[]){const visible=new Set(lines.filter(l=>l.delivery==='visible').map(l=>l.character));return Math.round((lines.length*.25+(visible.size ? .68 : 0))*100)/100;}

/** Pack actual speech lengths in script order, preserving preferred beats where possible.
 * No clipping, overlap or artificial acceleration. Offsets are source-video seconds. */
export function automaticOffsets(lines:SceneLine[],durations:number[],start:number,end:number){
 if(lines.length!==durations.length||durations.some(d=>!Number.isFinite(d)||d<=0))throw new Error('AUTO_RECORDING_UNCERTAIN');
 const gap=.12,lead=.15,tail=.2;
 if(durations.reduce((a,b)=>a+b,0)+Math.max(0,lines.length-1)*gap+lead+tail>end-start)throw new Error('AUTO_DIALOGUE_TOO_LONG');
 let cursor=start+lead;
 return lines.map((line,i)=>{
  const remaining=durations.slice(i).reduce((a,b)=>a+b,0)+(lines.length-i-1)*gap;
  const latest=end-tail-remaining;
  const offset=Math.max(cursor,Math.min(line.offset,latest));cursor=offset+durations[i]+gap;
  return Math.round(offset*1000)/1000;
 });
}
