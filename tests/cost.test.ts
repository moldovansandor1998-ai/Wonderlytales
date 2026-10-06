import { describe, it, expect } from "vitest";
import { aggregateCosts, costPerMinute } from "@/lib/cost";
import type { CostEvent } from "@/lib/types";

const ev = (over: Partial<CostEvent>): CostEvent => ({ id: "1", project_id: null, series_id: null, episode_id: "e1", shot_id: null, category: "GPU", provider: "mock", amount_usd: 1, quantity: 1, unit: "gpu_sec", created_at: new Date().toISOString(), ...over });

describe("Cost aggregation", () => {
  it("összesítés kategóriánként", () => {
    const s = aggregateCosts([ev({}), ev({ amount_usd: 2 }), ev({ category: "TTS", amount_usd: 0.5 })]);
    expect(s.total).toBeCloseTo(3.5);
    expect(s.byCategory.GPU).toBeCloseTo(3);
    expect(s.byCategory.TTS).toBeCloseTo(0.5);
  });
  it("retry költség külön", () => {
    const s = aggregateCosts([ev({ category: "RETRY", amount_usd: 0.7 })]);
    expect(s.retryCost).toBeCloseTo(0.7);
  });
  it("aktuális hónap szűrés", () => {
    const s = aggregateCosts([ev({}), ev({ created_at: "2020-01-01T00:00:00Z", amount_usd: 5 })]);
    expect(s.currentMonth).toBeCloseTo(1);
  });
  it("cost/minute", () => { expect(costPerMinute(10, 600)).toBeCloseTo(1); expect(costPerMinute(10, 0)).toBe(0); });
});
