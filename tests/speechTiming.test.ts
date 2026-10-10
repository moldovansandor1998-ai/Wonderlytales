import { describe, it, expect, vi } from 'vitest';
import { recordingTimingKey, reviewRecordedSpeech, validWordTimings, validCharacterTimings, validateRecordedReview } from '@/lib/speechTiming';
import type { StorageProvider } from '@/lib/providers/storage';

describe('Recording-specific speech timing cache', () => {
  it('reuses a recorded review and only recognizes again when audio or script changes', async () => {
    const entries = new Map<string, Buffer>();
    const storage = {
      exists: async (key: string) => entries.has(key),
      get: async (key: string) => entries.get(key)!,
      put: async (key: string, value: string | Buffer) => { entries.set(key, Buffer.from(value)); },
    } as unknown as StorageProvider;
    const recognize = vi.fn().mockResolvedValue({ transcript: 'Szia!', language: 'hun', textMatches: true,
      hungarian: true, words: [{text:'Szia!',start:0.1,end:0.8,type:'word'}] });
    const first = await reviewRecordedSpeech(storage, Buffer.alloc(200, 1), 'Szia!', 'key', recognize);
    const again = await reviewRecordedSpeech(storage, Buffer.alloc(200, 1), 'Szia!', 'key', recognize);
    expect(again).toEqual(first);
    expect(recognize).toHaveBeenCalledTimes(1);
    expect(first).toMatchObject({ word_timings_valid:true, phoneme_alignment_verified:false, facial_animation_approved:false });
    await reviewRecordedSpeech(storage, Buffer.alloc(200, 2), 'Szia!', 'key', recognize);
    await reviewRecordedSpeech(storage, Buffer.alloc(200, 2), 'Szia, Lili!', 'key', recognize);
    expect(recognize).toHaveBeenCalledTimes(3);
  });
  it('does not accept a cache carrying the wrong source identity', async () => {
    const audio = Buffer.alloc(200, 1);
    const key = recordingTimingKey(audio, 'Szia!');
    const storage = {exists: async () => true, get: async () => Buffer.from(JSON.stringify({
      revision:'scribe_v2_character_v1', language:'hun', audio_sha256:'wrong', expected_text:'Szia!', transcript:'Szia!', words:[]
    }))} as unknown as StorageProvider;
    const recognize = vi.fn();
    await expect(reviewRecordedSpeech(storage, audio, 'Szia!', 'key', recognize)).rejects.toThrow('sérült');
    expect(recognize).not.toHaveBeenCalled();
    expect(key).toMatch(/^audio\/alignment\/hu\/[a-f0-9]{64}\.json$/);
  });
  it('rejects missing, reversed, non-finite and unordered timestamps', () => {
    expect(validWordTimings([])).toBe(false);
    expect(validWordTimings([{text:'a',start:1,end:0}])).toBe(false);
    expect(validWordTimings([{text:'a',start:NaN,end:1}])).toBe(false);
    expect(validWordTimings([{text:'a',start:1,end:2},{text:'b',start:0,end:1}])).toBe(false);
    expect(validWordTimings([{text:'a',start:0,end:0.5},{text:' ',start:0.5,end:0.7}])).toBe(true);
  });
});

describe('Character alignment validation', () => {
  const words = [{type:'word',text:'gyú',start:.1,end:.4,characters:[
    {text:'g',start:.1,end:.2},{text:'y',start:.2,end:.3},{text:'ú',start:.3,end:.4}]}];
  it('requires full character coverage and disjoint measured intervals', () => {
    expect(validCharacterTimings(words,'gyú!')).toBe(true);
    expect(validCharacterTimings([{...words[0],characters:words[0].characters.slice(1)}],'gyú')).toBe(false);
    expect(validCharacterTimings([{...words[0],characters:[{text:'g',start:.1,end:.3},...words[0].characters.slice(1)]}],'gyú')).toBe(false);
    expect(validCharacterTimings(words,'más')).toBe(false);
    expect(validWordTimings([{text:'a',start:0,end:1},{text:'b',start:.5,end:2}])).toBe(false);
  });
  it('recomputes forged cached approvals without paying again', async () => {
    const audio=Buffer.alloc(200,3);
    const storage={exists:async()=>false,put:async()=>{}} as unknown as StorageProvider;
    const recognize=vi.fn().mockResolvedValue({transcript:'más',language:'eng',textMatches:true,hungarian:true,words});
    const result=await reviewRecordedSpeech(storage,audio,'gyú','key',recognize);
    expect(result).toMatchObject({textMatches:false,hungarian:false,usable_for_lipsync:false});
    const checked=validateRecordedReview({...result,transcript:'gyú',language:'hun',facial_animation_approved:true},audio,'gyú');
    expect(checked).toMatchObject({usable_for_lipsync:true,facial_animation_approved:false,phoneme_alignment_verified:false});
  });
});

describe('Hungarian multi-letter sound timing',()=>{
 it('keeps measured ny and doubled t boundaries but rejects missing standalone speech',()=>{
  const word=(text:string,characters:any[])=>[{type:'word',text,start:0,end:.2,characters}];
  expect(validCharacterTimings(word('ny',[{text:'n',start:0,end:0},{text:'y',start:0,end:.2}]),'ny')).toBe(true);
  expect(validCharacterTimings(word('tt',[{text:'t',start:0,end:.2},{text:'t',start:.2,end:.2}]),'tt')).toBe(true);
  expect(validCharacterTimings(word('ny',[{text:'n',start:0,end:0},{text:'y',start:0,end:0}]),'ny')).toBe(false);
  expect(validCharacterTimings(word('a',[{text:'a',start:0,end:0}]),'a')).toBe(false);
 });
});
