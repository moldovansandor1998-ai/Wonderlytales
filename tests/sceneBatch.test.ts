import {it,expect,vi,beforeEach} from 'vitest';
vi.mock('@/lib/ai-video/voices',()=>({readCast:vi.fn(),characterVoice:vi.fn()}));
vi.mock('@/lib/ai-video/automatic',()=>({advanceAutomatic:vi.fn(),claimAutomatic:vi.fn(),pauseAutomatic:vi.fn(),readAutomatic:vi.fn(),checkAutomaticVoices:vi.fn(),automaticSourceHash:vi.fn().mockReturnValue('source')}));
vi.mock('@/lib/ai-video/post-core',()=>({postContext:vi.fn(),requirePreviousApproval:vi.fn()}));
vi.mock('@/lib/ai-video/episode',()=>({episodeScene:vi.fn()}));
vi.mock('@/lib/ai-video/post-media',()=>({extractFinalFrame:vi.fn().mockResolvedValue(Buffer.from('last exact frame'))}));
import {batchSelection,advanceBatch} from '@/lib/ai-video/batch';
import {advanceAutomatic} from '@/lib/ai-video/automatic';
import {episodeScene} from '@/lib/ai-video/episode';
import {postContext} from '@/lib/ai-video/post-core';
import {extractFinalFrame} from '@/lib/ai-video/post-media';
import {EPISODE_SCENES,defaultSceneState} from '@/lib/ai-video/episode-data';
import type {BatchRun} from '@/lib/ai-video/batch-shared';
import type {R2VideoStore} from '@/lib/ai-video/storage';
it('accepts up to ten consecutive scenes, rejects gaps, duplicates, intro and eleven',()=>{
 const ids=EPISODE_SCENES.slice(3,13).map(s=>s.id);expect(batchSelection([...ids].reverse()).map(s=>s.id)).toEqual(ids);
 for(const invalid of [[],[ids[0],ids[2]],[ids[0],ids[0]],EPISODE_SCENES.slice(3,14).map(s=>s.id),[EPISODE_SCENES[0].id]])expect(()=>batchSelection(invalid)).toThrow('BATCH_CONSECUTIVE');
});
function memory(cursor=0){
 let seq=0;const map=new Map<string,{value:unknown;etag:string}>();
 const batch={id:'batch',workflowId:'worker',budget:'RESERVED',status:'RUNNING',cursor,voices:{},voiceRows:{},items:EPISODE_SCENES.slice(3,5).map((s,i)=>({sceneId:s.id,title:s.title,original:defaultSceneState(s),videoId:'video'+i,autoRunId:'run'+i,elements:[],prepared:i===0}))} as unknown as BatchRun;
 const put=(kind:string,id:string,value:unknown)=>map.set(kind+id,{value:structuredClone(value),etag:String(++seq)});put('auto-batch','batch',batch);
 const store={readRecord:vi.fn(async(k:string,id:string)=>structuredClone(map.get(k+id)??null)),writeRecord:vi.fn(async(k:string,id:string,v:unknown,e?:string)=>{if(map.get(k+id)?.etag!==e)return false;put(k,id,v);return true;}),putImage:vi.fn().mockResolvedValue({sha256:'new-frame'})};
 return {store:store as unknown as R2VideoStore,raw:store,put,map,batch};
}
beforeEach(()=>vi.clearAllMocks());
it('cannot advance the queue until the current final audio video exists',async()=>{
 const m=memory();vi.mocked(advanceAutomatic).mockResolvedValue(false);
 expect(await advanceBatch(m.store,'batch','worker')).toBe(false);expect((m.map.get('auto-batchbatch')!.value as BatchRun).cursor).toBe(0);expect(extractFinalFrame).not.toHaveBeenCalled();
 vi.mocked(advanceAutomatic).mockResolvedValue(true);m.put('auto-run','run0',{phase:'READY',finalAsset:'final-0'});
 expect(await advanceBatch(m.store,'batch','worker')).toBe(false);expect((m.map.get('auto-batchbatch')!.value as BatchRun).cursor).toBe(1);
});
it('extracts the final mixed video frame, preserves old versions and leaves quality approval pending',async()=>{
 const m=memory(1),item=m.batch.items[1];item.original={...item.original,videoJobId:'old-video',imageSha256:'old-image'};m.batch.items[1]=item;m.put('auto-batch','batch',m.batch);
 vi.mocked(episodeScene).mockResolvedValue({state:item.original} as never);
 const ctx={state:{videoJobId:'video0',review:'pending',dialogue:[]},job:{status:'READY',finalAsset:'final-with-sound',fingerprint:'same',duration:10},fingerprint:'same'};
 vi.mocked(postContext).mockResolvedValue(ctx as never);
 await advanceBatch(m.store,'batch','worker');
 expect(extractFinalFrame).toHaveBeenCalledWith(m.store,'final-with-sound');
 const state=m.map.get('episode-scene'+item.sceneId)!.value as typeof item.original;
 expect(state.imageSha256).toBe('new-frame');expect(state.videoHistory).toContain('old-video');expect(state.imageHistory).toContain('old-image');expect(state.review).toBe('pending');expect(state.imageApproved).toBe(false);expect(advanceAutomatic).not.toHaveBeenCalled();
});
