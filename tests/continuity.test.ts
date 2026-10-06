import { describe, it, expect } from "vitest";
import { diffContinuity, stateFromShot } from "@/lib/continuity";
import type { ContinuityStateData } from "@/lib/types";

const base: ContinuityStateData = {
  characters: [{ character_id: "c1", present: true, costume_id: "default", emotion: "happy", held_object: null }],
  props: [{ prop_id: "p1", state: "CLOSED" }],
  environment: { time_of_day: "16:00", weather: "CLEAR", lighting_preset: "DAY", location_id: "loc1" },
  story_variables: {},
};

describe("Continuity diff", () => {
  it("első shotnál nincs warning", () => { expect(diffContinuity(null, base)).toEqual([]); });
  it("változatlan state: nincs warning", () => { expect(diffContinuity(base, structuredClone(base))).toEqual([]); });
  it("indokolatlan ruha-változásra warning", () => {
    const next = structuredClone(base); next.characters[0].costume_id = "winter";
    expect(diffContinuity(base, next).some((w) => w.field === "costume")).toBe(true);
  });
  it("prop state változásra warning", () => {
    const next = structuredClone(base); next.props[0].state = "OPEN";
    expect(diffContinuity(base, next).some((w) => w.field === "prop_state")).toBe(true);
  });
  it("helyszínváltás ERROR", () => {
    const next = structuredClone(base); next.environment.location_id = "loc2";
    expect(diffContinuity(base, next).some((w) => w.severity === "ERROR")).toBe(true);
  });
  it("stateFromShot shot adatból származtat", () => {
    const st = stateFromShot({ location: { location_id: "loc1" }, characters: [], props: [], lighting: { preset: "DAY", time_of_day: "12:00" } });
    expect(st.environment.location_id).toBe("loc1");
  });
});
