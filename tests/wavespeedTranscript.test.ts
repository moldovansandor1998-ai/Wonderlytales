import { expect,it,vi } from 'vitest';
import { checkSpeech } from '@/lib/ai-video/transcript';
import { WaveSpeedClient } from '@/lib/providers/wavespeed';
import { type VideoStore } from '@/lib/ai-video/storage';
import { type VideoJob } from '@/lib/ai-video/shared';
const initial:VideoJob={id:'88e0a917-c216-4450-b8ef-641f6d49f719',imageSha256:'a'.repeat(64),prompt:'Fox recovers and speaks Hungarian.',duration:10,sound:true,maxCostUsd:1.68,requestHash:'hash',model:'kling',status:'COMPLETED',createdAt:'2026-10-11',estimatedCostUsd:1.68,outputUrl:'https://cdn.example/video.mp4',mediaVerified:false,productionApproved:false};
function setup() {
  let job=structuredClone(initial),etag='1';
  const store:VideoStore={async read(){return {job:structuredClone(job),etag};},async claim(){return false;},async save(next,expected){if(expected!==etag)return false;job=structuredClone(next);etag=String(Number(etag)+1);return true;}};
  const reserve=vi.fn().mockResolvedValue(undefined);
  const api={transcriptionPrice:vi.fn().mockResolvedValue(0.021),balance:vi.fn().mockResolvedValue(8),transcribe:vi.fn().mockResolvedValue({id:'speech-1',status:'created'}),result:vi.fn().mockResolvedValue({id:'speech-1',status:'completed',outputs:[JSON.stringify({text:'Hűha! Ez aztán közel volt! Mi folyik itt ma?'})]})};
  return {store,reserve,api,run:()=>checkSpeech(initial.id,store,api as unknown as WaveSpeedClient,reserve)};
}
it('reserves and submits once; reads the actual transcript without another charge',async()=>{
  const t=setup();await t.run();expect(t.reserve).toHaveBeenCalledWith(0.021);
  const done=await t.run();expect(done.transcript?.text).toBe('Hűha! Ez aztán közel volt! Mi folyik itt ma?');
  await t.run();expect(t.api.transcribe).toHaveBeenCalledTimes(1);expect(t.reserve).toHaveBeenCalledTimes(1);expect(done.productionApproved).toBe(false);
});
it('concurrent speech checks cannot submit twice',async()=>{const t=setup();await Promise.all([t.run(),t.run()]);expect(t.api.transcribe).toHaveBeenCalledTimes(1);});
it('overpriced, unfunded or denied budget checks never submit',async()=>{
  const t=setup();t.api.transcriptionPrice.mockResolvedValue(0.031);await expect(t.run()).rejects.toThrow('PRICE_ABOVE_CEILING');
  t.api.transcriptionPrice.mockResolvedValue(0.021);t.api.balance.mockResolvedValue(0);await expect(t.run()).rejects.toThrow('BALANCE_LOW');
  t.api.balance.mockResolvedValue(1);t.reserve.mockRejectedValue(new Error('budget'));expect((await t.run()).transcript?.status).toBe('FAILED');expect(t.api.transcribe).not.toHaveBeenCalled();
});
it('uncertain speech submissions remain claimed',async()=>{
  const t=setup();t.api.transcribe.mockRejectedValue(new Error('lost response'));expect((await t.run()).transcript?.status).toBe('UNCERTAIN');await t.run();expect(t.api.transcribe).toHaveBeenCalledTimes(1);
});
