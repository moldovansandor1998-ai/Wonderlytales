import type {CastKey,SceneLine} from './episode-shared';
import type {VideoElement} from './shared';

export const FILM_CUT_ID='a1700001-2026-4011-8010-000000001515';
export const CUT_VERSION=1;
export const CUT_MAX_USD=30;
export const CUT_LEAD=.2;
export const CUT_TAIL=.35;
export type CutShot={
 id:string;scene:number;label:string;kind:'reuse'|'speech'|'action';characters:CastKey[];
 line?:SceneLine;lineIndex?:number;framePrompt:string;motionPrompt:string;
 seconds:number;maxSeconds:number;reframe:boolean;environment:'street'|'workshop';
 recording?:string;image?:string;audio?:string;source?:string;raw?:string;asset?:string;lastFrame?:string;
 sourceJob?:string;start?:number;end?:number;phase:'WAITING'|'AUDIO'|'FRAME'|'VIDEO'|'CHECK'|'READY';
 check?:{passed:boolean;text:string};
};
export type CutTask={status:'SUBMITTING'|'PROCESSING'|'READY'|'FAILED'|'UNCERTAIN';model:string;price:number;taskId?:string;output?:string;error?:string};
export type FilmCut={
 id:string;version:number;status:'DRAFT'|'RESERVING'|'QUEUED'|'RUNNING'|'STOPPING'|'STOPPED'|'PAUSED'|'READY';
 budget:'NONE'|'CLAIMED'|'RESERVED'|'UNCERTAIN';workflowId?:string;shots:CutShot[];index:number;
 voices:Record<string,{id:string;voice_id:string}>;refs:Partial<Record<CastKey,string>>;elements:VideoElement[];
 ceiling:number;authorizedUsd?:number;chargedUpperUsd:number;tasks:Record<string,CutTask>;
 street?:string;workshop?:string;master?:string;duration?:number;createdAt:string;updatedAt:string;error?:string;
};
export function speechDuration(seconds:number,max=10){
 if(!Number.isFinite(seconds)||seconds<=0)throw new Error('CUT_AUDIO_INVALID');
 const duration=Math.ceil(Math.max(2,seconds+CUT_LEAD+CUT_TAIL)*24)/24;
 if(duration>max)throw new Error('CUT_SPEECH_TOO_LONG');
 return duration;
}
export function shotCeiling(s:CutShot){
 if(s.kind==='reuse')return 0;
 return (s.kind==='speech'?Math.ceil(s.maxSeconds)*.112:s.maxSeconds*.168)+(s.reframe ? .04 : 0)+.02+(s.line && !s.recording ? .25 : 0);
}
export function cutCeiling(shots:CutShot[]){return Math.ceil((shots.reduce((n,s)=>n+shotCeiling(s),0)-1e-8)*100)/100;}
export function chargeAllowed(c:FilmCut,price:number,ceiling:number){
 return c.budget==='RESERVED'&&c.status==='RUNNING'&&Number.isFinite(price)&&price>=0&&price<=ceiling+1e-6&&c.chargedUpperUsd+price<=(c.authorizedUsd??0)+1e-6;
}
export const CUT_LABELS:Record<FilmCut['status'],string>={DRAFT:'Előkészítve',RESERVING:'Költségkeret rögzítése',QUEUED:'Sorba állítva',RUNNING:'A film készül',STOPPING:'Az elindított beállítás mentése',STOPPED:'Leállítva',PAUSED:'Ellenőrzést igényel',READY:'A megtekinthető film elkészült'};
