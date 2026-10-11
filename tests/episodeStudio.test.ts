import {beforeEach,expect,it,vi} from 'vitest';
vi.mock('@/lib/ai-video/creative',()=>({startSceneImage:vi.fn(),pollCreative:vi.fn(),references:vi.fn()}));
vi.mock('@/lib/ai-video/service',()=>({WaveSpeedVideoService:vi.fn()}));
import {episodeAction,editSchema} from '@/lib/ai-video/episode';
import {EPISODE_SCENES,defaultSceneState} from '@/lib/ai-video/episode-data';
import {CAST,type SceneState} from '@/lib/ai-video/episode-shared';
import {startSceneImage} from '@/lib/ai-video/creative';
import {WaveSpeedVideoService} from '@/lib/ai-video/service';
import type {R2VideoStore} from '@/lib/ai-video/storage';
const scene=EPISODE_SCENES[3],sha='a'.repeat(64),jobId='ffffffff-2026-4011-8010-000000000000';
function memory(){
 const records=new Map<string,{value:unknown;etag:string}>();let n=0;
 const store={
  readRecord:vi.fn(async(kind:string,id:string)=>structuredClone(records.get(kind+id)??null)),
  writeRecord:vi.fn(async(kind:string,id:string,value:unknown,etag?:string)=>{const key=kind+id;if(records.get(key)?.etag!==etag)return false;records.set(key,{value:structuredClone(value),etag:String(++n)});return true;}),
  read:vi.fn().mockResolvedValue(null),readDialogue:vi.fn().mockResolvedValue(null),imageUrl:vi.fn().mockResolvedValue('https://private.test/image'),
 };
 return {store:store as unknown as R2VideoStore,raw:store,seed:async(s:SceneState)=>store.writeRecord('episode-scene',s.id,s)};
}
function edit(s=defaultSceneState(scene)){const {mode,imagePrompt,prompt,characters,dialogue,note,review,trimStart,trimEnd,sound}=s;return {mode,imagePrompt,prompt,characters,dialogue,note,review,trimStart,trimEnd,sound};}
beforeEach(()=>{vi.clearAllMocks();process.env.WAVESPEED_API_KEY='test-key';});
it('plans exactly ten minutes and every cast/dialogue/edit is valid',()=>{
 expect(EPISODE_SCENES).toHaveLength(60);expect(EPISODE_SCENES.reduce((n,s)=>n+s.duration,0)).toBe(600);
 expect(new Set(EPISODE_SCENES.map(s=>s.id)).size).toBe(60);
 for(const s of EPISODE_SCENES){expect(editSchema.safeParse(edit(defaultSceneState(s))).success).toBe(true);for(const k of s.characters)expect(CAST[k]).toBeTruthy();}
});
it('requires explicit image approval before any paid video or quote call',async()=>{
 const m=memory();await m.seed({...defaultSceneState(scene),imageSha256:sha});
 for(const action of ['quote','video'])await expect(episodeAction({id:scene.id,action},m.store)).rejects.toThrow('APPROVE_IMAGE');
 expect(WaveSpeedVideoService).not.toHaveBeenCalled();
});
it('rejects stale edits and invalidates approval when the cast changes',async()=>{
 const m=memory();await m.seed({...defaultSceneState(scene),revision:2,imageSha256:sha,imageApproved:true});
 await expect(episodeAction({id:scene.id,action:'save',revision:1,data:edit()},m.store)).rejects.toThrow('SCENE_CHANGED');
 const r=await episodeAction({id:scene.id,action:'save',revision:2,data:{...edit(),characters:['felix','mira']}},m.store);
 expect(r.scene.state.imageApproved).toBe(false);expect(r.scene.state.revision).toBe(3);
});
it('freezes an image request before submitting and reuses it after a timeout',async()=>{
 const m=memory();vi.mocked(startSceneImage).mockRejectedValueOnce(new Error('timeout'));
 await expect(episodeAction({id:scene.id,action:'image',revision:0},m.store)).rejects.toThrow('timeout');
 const first=vi.mocked(startSceneImage).mock.calls[0][0];
 await episodeAction({id:scene.id,action:'image',revision:1},m.store);
 expect(vi.mocked(startSceneImage).mock.calls[1][0]).toEqual(first);
});
it('parallel first-open requests cannot create two distinct image jobs',async()=>{
 const m=memory();
 const results=await Promise.allSettled([0,1].map(()=>episodeAction({id:scene.id,action:'image',revision:0},m.store)));
 expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);expect(startSceneImage).toHaveBeenCalledTimes(1);
});
it('only permits a frame from the immediately preceding owned completed video',async()=>{
 const m=memory();await m.seed({...defaultSceneState(EPISODE_SCENES[2]),videoJobId:jobId});
 const data={sha256:sha,sourceJobId:jobId,sourceTime:9.999};
 await expect(episodeAction({id:scene.id,action:'frame',data},m.store)).rejects.toThrow('PREVIOUS_VIDEO_REQUIRED');
 m.raw.read.mockResolvedValue({job:{id:jobId,status:'COMPLETED',duration:10},etag:'1'});
 const r=await episodeAction({id:scene.id,action:'frame',revision:0,data},m.store);
 expect(r.scene.state).toMatchObject({mode:'last-frame',sourceJobId:jobId,imageApproved:false,imageSha256:sha});
 expect(startSceneImage).not.toHaveBeenCalled();
});
it('changing source keeps the old image and preparing another video keeps the original',async()=>{
 const m=memory();await m.seed({...defaultSceneState(scene),imageSha256:sha,imageApproved:true,videoJobId:jobId});
 m.raw.read.mockResolvedValue({job:{id:jobId,status:'COMPLETED',duration:10},etag:'1'});
 const r=await episodeAction({id:scene.id,action:'save',revision:0,data:{...edit(),mode:'last-frame'}},m.store);
 expect(r.scene.state.imageHistory).toEqual([sha]);expect(r.scene.state.imageSha256).toBeUndefined();
 const next=await episodeAction({id:scene.id,action:'new-video',revision:1},m.store);
 expect(next.scene.state.videoHistory).toEqual([jobId]);expect(next.scene.state.videoJobId).toBeUndefined();
});
it('restores a saved image without another paid request or implicit approval',async()=>{
 const m=memory();await m.seed({...defaultSceneState(scene),mode:'last-frame',imageSha256:'b'.repeat(64),imageHistory:[sha]});
 const r=await episodeAction({id:scene.id,action:'restore-image',revision:0,data:{sha256:sha}},m.store);
 expect(r.scene.state).toMatchObject({mode:'image',imageSha256:sha,imageApproved:false});
 expect(r.scene.state.imageHistory).toContain('b'.repeat(64));expect(startSceneImage).not.toHaveBeenCalled();
 await expect(episodeAction({id:scene.id,action:'restore-image',data:{sha256:'c'.repeat(64)}},m.store)).rejects.toThrow('INVALID_INPUT');
});
