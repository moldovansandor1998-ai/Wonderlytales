import type {R2VideoStore} from './storage';
import {WaveSpeedError} from '../providers/wavespeed';

/** Retry only storage, never generation. Keep the provider result if archiving fails. */
export async function preserveVideo(store: R2VideoStore, id: string) {
  const saved = await store.read(id);
  if (!saved) throw new WaveSpeedError('JOB_NOT_FOUND', 404);
  if (saved.job.status !== 'COMPLETED' || saved.job.archived) return saved.job;
  await store.archiveVideo(saved.job);
  // Merge into the latest record, preserving concurrent analysis/transcript updates.
  for (let attempt = 0; attempt < 3; attempt++) {
    const current = await store.read(id);
    if (!current) throw new WaveSpeedError('JOB_NOT_FOUND', 404);
    if (current.job.archived) return current.job;
    const next = {...current.job, archived: true};
    if (await store.save(next, current.etag)) return next;
  }
  throw new WaveSpeedError('SCENE_CHANGED', 409);
}
