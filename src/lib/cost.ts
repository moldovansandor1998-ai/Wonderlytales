import type { CostEvent } from "./types";

export interface CostSummary {
  total: number; byCategory: Record<string, number>; byProvider: Record<string, number>;
  retryCost: number; byEpisode: Record<string, number>; currentMonth: number;
}

export function aggregateCosts(events: CostEvent[]): CostSummary {
  const s: CostSummary = { total: 0, byCategory: {}, byProvider: {}, retryCost: 0, byEpisode: {}, currentMonth: 0 };
  const month = new Date().toISOString().slice(0, 7);
  for (const e of events) {
    s.total += e.amount_usd;
    s.byCategory[e.category] = (s.byCategory[e.category] ?? 0) + e.amount_usd;
    s.byProvider[e.provider] = (s.byProvider[e.provider] ?? 0) + e.amount_usd;
    if (e.category === "RETRY") s.retryCost += e.amount_usd;
    if (e.episode_id) s.byEpisode[e.episode_id] = (s.byEpisode[e.episode_id] ?? 0) + e.amount_usd;
    if (e.created_at.startsWith(month)) s.currentMonth += e.amount_usd;
  }
  return s;
}

/** cost/minute: epizód tényleges költség / target perc */
export function costPerMinute(episodeCost: number, targetDurationSec: number): number {
  return targetDurationSec > 0 ? episodeCost / (targetDurationSec / 60) : 0;
}
