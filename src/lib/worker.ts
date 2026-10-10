import { reserveProductionBudget } from "./budget";
import { requireConfiguration, rejectProductionMock } from "./config";
/** Render worker adapterek: MockRenderWorker (helyben) + RemoteRenderWorker (RunPod serverless) */
import { fetchWithTimeout } from "./providers/translation";
import { getPricing } from "./pricing";

export interface WorkerResult { status: "SUCCEEDED"|"FAILED"|"CANCELLED"; output: string | null; frames: number; durationSec: number; renderSec: number; gpuSec: number; renderer: string; error: string | null; }
export interface RenderWorker {
  name: string;
  submit(inputSnapshot: Record<string, unknown>, type: "PREVIEW"|"FINAL"): Promise<WorkerResult>;
  cancel(jobId: string): Promise<void>;
}

export class MockRenderWorker implements RenderWorker {
  name = "mock-worker";
  async submit(input: Record<string, unknown>, type: "PREVIEW"|"FINAL"): Promise<WorkerResult> {
    if (type === "FINAL") throw new Error("Mock worker nem készíthet végleges filmet.");
    const shot = input as { shot_id?: string; revision?: number; duration_sec?: number; render?: { fps?: number } };
    const fps = shot.render?.fps ?? 24;
    const durationSec = shot.duration_sec ?? 5;
    const gpuSec = 0;
    return { status: "SUCCEEDED", output: `renders/${shot.shot_id}/${type.toLowerCase()}_r${shot.revision ?? 1}.mp4`, frames: Math.round(durationSec * fps), durationSec, renderSec: gpuSec / 4, gpuSec, renderer: "mock", error: null };
  }
  async cancel(): Promise<void> {}
}

/** RemoteRenderWorker: RunPod Serverless endpoint hívás – submit, poll, timeout, retry, cancel */
export class RemoteRenderWorker implements RenderWorker {
  name = "runpod";
  constructor(private endpointId: string, private apiKey: string, private timeoutMs = 15 * 60 * 1000) {}
  private base() { return `https://api.runpod.ai/v2/${this.endpointId}`; }
  protected payload(input: Record<string, unknown>, type: "PREVIEW"|"FINAL"): Record<string, unknown> { return { shot: input, type }; }
  protected async completed(output: unknown): Promise<WorkerResult> { return { ...(output as WorkerResult), renderer: "runpod" }; }

  async submit(input: Record<string, unknown>, type: "PREVIEW"|"FINAL"): Promise<WorkerResult> {
    const payload = this.payload(input, type);
    await reserveProductionBudget("runpod");
    const submit = await fetchWithTimeout(`${this.base()}/run`, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ input: payload }),
    }, 30000);
    if (!submit.ok) throw new Error(`RunPod submit hiba: HTTP ${submit.status} ${(await submit.text().catch(()=>"")).slice(0,200)}`);
    const job = await submit.json() as { id: string };
    const deadline = Date.now() + this.timeoutMs;
    while (Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 5000));
      const st = await fetchWithTimeout(`${this.base()}/status/${job.id}`, { headers: { Authorization: `Bearer ${this.apiKey}` } }, 15000);
      if (!st.ok) continue;
      const data = await st.json() as { status: string; output?: WorkerResult; executionTime?: number };
      if (data.status === "COMPLETED" && data.output) return this.completed(data.output);
      if (["FAILED","CANCELLED"].includes(data.status)) return { status: data.status === "FAILED" ? "FAILED" : "CANCELLED", output: null, frames: 0, durationSec: 0, renderSec: 0, gpuSec: (data.executionTime ?? 0) / 1000, renderer: "runpod", error: `RunPod job ${data.status}` };
    }
    await this.cancel(job.id).catch(() => {});
    throw new Error("RunPod timeout – job lemondva");
  }

  async cancel(jobId: string): Promise<void> {
    await fetchWithTimeout(`${this.base()}/cancel/${jobId}`, { method: "POST", headers: { Authorization: `Bearer ${this.apiKey}` } }, 15000);
  }
}

/** Existing native GPU handler: immutable authored .blend, actual 24 fps frames. */
export class NativeRenderWorker extends RemoteRenderWorker {
  name = "native-runpod";
  private expected: { digest: string; frames: number; width: number; height: number } | null = null;
  protected payload(input: Record<string, unknown>): Record<string, unknown> {
    const native = input.native_scene as { scene_key?: string; scene_sha256?: string; frame_start?: number; frame_end?: number; samples?: number } | undefined;
    const render = input.render as { width?: number; height?: number; fps?: number; engine?: string } | undefined;
    if (!native || !/^native\/S1E1\/[A-Za-z0-9_./-]+\.blend$/.test(native.scene_key ?? '') || native.scene_key!.includes('..') || !/^[a-f0-9]{64}$/.test(native.scene_sha256 ?? '')) throw new Error("Natív jelenet és SHA-256 szükséges.");
    const a=native.frame_start!, b=native.frame_end!, frames=b-a+1;
    if (!Number.isInteger(a) || !Number.isInteger(b) || a<1 || frames<1 || frames>360) throw new Error("Natív munkánként 1–360 képkocka szükséges.");
    if (render?.engine !== 'BLENDER_CYCLES' || render.fps !== 24 || ![[1920,1080],[2560,1440],[3840,2160]].some(([w,h]) => w===render.width && h===render.height)) throw new Error("A natív worker Cycles, legalább Full HD, 24 fps képet készít.");
    if (typeof input.duration_sec !== 'number' || Math.abs(input.duration_sec-frames/24)>1/48) throw new Error("A jelenet képkockaszáma és időtartama eltér.");
    const samples=native.samples ?? 128;
    if (!Number.isInteger(samples) || samples<48 || samples>512) throw new Error("Natív render: 48–512 sample szükséges.");
    this.expected={digest:native.scene_sha256!,frames,width:render.width!,height:render.height!};
    return {operation:'RENDER_NATIVE_FRAMES',...native,width:render.width,height:render.height,samples};
  }
  protected async completed(output: unknown): Promise<WorkerResult> {
    const r=output as {status?:string;source_sha256?:string;frames?:number;fps?:number;native_frame_step?:number;width?:number;height?:number;frame_seconds?:number[];outputs?:unknown[];clip?:{key:string;sha256:string;bytes:number;verified_frames:number;verified_fps:number;verified_width:number;verified_height:number}};
    const e=this.expected, clip=r.clip;
    if (!e || r.status!=='RENDERED' || r.source_sha256!==e.digest || r.frames!==e.frames || r.fps!==24 || r.native_frame_step!==1 || r.width!==e.width || r.height!==e.height || r.outputs?.length!==e.frames || !clip || !clip.key.startsWith(`renders/native/S1E1/${e.digest}/`) || !/^[a-f0-9]{64}$/.test(clip.sha256) || clip.verified_frames!==e.frames || clip.verified_fps!==24 || clip.verified_width!==e.width || clip.verified_height!==e.height) throw new Error("A natív render eredménye hiányos vagy nem egyezik a kért jelenettel.");
    const {getStorage}=await import('./providers/storage'); const {createHash}=await import('crypto');
    const bytes=await getStorage().get(clip.key);
    if (bytes.length!==clip.bytes || createHash('sha256').update(bytes).digest('hex')!==clip.sha256) throw new Error("A tárolt natív videó ellenőrzőösszege eltér.");
    if (!Array.isArray(r.frame_seconds) || r.frame_seconds.length!==e.frames || r.frame_seconds.some(v => !Number.isFinite(v) || v<0)) throw new Error("Érvénytelen renderidő-mérés.");
    const seconds=r.frame_seconds.reduce((a,b)=>a+b,0);
    return {status:'SUCCEEDED',output:clip.key,frames:e.frames,durationSec:e.frames/24,renderSec:seconds,gpuSec:seconds,renderer:'blender-cycles-native',error:null};
  }
}

export function getRenderWorker(): RenderWorker {
  if (process.env.RENDER_WORKER === "native-runpod") {
    requireConfiguration("Natív Blender", ["RUNPOD_API_KEY", "NATIVE_RUNPOD_ENDPOINT_ID"]);
    return new NativeRenderWorker(process.env.NATIVE_RUNPOD_ENDPOINT_ID!, process.env.RUNPOD_API_KEY!);
  }
  if (process.env.RENDER_WORKER === "runpod") {
    requireConfiguration("RunPod", ["RUNPOD_API_KEY", "RUNPOD_ENDPOINT_ID"]);
    return new RemoteRenderWorker(process.env.RUNPOD_ENDPOINT_ID!, process.env.RUNPOD_API_KEY!);
  }
  rejectProductionMock("Render worker");
  return new MockRenderWorker();
}
export function gpuCost(gpuSec: number): number { return gpuSec * getPricing().gpuPerSec; }
