import {WaveSpeedError} from '../providers/wavespeed';

export type SpeechWindow={start:number;end:number};
export type VisualCheck={version:1;frames:number;worstChangedFraction:number;meanChangedFraction:number};
export const CHECK_WIDTH=96,CHECK_HEIGHT=54,CHECK_FPS=24;

/** A conservative drift alarm, not a lip-sync/identity quality score. Compare the
 * same decoded times in RGB after light smoothing. A local mouth edit may pass;
 * a re-rendered street, shifted camera, or truncated output must stop the job. */
export function checkVisualDrift(source:Uint8Array,result:Uint8Array,duration:number):VisualCheck{
 const frameBytes=CHECK_WIDTH*CHECK_HEIGHT*3;
 const frames=source.length/frameBytes,otherFrames=result.length/frameBytes;
 if(!Number.isInteger(frames)||!Number.isInteger(otherFrames)||frames<Math.floor(duration*CHECK_FPS)-1||Math.abs(frames-otherFrames)>1)throw new WaveSpeedError('LIPSYNC_TIMING_CHANGED',409);
 let worst=0,total=0;
 for(let f=0;f<Math.min(frames,otherFrames);f++){
  let changed=0;
  for(let p=0;p<frameBytes;p+=3){const i=f*frameBytes+p;const delta=(Math.abs(source[i]-result[i])+Math.abs(source[i+1]-result[i+1])+Math.abs(source[i+2]-result[i+2]))/3;if(delta>24)changed++;}
  const fraction=changed/(CHECK_WIDTH*CHECK_HEIGHT);worst=Math.max(worst,fraction);total+=fraction;
 }
 const check:VisualCheck={version:1,frames:Math.min(frames,otherFrames),worstChangedFraction:worst,meanChangedFraction:total/Math.min(frames,otherFrames)};
 if(worst>.09||check.meanChangedFraction>.035)throw new WaveSpeedError('LIPSYNC_VISUAL_DRIFT',409);
 return check;
}

export function speechEnable(windows:SpeechWindow[],duration:number){
 if(!Number.isFinite(duration)||duration<=0||!windows.length||windows.some(w=>!Number.isFinite(w.start)||!Number.isFinite(w.end)||w.start<0||w.end<=w.start||w.end>duration))throw new WaveSpeedError('DIALOGUE_OUTSIDE_TRIM',409);
 // Keep the real first/last frames for continuity. Do not use generated images
 // during the lead-in, gaps between lines, or the final hand-off.
 return windows.map(w=>`between(t,${Math.max(1/CHECK_FPS,w.start-.06).toFixed(3)},${Math.min(duration-2/CHECK_FPS,w.end+.06).toFixed(3)})`).join('+');
}
