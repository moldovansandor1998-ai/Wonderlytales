import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {S3Client} from '@aws-sdk/client-s3';
import {R2VideoStore} from '@/lib/ai-video/storage';
import {mediaGallery} from '@/lib/ai-video/gallery';
import {preserveVideo} from '@/lib/ai-video/archive';

const sha='a'.repeat(64), second='b'.repeat(64), jobId='ffffffff-2026-4011-8010-000000000000';
beforeEach(()=>{
 for(const [key,value] of Object.entries({S3_ENDPOINT:'https://storage.test',S3_BUCKET:'private',S3_ACCESS_KEY_ID:'test',S3_SECRET_ACCESS_KEY:'test'}))vi.stubEnv(key,value);
});
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllEnvs();});

it('paginates all stored images, including old variants, excluding upload chunks and foreign keys',async()=>{
 const send=vi.spyOn(S3Client.prototype,'send');
 send.mockResolvedValueOnce({Contents:[
  {Key:'ai-video/wavespeed/v1/owner/images/'+sha,LastModified:new Date('2026-10-01'),Size:100},
  {Key:'ai-video/wavespeed/v1/owner/images/'+sha+'.part-0'},
  {Key:'ai-video/wavespeed/v1/other/images/'+second},
 ],IsTruncated:true,NextContinuationToken:'page-2'} as never);
 send.mockResolvedValueOnce({Contents:[{Key:'ai-video/wavespeed/v1/owner/images/'+second}],IsTruncated:false} as never);
 const store=new R2VideoStore('owner');
 const first=await mediaGallery(store,'images');
 expect(first.items.map(i=>i.id)).toEqual([sha]);expect(first.nextCursor).toBe('page-2');
 const last=await mediaGallery(store,'images',first.nextCursor);
 expect(last.items.map(i=>i.id)).toEqual([second]);expect(last.nextCursor).toBeUndefined();
 expect((send.mock.calls[1][0] as {input:unknown}).input).toMatchObject({Prefix:'ai-video/wavespeed/v1/owner/images/',ContinuationToken:'page-2'});
});
it('includes every stored processed MP4 and excludes audio and record internals',async()=>{
 vi.spyOn(S3Client.prototype,'send').mockResolvedValue({Contents:[{Key:'ai-video/wavespeed/v1/owner/post-assets/'+sha+'.mp4'},{Key:'ai-video/wavespeed/v1/owner/post-assets/'+second+'.mp3'}]} as never);
 const gallery=await mediaGallery(new R2VideoStore('owner'),'finished');
 expect(gallery.items).toHaveLength(1);expect(gallery.items[0]).toMatchObject({sha256:sha,url:'/api/ai-video/assets/'+sha,archived:true});
});
it('marks unarchived completed clips accurately and omits unfinished jobs',async()=>{
 const store={mediaPage:vi.fn().mockResolvedValue({items:[{id:jobId},{id:'pending'}],nextCursor:'next'}),read:vi.fn(async(id:string)=>({job:{status:id===jobId?'COMPLETED':'RUNNING',prompt:'Original video',createdAt:'2026-10-11'}}))} as unknown as R2VideoStore;
 const gallery=await mediaGallery(store,'videos');
 expect(gallery.items).toHaveLength(1);expect(gallery.items[0]).toMatchObject({jobId,archived:false});expect(gallery.nextCursor).toBe('next');
});
it('archives once and merges concurrent metadata instead of overwriting it',async()=>{
 const job={id:jobId,status:'COMPLETED',outputUrl:'https://provider.test/video.mp4'};
 const read=vi.fn().mockResolvedValueOnce({job,etag:'1'}).mockResolvedValue({job:{...job,continuityNote:'keep this'},etag:'2'});
 const save=vi.fn().mockResolvedValue(true),archiveVideo=vi.fn();
 const result=await preserveVideo({read,save,archiveVideo} as unknown as R2VideoStore,jobId);
 expect(archiveVideo).toHaveBeenCalledTimes(1);expect(save).toHaveBeenCalledWith({...job,continuityNote:'keep this',archived:true},'2');expect(result.archived).toBe(true);
});
it('does not mark failed archive downloads as durable or submit a replacement video',async()=>{
 const save=vi.fn(),archiveVideo=vi.fn().mockRejectedValue(new Error('expired provider file'));
 const store={read:vi.fn().mockResolvedValue({job:{id:jobId,status:'COMPLETED'},etag:'1'}),save,archiveVideo} as unknown as R2VideoStore;
 await expect(preserveVideo(store,jobId)).rejects.toThrow('expired provider file');expect(save).not.toHaveBeenCalled();
});
it('does not redownload a previously archived clip',async()=>{
 const archiveVideo=vi.fn();const store={read:vi.fn().mockResolvedValue({job:{id:jobId,status:'COMPLETED',archived:true}}),archiveVideo} as unknown as R2VideoStore;
 expect((await preserveVideo(store,jobId)).archived).toBe(true);expect(archiveVideo).not.toHaveBeenCalled();
});
