import { NextRequest, NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { requireStudioUser } from '../auth';
import { WaveSpeedClient, WaveSpeedError } from '../providers/wavespeed';
import { R2VideoStore } from './storage';
import { WaveSpeedVideoService } from './service';

export async function access(request: NextRequest, write = false) {
  const user = await requireStudioUser();
  if (write && request.headers.get('origin') !== request.nextUrl.origin) throw new WaveSpeedError('INVALID_ORIGIN',403);
  return user;
}
export function videoService(store: R2VideoStore) {
  return new WaveSpeedVideoService(new WaveSpeedClient(process.env.WAVESPEED_API_KEY ?? ''),store,sha => store.imageUrl(sha));
}
export const json = (value: unknown, status = 200) => NextResponse.json(value,{ status, headers: { 'Cache-Control': 'private, no-store' } });
export async function readJson(request: NextRequest) {
  if (Number(request.headers.get('content-length') ?? 0) > 12000) throw new WaveSpeedError('INVALID_INPUT',400);
  const text = await request.text();
  if (text.length > 12000) throw new WaveSpeedError('INVALID_INPUT',400);
  try { return JSON.parse(text); } catch { throw new WaveSpeedError('INVALID_INPUT',400); }
}
export function apiError(error: unknown) {
  if (error instanceof WaveSpeedError) return json({ error: error.code },error.httpStatus);
  if (error instanceof ZodError) return json({ error: 'INVALID_INPUT' },400);
  if (error instanceof Error && ['UNAUTHORIZED','FORBIDDEN'].includes(error.message)) return json({ error: error.message }, error.message === 'UNAUTHORIZED' ? 401 : 403);
  return json({ error: 'VIDEO_SERVICE_UNAVAILABLE' },503);
}
