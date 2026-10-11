import { getProductionBudget, reserveProductionBudget } from '../budget';
import { isProduction } from '../config';
import { WaveSpeedClient, WaveSpeedError, waveSpeedPayload, videoInputSchema, type WaveSpeedTask } from '../providers/wavespeed';
import { digest, type VideoStore } from './storage';
import { WAVESPEED_MODEL, WAVESPEED_SERVICE, WAVESPEED_CEILING_USD, TERMINAL_STATUSES, type VideoJob, type VideoInput } from './shared';

export async function reserveWaveSpeedBudget(estimate: number) {
  if (!isProduction()) throw new WaveSpeedError('PRODUCTION_BUDGET_REQUIRED', 503);
  const budget = await getProductionBudget();
  const ceiling = budget?.configured_services[WAVESPEED_SERVICE];
  if (!ceiling || ceiling < estimate || ceiling > WAVESPEED_CEILING_USD)
    throw new WaveSpeedError('BUDGET_NOT_CONFIGURED',503);
  await reserveProductionBudget(WAVESPEED_SERVICE);
}
function applyTask(job: VideoJob, task: WaveSpeedTask): VideoJob {
  const updated = { ...job, taskId: task.id };
  if (task.status === 'completed') {
    const url = task.outputs?.[0];
    if (!url) throw new WaveSpeedError('MISSING_VIDEO');
    const u = new URL(url);
    if (u.protocol !== 'https:' || u.username || u.password) throw new WaveSpeedError('INVALID_VIDEO_URL');
    return { ...updated, status: 'COMPLETED', outputUrl: url, error: undefined };
  }
  if (['failed','cancelled','timeout','deleted'].includes(task.status)) {
    return { ...updated, status: task.status === 'cancelled' ? 'CANCELLED' : 'FAILED', error: 'A WaveSpeed nem készített el videót. Új próbához külön generálás szükséges.' };
  }
  return { ...updated, status: ['running','processing'].includes(task.status) ? 'RUNNING' : 'QUEUED' };
}
export class WaveSpeedVideoService {
  constructor(private api: WaveSpeedClient, private store: VideoStore,
    private imageUrl: (sha: string) => Promise<string>,
    private reserve: (cost: number) => Promise<void> = reserveWaveSpeedBudget) {}
  private async payload(input: VideoInput) {
    const [start,end] = await Promise.all([this.imageUrl(input.imageSha256), input.endImageSha256 ? this.imageUrl(input.endImageSha256) : Promise.resolve(undefined)]);
    return waveSpeedPayload(input, start, end);
  }
  async quote(input: VideoInput) {
    videoInputSchema.parse(input);
    const payload = await this.payload(input);
    const [price, balance] = await Promise.all([this.api.price(payload), this.api.balance()]);
    if (price > WAVESPEED_CEILING_USD) throw new WaveSpeedError('PRICE_ABOVE_CEILING',409);
    return { price, balance, currency: 'USD', reservationUsd: WAVESPEED_CEILING_USD };
  }
  async submit(raw: VideoInput): Promise<VideoJob> {
    const input = videoInputSchema.parse(raw);
    const requestHash = digest(JSON.stringify({ ...input, id: undefined, model: WAVESPEED_MODEL }));
    const old = await this.store.read(input.id);
    if (old) {
      if (old.job.requestHash !== requestHash) throw new WaveSpeedError('JOB_ALREADY_EXISTS',409);
      return old.job;
    }
    const payload = await this.payload(input);
    const [price,balance] = await Promise.all([this.api.price(payload),this.api.balance()]);
    if (price > input.maxCostUsd || price > WAVESPEED_CEILING_USD) throw new WaveSpeedError('PRICE_CHANGED',409);
    if (balance < price) throw new WaveSpeedError('WAVESPEED_BALANCE_LOW',409);
    let job: VideoJob = { ...input, requestHash, model: WAVESPEED_MODEL, createdAt: new Date().toISOString(),
      status: 'SUBMITTING', estimatedCostUsd: price, mediaVerified: false, productionApproved: false };
    if (!await this.store.claim(job)) {
      const saved = await this.store.read(input.id);
      if (!saved || saved.job.requestHash !== requestHash) throw new WaveSpeedError('JOB_ALREADY_EXISTS',409);
      return saved.job;
    }
    const claimed = await this.store.read(input.id);
    if (!claimed) throw new WaveSpeedError('JOB_STATE_UNCERTAIN',409);
    try { await this.reserve(price); }
    catch {
      job = { ...job, status: 'BLOCKED_BUDGET', error: 'A napi keret vagy a szolgáltatás költségplafonja nem engedi a generálást.' };
      await this.store.save(job,claimed.etag);
      return job;
    }
    try {
      const task = await this.api.submit(payload);
      job = { ...job, taskId: task.id };
      job = applyTask(job,task);
      if (!await this.store.save(job,claimed.etag)) throw new WaveSpeedError('JOB_STATE_UNCERTAIN');
      return job;
    } catch (error) {
      // The permanent claim remains even if the provider response or storage write was lost.
      // Never automatically resubmit and never return provider response bodies or credentials.
      const saved = await this.store.read(input.id);
      if (saved?.job.taskId) return saved.job;
      job = { ...job, taskId: job.taskId ?? (error instanceof WaveSpeedError ? error.taskId : undefined), status: 'SUBMISSION_UNCERTAIN', error: 'A kérés kimenetele bizonytalan. Nincs automatikus újraküldés; ellenőrizd a WaveSpeed előzményeket.' };
      if (saved) await this.store.save(job,saved.etag);
      return job;
    }
  }
  async poll(id: string): Promise<VideoJob> {
    const saved = await this.store.read(id);
    if (!saved) throw new WaveSpeedError('JOB_NOT_FOUND',404);
    const job = saved.job;
    if (TERMINAL_STATUSES.includes(job.status) && job.status !== 'SUBMISSION_UNCERTAIN') return job;
    if (!job.taskId) return job;
    const result = applyTask(job,await this.api.result(job.taskId));
    // A late poll cannot replace a newer (especially terminal) state.
    if (!await this.store.save(result,saved.etag)) return (await this.store.read(id))!.job;
    return result;
  }
}
