import { z } from 'zod';
import { fetchWithTimeout } from './translation';
import { NEGATIVE_PROMPT, WAVESPEED_MODEL, type VideoInput } from '../ai-video/shared';

const ROOT = 'https://api.wavespeed.ai/api/v3';
export class WaveSpeedError extends Error {
  constructor(public code: string, public httpStatus = 502) { super(code); }
}
export const videoInputSchema = z.object({
  id: z.string().uuid(), imageSha256: z.string().regex(/^[a-f0-9]{64}$/),
  endImageSha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  prompt: z.string().trim().min(10).max(2500), duration: z.union([z.literal(5), z.literal(10)]),
  sound: z.boolean(), maxCostUsd: z.number().finite().min(0).max(1.68),
}).strict();
export function waveSpeedPayload(req: VideoInput, image: string, endImage?: string) {
  videoInputSchema.parse(req);
  return { image, prompt: req.prompt, negative_prompt: NEGATIVE_PROMPT,
    duration: req.duration, sound: req.sound, cfg_scale: 0.5, shot_type: 'customize',
    ...(endImage ? { end_image: endImage } : {}) };
}
const taskSchema = z.object({ id: z.string().regex(/^[A-Za-z0-9_-]{1,160}$/),
  status: z.enum(['created', 'pending', 'queued', 'processing', 'running', 'completed', 'failed', 'cancelled', 'timeout', 'deleted']),
  outputs: z.array(z.string()).optional(), error: z.string().optional() });
export type WaveSpeedTask = z.infer<typeof taskSchema>;
export class WaveSpeedClient {
  constructor(private key: string) {
    if (!key.trim()) throw new WaveSpeedError('WAVESPEED_NOT_CONFIGURED', 503);
  }
  private async call(path: string, body?: unknown): Promise<unknown> {
    const r = await fetchWithTimeout(`${ROOT}/${path}`, {
      method: body ? 'POST' : 'GET', cache: 'no-store', redirect: 'error',
      headers: { Authorization: `Bearer ${this.key}`, 'Content-Type': 'application/json' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }, 20000);
    if (!r.ok) throw new WaveSpeedError(r.status === 401 || r.status === 403 ? 'WAVESPEED_AUTH_FAILED'
      : r.status === 402 ? 'WAVESPEED_BALANCE_LOW' : r.status === 429 ? 'WAVESPEED_RATE_LIMIT' : 'WAVESPEED_REQUEST_FAILED');
    const result = z.object({ code: z.number(), data: z.unknown() }).safeParse(await r.json());
    if (!result.success || result.data.code !== 200) throw new WaveSpeedError('WAVESPEED_REQUEST_FAILED');
    return result.data.data;
  }
  async balance(): Promise<number> {
    return z.object({ balance: z.number().finite().nonnegative() }).parse(await this.call('balance')).balance;
  }
  async price(inputs: ReturnType<typeof waveSpeedPayload>): Promise<number> {
    const quote = z.object({ model_id: z.literal(WAVESPEED_MODEL), currency: z.literal('USD'),
      discounted_price: z.number().finite().nonnegative() }).parse(await this.call('model/price', { model_id: WAVESPEED_MODEL, inputs }));
    return quote.discounted_price;
  }
  async submit(inputs: ReturnType<typeof waveSpeedPayload>): Promise<WaveSpeedTask> {
    // Deliberately no POST retries, including 429, timeouts and malformed responses.
    return taskSchema.parse(await this.call(WAVESPEED_MODEL, inputs));
  }
  async result(id: string): Promise<WaveSpeedTask> {
    if (!/^[A-Za-z0-9_-]{1,160}$/.test(id)) throw new WaveSpeedError('INVALID_TASK', 400);
    const task = taskSchema.parse(await this.call(`predictions/${id}/result`));
    if (task.id !== id) throw new WaveSpeedError('INVALID_TASK');
    return task;
  }
}
