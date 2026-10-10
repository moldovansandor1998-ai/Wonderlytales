import { describe, it, expect, vi } from 'vitest';
import { NativeRenderWorker, MockRenderWorker, getRenderWorker } from '@/lib/worker';
import { validateShot } from '@/lib/schemas/shot';
import fixture from '../worker/fixtures/shot_sh001.json';
import { JsonDb } from '@/lib/db/json';
import { buildDemoData } from '@/lib/seed';
import { runQc } from '@/lib/qc';
import type { ShotRow } from '@/lib/types';
import { promises as fs } from 'fs';
import path from 'path';
import { tmpdir } from 'os';

describe('native authored render dispatch', () => {
  it('rejects nonexistent native input before calling any paid provider', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch',fetch);
    try { await expect(new NativeRenderWorker('id','key').submit({},'PREVIEW')).rejects.toThrow(/Natív/); expect(fetch).not.toHaveBeenCalled(); }
    finally { vi.unstubAllGlobals(); }
  });
  it('keeps immutable scene provenance in the validated shot', () => {
    const native_scene={scene_key:'native/S1E1/V018/test.blend',scene_sha256:'a'.repeat(64),frame_start:1,frame_end:360,samples:128};
    expect(validateShot({...fixture,native_scene}).native_scene).toEqual(native_scene);
    expect(()=>validateShot({...fixture,native_scene:{...native_scene,frame_end:361}})).toThrow();
    expect(()=>validateShot({...fixture,native_scene:{...native_scene,scene_key:'native/S1E1/../test.blend'}})).toThrow();
  });
  it('requires a dedicated native endpoint instead of reusing the proxy endpoint', () => {
    vi.stubEnv('RENDER_WORKER','native-runpod'); vi.stubEnv('NATIVE_RUNPOD_ENDPOINT_ID','');
    try { expect(getRenderWorker).toThrow(/NATIVE_RUNPOD_ENDPOINT_ID/); }
    finally { vi.unstubAllEnvs(); }
  });
  it('never produces a fictional final movie', async () => {
    await expect(new MockRenderWorker().submit({},'FINAL')).rejects.toThrow(/végleges/);
  });
  it('cannot omit facial, motion and contact checks from native cinema QC', async () => {
    const file=path.join(tmpdir(),`wonderly-native-qc-${crypto.randomUUID()}.json`);
    try {
      await fs.writeFile(file,JSON.stringify(buildDemoData()));const db=new JsonDb(file);await db.init();
      const shot=(await db.list<ShotRow>('shots'))[0];
      shot.data.native_scene={scene_key:'native/S1E1/V018/test.blend',scene_sha256:'a'.repeat(64),frame_start:1,frame_end:120,samples:128};
      shot.data.qc.required_checks=['RENDER_CORRUPTION'];
      const result=await runQc(db,shot,null);
      for (const name of ['LIPSYNC','FACIAL_ANIMATION','BODY_ANIMATION','CLIPPING']) expect(result.find(r=>r.check_name===name)?.status).toBe('WARNING');
      expect((await db.get<ShotRow>('shots',shot.id))!.status).not.toBe('FINAL_READY');
    } finally { await fs.rm(file,{force:true}); }
  });
});
