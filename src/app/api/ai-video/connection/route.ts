import { NextRequest } from 'next/server';
import { access, apiError, json } from '@/lib/ai-video/http';
import { WaveSpeedClient } from '@/lib/providers/wavespeed';
import { getProductionBudget } from '@/lib/budget';
import { WAVESPEED_SERVICE, WAVESPEED_CEILING_USD } from '@/lib/ai-video/shared';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;
export async function GET(request: NextRequest) {
  try {
    await access(request);
    const configured = !!process.env.WAVESPEED_API_KEY?.trim();
    const [balance,budget] = await Promise.all([
      configured ? new WaveSpeedClient(process.env.WAVESPEED_API_KEY!).balance() : Promise.resolve(null),
      getProductionBudget(),
    ]);
    return json({ configured, connected: configured && balance !== null, balance,
      budget: budget ? { dailyLimit: budget.daily_limit_usd, remaining: budget.remaining_usd,
        reservationUsd: budget.configured_services[WAVESPEED_SERVICE] ?? 0,
        ready: budget.configured_services[WAVESPEED_SERVICE] === WAVESPEED_CEILING_USD } : null });
  } catch (e) { return apiError(e); }
}
