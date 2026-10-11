import { beforeEach, expect, it, vi } from 'vitest';
const send = vi.hoisted(() => vi.fn());
vi.mock('@aws-sdk/client-s3', async importOriginal => ({ ...await importOriginal<object>(), S3Client: class { send = send; } }));
vi.mock('@/lib/config', () => ({ requireConfiguration: vi.fn() }));
import { R2VideoStore } from '@/lib/ai-video/storage';
import type { VideoJob } from '@/lib/ai-video/shared';
const sha = 'a'.repeat(64), id = '11111111-1111-4111-8111-111111111111';
beforeEach(() => send.mockReset());
it('lists every page within the signed-in owner and excludes temporary upload chunks', async () => {
  const prefix = 'ai-video/wavespeed/v1/owner-a/images/';
  send.mockResolvedValueOnce({ Contents: [{Key:prefix+sha}, {Key:prefix+sha+'.part-0'}], IsTruncated:true, NextContinuationToken:'page-two' })
    .mockResolvedValueOnce({Contents:[{Key:prefix+'b'.repeat(64)}], IsTruncated:false});
  const store = new R2VideoStore('owner-a');
  const first = await store.galleryPage('images');
  expect(first.items.map(x => x.id)).toEqual([sha]);
  expect(first.cursor).toBe('page-two');
  const second = await store.galleryPage('images', first.cursor);
  expect(second.items[0].id).toBe('b'.repeat(64));
  expect(send.mock.calls[1][0].input).toMatchObject({Prefix:prefix, ContinuationToken:'page-two'});
});
it('finds completed original clips without requiring a current episode assignment', async () => {
  send.mockResolvedValueOnce({Contents:[{Key:`ai-video/wavespeed/v1/owner-a/jobs/${id}.json`}]});
  const store = new R2VideoStore('owner-a');
  vi.spyOn(store, 'read').mockResolvedValue({etag:'v1',job:{id,status:'COMPLETED',createdAt:'2026-10-11',duration:10,prompt:'An old unused version',archived:true} as VideoJob});
  const page = await store.galleryPage('videos');
  expect(page.items[0]).toMatchObject({id,archived:true,prompt:'An old unused version'});
});
it('archives a free-form completed video before saving, and preserves failed archive results for recovery', async () => {
  send.mockResolvedValue({});
  const store = new R2VideoStore('owner-a');
  const archive = vi.spyOn(store,'archiveVideo').mockResolvedValue();
  const job = {id,status:'COMPLETED',outputUrl:'https://provider.test/result.mp4'} as VideoJob;
  await store.save(job,'v1');
  expect(archive).toHaveBeenCalledWith(job);
  expect(JSON.parse(send.mock.calls[0][0].input.Body)).toMatchObject({archived:true,outputUrl:job.outputUrl});
  archive.mockRejectedValueOnce(new Error('storage unavailable'));
  await store.save(job,'v2');
  expect(JSON.parse(send.mock.calls[1][0].input.Body)).toMatchObject({status:'COMPLETED',outputUrl:job.outputUrl});
  expect(JSON.parse(send.mock.calls[1][0].input.Body).archived).not.toBe(true);
});
it('includes old intermediate and final MP4 assets while excluding audio', async () => {
  const prefix = 'ai-video/wavespeed/v1/owner-a/post-assets/';
  send.mockResolvedValue({Contents:[{Key:prefix+sha+'.mp4'},{Key:prefix+sha+'.wav'}]});
  const result = await new R2VideoStore('owner-a').galleryPage('edits');
  expect(result.items).toHaveLength(1);
  expect(result.items[0].url).toBe(`/api/ai-video/assets/${sha}?type=mp4`);
});
