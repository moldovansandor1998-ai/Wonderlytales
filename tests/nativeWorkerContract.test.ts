import { afterEach, describe, expect, it, vi } from 'vitest';
import { NativeRenderWorker, VERIFIED_NATIVE_RENDERER_REVISION } from '@/lib/worker';
import { reserveProductionBudget } from '@/lib/budget';
import { fetchWithTimeout } from '@/lib/providers/translation';
import { validateShot } from '@/lib/schemas/shot';
import fixture from '../worker/fixtures/shot_sh001.json';

vi.mock('@/lib/budget', () => ({ reserveProductionBudget: vi.fn(async () => ({})) }));
vi.mock('@/lib/providers/translation', () => ({ fetchWithTimeout: vi.fn() }));
const native = {
  scene_key: 'native/S1E1/V024/test.blend', scene_sha256: 'a'.repeat(64),
  frame_start: 361, frame_end: 720, samples: 48,
};
const input = { native_scene: native, duration_sec: 15,
  render: { engine: 'BLENDER_CYCLES', fps: 24, width: 1920, height: 1080 } };
class Inspectable extends NativeRenderWorker {
  request(value: Record<string, unknown>) { return this.payload(value); }
  result(value: unknown) { return this.completed(value); }
}
afterEach(() => { vi.useRealTimers(); vi.clearAllMocks(); vi.unstubAllEnvs(); });
describe('native renderer provenance and budget contract', () => {
  it('retains and validates the immutable renderer revision in the shot schema', () => {
    const scene = { ...native, renderer_revision: VERIFIED_NATIVE_RENDERER_REVISION };
    expect(validateShot({ ...fixture, native_scene: scene }).native_scene).toEqual(scene);
    expect(() => validateShot({ ...fixture, native_scene: { ...scene, renderer_revision: 'latest' } })).toThrow();
  });
  it('includes the verified revision when the caller omits it', () => {
    vi.stubEnv('NATIVE_RENDERER_REVISION', VERIFIED_NATIVE_RENDERER_REVISION);
    const request = new Inspectable('endpoint', 'key').request(input);
    expect(request.renderer_revision).toBe(VERIFIED_NATIVE_RENDERER_REVISION);
    expect(request.frame_start).toBe(361);
    expect(request.frame_end).toBe(720);
  });
  it('rejects malformed revisions before reserving budget or submitting', async () => {
    await expect(new NativeRenderWorker('endpoint', 'key').submit({
      ...input, native_scene: { ...native, renderer_revision: 'latest' },
    }, 'PREVIEW')).rejects.toThrow(/revízió/);
    expect(reserveProductionBudget).not.toHaveBeenCalled();
    expect(fetchWithTimeout).not.toHaveBeenCalled();
  });
  it.each([
    { frame_start: 1, frame_end: 360 },
    { renderer_revision: 'b'.repeat(40) },
  ])('rejects a same-length render with different provenance: %j', async (mismatch) => {
    const worker = new Inspectable('endpoint', 'key');
    worker.request({ ...input, native_scene: { ...native, renderer_revision: VERIFIED_NATIVE_RENDERER_REVISION } });
    await expect(worker.result({
      status: 'RENDERED', source_sha256: native.scene_sha256,
      renderer_revision: VERIFIED_NATIVE_RENDERER_REVISION, frame_start: 361, frame_end: 720,
      frames: 360, fps: 24, native_frame_step: 1, width: 1920, height: 1080,
      outputs: Array.from({ length: 360 }, () => ({})), frame_seconds: Array(360).fill(1),
      clip: { key: 'renders/native/S1E1/' + native.scene_sha256 + '/clip.mp4',
        sha256: 'c'.repeat(64), bytes: 10, verified_frames: 360, verified_fps: 24,
        verified_width: 1920, verified_height: 1080 }, ...mismatch,
    })).rejects.toThrow(/nem egyezik/);
  });
  it('charges the native_render ceiling and transmits the required renderer revision', async () => {
    vi.useFakeTimers();
    vi.mocked(fetchWithTimeout)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ id: 'existing-test-job' }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'FAILED' }) } as Response);
    const pending = new NativeRenderWorker('endpoint', 'key').submit({
      ...input, native_scene: { ...native, renderer_revision: VERIFIED_NATIVE_RENDERER_REVISION },
    }, 'PREVIEW');
    await vi.advanceTimersByTimeAsync(5000);
    await expect(pending).resolves.toMatchObject({ status: 'FAILED' });
    expect(reserveProductionBudget).toHaveBeenCalledTimes(1);
    expect(reserveProductionBudget).toHaveBeenCalledWith('native_render');
    const options = vi.mocked(fetchWithTimeout).mock.calls[0][1]!;
    expect(JSON.parse(String(options.body)).input).toMatchObject({
      operation: 'RENDER_NATIVE_FRAMES', renderer_revision: VERIFIED_NATIVE_RENDERER_REVISION,
      frame_start: 361, frame_end: 720,
    });
  });
});
