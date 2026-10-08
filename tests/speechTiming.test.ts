import { describe, it, expect, vi } from 'vitest';
import { recordingTimingKey, reviewRecordedSpeech, validWordTimings } from '@/lib/speechTiming';
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
      revision:'scribe_v2_character_v1', audio_sha256:'wrong', expected_text:'Szia!', transcript:'Szia!', words:[]
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
