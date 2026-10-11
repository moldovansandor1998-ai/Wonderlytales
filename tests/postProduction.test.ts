import {it,expect,vi,beforeEach} from 'vitest';
vi.mock('@/lib/ai-video/voices',()=>({readCast:vi.fn(),characterVoice:vi.fn()}));
import {fingerprint,validateRecordings,requirePreviousApproval} from '@/lib/ai-video/post-core';
import {newVersion} from '@/lib/ai-video/post-shared';
import {EPISODE_SCENES,defaultSceneState} from '@/lib/ai-video/episode-data';
import {readCast,characterVoice} from '@/lib/ai-video/voices';
import {CAST} from '@/lib/ai-video/episode-shared';
import type {R2VideoStore} from '@/lib/ai-video/storage';
const voices={felix:'fox',mira:'rabbit',nera:'marten',tilda:'pangolin',oszkar:'squirrel'};
const state={...defaultSceneState(EPISODE_SCENES[3]),videoJobId:'a1709001-2026-4011-8010-000000000003'};
const variant={...newVersion(),recordings:{'0':'r'}};
it('invalidates approval when the voice, trim, language, dialogue or mix changes',()=>{
 const hash=fingerprint(state,variant,'hu',voices);
 expect(fingerprint(state,variant,'hu',voices)).toBe(hash);
 expect(fingerprint(state,variant,'hu',{...voices,felix:'new'})).not.toBe(hash);
 expect(fingerprint({...state,trimEnd:9},variant,'hu',voices)).not.toBe(hash);
 expect(fingerprint(state,{...variant,mix:{...variant.mix,voice:1.2}},'hu',voices)).not.toBe(hash);
 expect(fingerprint(state,variant,'en',voices)).not.toBe(hash);
 expect(fingerprint({...state,dialogue:[{...state.dialogue[0],text:'Changed'}]},variant,'hu',voices)).not.toBe(hash);
});
const context=()=>({language:'hu',state,variant,lines:state.dialogue,recordings:{'0':{status:'COMPLETED',voiceId:'fox',text:state.dialogue[0].text,language:'hu',duration:3}},voices} as unknown as Parameters<typeof validateRecordings>[0]);
it('requires current voice and audio language, prevents cut speech and overlap',()=>{
 const c=context();expect(validateRecordings(c)).toEqual(['felix']);
 c.recordings['0'].voiceId='old';expect(()=>validateRecordings(c)).toThrow('CURRENT_VOICE_RECORDING_REQUIRED');
 c.recordings['0'].voiceId='fox';c.recordings['0'].language='en';expect(()=>validateRecordings(c)).toThrow('CURRENT_VOICE_RECORDING_REQUIRED');
 c.recordings['0'].language='hu';c.recordings['0'].duration=10;expect(()=>validateRecordings(c)).toThrow('DIALOGUE_OUTSIDE_TRIM');
 c.recordings['0'].duration=3;c.lines=[...c.lines,{...c.lines[0],offset:2}];c.recordings['1']=c.recordings['0'];expect(()=>validateRecordings(c)).toThrow('DIALOGUE_OVERLAP');
});
it('requires explicit left/right mapping for two visible speaking characters',()=>{
 const c=context();c.lines=[...c.lines,{character:'mira',text:'Hi',offset:6,delivery:'visible'}];c.recordings['1']={...c.recordings['0'],text:'Hi',voiceId:'rabbit',duration:1};
 expect(()=>validateRecordings(c)).toThrow('SPEAKER_LAYOUT_REQUIRED');
 c.variant={...c.variant,mix:{...c.variant.mix,leftSpeaker:'mira',layoutConfirmed:true}};expect(validateRecordings(c)).toEqual(['felix','mira']);
});
it('server blocks a next scene when there is no approved final, even if raw video exists',async()=>{
 vi.mocked(readCast).mockResolvedValue({characters:Object.values(CAST).map(c=>({...c,code:'',voice_id:'row'})),voices:[]});vi.mocked(characterVoice).mockReturnValue(null);
 const store={readRecord:vi.fn().mockResolvedValue(null)} as unknown as R2VideoStore;
 await expect(requirePreviousApproval(store,1)).rejects.toThrow('PREVIOUS_POST_APPROVAL_REQUIRED');
 await expect(requirePreviousApproval(store,0)).resolves.toBeUndefined();
});

it('blocks continuation of a visually rejected scene even if its sound was approved',async()=>{
 const {postContext}=await import('@/lib/ai-video/post-core');
 const scene={...defaultSceneState(EPISODE_SCENES[1]),review:'needs-work' as const};
 const voiceMap={felix:null,mira:null,nera:null,tilda:null,oszkar:null};
 const v={...newVersion(),jobId:'job'};const hash=fingerprint(scene,v,'hu',voiceMap);
 const records:{[key:string]:unknown}={
  'episode-scene':scene,
  'post-scene':{id:scene.id,revision:1,variants:{hu:{...v,approvedFingerprint:hash}}},
  'post-job':{id:'job',status:'READY',finalAsset:'a'.repeat(64),fingerprint:hash},
 };
 const store={readRecord:vi.fn(async(kind:string)=>({value:records[kind],etag:'1'})),readDialogue:vi.fn()} as unknown as R2VideoStore;
 expect((await postContext(store,scene.id,'hu',voiceMap)).approved).toBe(false);
 await expect(requirePreviousApproval(store,2)).rejects.toThrow('PREVIOUS_POST_APPROVAL_REQUIRED');
});
