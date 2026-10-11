import {it,expect,vi} from 'vitest';
vi.mock('@/lib/ai-video/voices',()=>({readCast:vi.fn(),characterVoice:vi.fn()}));
import {automaticOffsets,postCostCeiling,type AutoRun} from '@/lib/ai-video/automatic-shared';
import {recognizedSpeakers,claimAutomatic,reusableAutomatic,automaticSourceHash} from '@/lib/ai-video/automatic';
import {effectiveLines,fingerprint,sourceHash} from '@/lib/ai-video/post-core';
import {defaultSceneState,EPISODE_SCENES} from '@/lib/ai-video/episode-data';
import {newVersion} from '@/lib/ai-video/post-shared';
import type {R2VideoStore} from '@/lib/ai-video/storage';
import type {SceneLine} from '@/lib/ai-video/episode-shared';
const lines:SceneLine[]=[{character:'felix',text:'Hűha!',offset:3,delivery:'visible'},{character:'mira',text:'Állj meg!',offset:4,delivery:'visible'}];
it('automatically moves two long overlapping lines to fit, retaining order and a pause',()=>{
 const offsets=automaticOffsets(lines,[4,4],0,10);expect(offsets[0]).toBeCloseTo(1.68);expect(offsets[1]).toBeCloseTo(5.8);expect(offsets[1]).toBeGreaterThan(offsets[0]+4);expect(offsets[1]+4).toBeLessThanOrEqual(9.8);
});
it('waits for an entering character and rejects speech that cannot fit its visible interval',()=>{
 expect(automaticOffsets([lines[1]],[2],0,10,[{start:5,end:9}])).toEqual([5]);
 expect(()=>automaticOffsets([lines[1]],[4],0,10,[{start:6,end:9}])).toThrow('AUTO_SPEAKER_WINDOW');
 expect(()=>automaticOffsets(lines,[6,5],0,10)).toThrow('AUTO_DIALOGUE_TOO_LONG');
});
it('handles trims and silence without requiring user offsets',()=>{
 expect(automaticOffsets([lines[0]],[2],4,10)).toEqual([4.15]);expect(automaticOffsets([],[],0,10)).toEqual([]);expect(postCostCeiling([])).toBe(0);expect(postCostCeiling(lines)).toBe(1.18);
});
const recognized=(confident=true)=>JSON.stringify({confident,stable:true,characters:[{character:'mira',position:'left',faceVisible:true,visibleFrom:2,visibleUntil:10},{character:'felix',position:'right',faceVisible:true,visibleFrom:0,visibleUntil:10}]});
it('maps voices by observed identity, even when Mira is left and Félix is right',()=>{
 const r=recognizedSpeakers(recognized(),['felix','mira']);expect(r.leftSpeaker).toBe('mira');expect(r.windows.mira.start).toBe(2);
});
it('does not guess missing characters, ambiguous identity, or a changing side',()=>{
 expect(()=>recognizedSpeakers(recognized(false),['mira','felix'])).toThrow('AUTO_CHARACTER_UNCERTAIN');
 expect(()=>recognizedSpeakers(recognized(),['tilda','felix'])).toThrow('AUTO_CHARACTER_UNCERTAIN');
 expect(()=>recognizedSpeakers(recognized().replace('"stable":true','"stable":false'),['mira','felix'])).toThrow('AUTO_CHARACTER_UNCERTAIN');
});
it('invalidates stale automatic timing when dialogue or recordings change',()=>{
 const state={...defaultSceneState(EPISODE_SCENES[3]),dialogue:lines},v={...newVersion(),recordings:{'0':'a','1':'b'},autoTiming:{sourceHash:sourceHash(lines),recordingIds:['a','b'],offsets:[.5,5]}};
 expect(effectiveLines(state,v,'hu').map(l=>l.offset)).toEqual([.5,5]);
 expect(effectiveLines(state,{...v,recordings:{'0':'changed','1':'b'}},'hu')).toEqual(lines);
 const voices={felix:'f',mira:'m',nera:null,tilda:null,oszkar:null};expect(fingerprint(state,v,'hu',voices)).not.toBe(fingerprint(state,{...v,autoTiming:undefined},'hu',voices));
});
it('only one of two enqueued workflows may own a run; unreserved runs cannot start',async()=>{
 let value={id:'run',budget:'RESERVED',phase:'QUEUED'} as AutoRun,etag=0;
 const store={readRecord:async()=>({value:{...value},etag:String(etag)}),writeRecord:async(_k:string,_id:string,v:AutoRun,e:string)=>{if(e!==String(etag))return false;value=v;etag++;return true;}} as unknown as R2VideoStore;
 const claims=await Promise.all([claimAutomatic(store,'run','worker-one'),claimAutomatic(store,'run','worker-two')]);expect(claims.filter(Boolean)).toHaveLength(1);
 value={...value,budget:'CLAIMED',workflowId:undefined};expect(await claimAutomatic(store,'run','worker-three')).toBe(false);
});

it('replayed start reuses the active plan after automatic mixing edits, not a new charge plan',()=>{
 const c={state:{...defaultSceneState(EPISODE_SCENES[3]),videoJobId:'v'},language:'hu',variant:newVersion(),voices:{}} as never;
 const run={sourceHash:automaticSourceHash(c),phase:'TIMING',mixHash:'old-mix'} as AutoRun;
 expect(reusableAutomatic(run,c)).toBe(true);
 expect(reusableAutomatic({...run,sourceHash:'different-source'},c)).toBe(false);
 expect(reusableAutomatic({...run,phase:'PAUSED'},c)).toBe(false);
});
