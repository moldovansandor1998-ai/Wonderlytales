import { describe, it, expect } from "vitest";
import { filmTargetDuration } from "@/lib/filmDuration";

describe("Film target duration", () => {
  it("defaults a missing target to 60 minutes", () => {
    for (const value of [null, undefined, ""]) expect(filmTargetDuration(value)).toBe(3600);
  });
  it("accepts the 40 minute minimum and longer targets", () => {
    expect(filmTargetDuration("2400")).toBe(2400);
    expect(filmTargetDuration(3600)).toBe(3600);
  });
  it("rejects short, fractional and invalid targets", () => {
    for (const value of [1320, 2399, -1, "NaN", Infinity, 2400.5]) {
      expect(() => filmTargetDuration(value)).toThrow("40 perc");
    }
  });
});
