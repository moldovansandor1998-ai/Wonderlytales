import { WaveSpeedClient, WaveSpeedError } from '../providers/wavespeed';
import { getProductionBudget, reserveProductionBudget } from '../budget';
import { isProduction } from '../config';
import type { VideoStore } from './storage';
import type { VideoJob } from './shared';
import { fetchWithTimeout } from '../providers/translation';
export async function reserveTranscriptBudget(cost: number) {
  if (!isProduction()) throw new WaveSpeedError('PRODUCTION_BUDGET_REQUIRED');
  const b=await getProductionBudget();
  if (b?.configured_services.wavespeed_transcript !== 0.03 || cost > 0.03) throw new WaveSpeedError('BUDGET_NOT_CONFIGURED');
  await reserveProductionBudget('wavespeed_transcript');
}
function transcriptText(value: unknown): string {
  if (typeof value === 'string') {
    try { return transcriptText(JSON.parse(value)); } catch { return value.slice(0,10000); }
  }
  if (!value || typeof value !== 'object') throw new WaveSpeedError('INVALID_TRANSCRIPT');
  const v=value as Record<string,unknown>;
  if (typeof v.text === 'string') return v.text.slice(0,10000);
  if (typeof v.transcription === 'string') return v.transcription.slice(0,10000);
  if (Array.isArray(v.segments)) return v.segments.map(x => typeof x?.text === 'string' ? x.text : '').join(' ').slice(0,10000);
  throw new WaveSpeedError('INVALID_TRANSCRIPT');
}
async function resolveText(output?: string): Promise<string> {
  if (output === undefined) throw new WaveSpeedError('MISSING_TRANSCRIPT');
  if (!output.startsWith('https://')) return transcriptText(output);
  const u=new URL(output);
  if (u.username || u.password || u.port || !['cloudfront.net','wavespeed.ai','wavespeed.net'].some(d=>u.hostname.endsWith(`.${d}`)))
    throw new WaveSpeedError('INVALID_TRANSCRIPT_URL');
  const r=await fetchWithTimeout(output,{redirect:'error',cache:'no-store'},15000);
  if(!r.ok || Number(r.headers.get('content-length') ?? 0)>1000000) throw new WaveSpeedError('INVALID_TRANSCRIPT');
  const text=await r.text();if(text.length>1000000)throw new WaveSpeedError('INVALID_TRANSCRIPT');
  return transcriptText(text);
}
export async function checkSpeech(id: string, store: VideoStore, api: WaveSpeedClient,
  reserve=reserveTranscriptBudget): Promise<VideoJob> {
  const saved=await store.read(id);
  if(saved?.job.status!=='COMPLETED' || !saved.job.outputUrl)throw new WaveSpeedError('JOB_NOT_FOUND',404);
  let job=saved.job;
  if(job.transcript) {
    if(job.transcript.status!=='PROCESSING' || !job.transcript.taskId)return job;
    const task=await api.result(job.transcript.taskId);
    if(task.status==='completed') job={...job,transcript:{...job.transcript,status:'COMPLETED',text:await resolveText(task.outputs?.[0])}};
    else if(['failed','cancelled','timeout','deleted'].includes(task.status))job={...job,transcript:{...job.transcript,status:'FAILED'}};
    else return job;
    if(!await store.save(job,saved.etag)) return (await store.read(id))!.job;
    return job;
  }
  const [price,balance]=await Promise.all([api.transcriptionPrice(job.outputUrl!),api.balance()]);
  if(price>0.03)throw new WaveSpeedError('PRICE_ABOVE_CEILING',409);
  if(balance<price)throw new WaveSpeedError('WAVESPEED_BALANCE_LOW',409);
  job={...job,transcript:{status:'SUBMITTING',estimatedCostUsd:price}};
  if(!await store.save(job,saved.etag))return (await store.read(id))!.job;
  const claimed=await store.read(id);
  if(!claimed)throw new WaveSpeedError('JOB_STATE_UNCERTAIN');
  try {await reserve(price);} catch {
    job={...job,transcript:{...job.transcript!,status:'FAILED'}};
    await store.save(job,claimed.etag);return job;
  }
  try {
    const task=await api.transcribe(job.outputUrl!);
    job={...job,transcript:{...job.transcript!,status:'PROCESSING',taskId:task.id}};
    if(!await store.save(job,claimed.etag))throw new Error('Uncertain save');
    return job;
  } catch {
    const latest=await store.read(id);
    if(latest?.job.transcript?.taskId)return latest.job;
    job={...job,transcript:{...job.transcript!,status:'UNCERTAIN'}};
    if(latest)await store.save(job,latest.etag);
    return job;
  }
}
