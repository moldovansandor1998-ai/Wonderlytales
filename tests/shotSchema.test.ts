import { describe, it, expect } from "vitest";
import { validateShot } from "@/lib/schemas/shot";

const valid = {
  schema_version: "SHOT_SCHEMA_V1",
  shot_id: "11111111-1111-4111-8111-111111111111",
  episode_id: "22222222-2222-4222-8222-222222222222",
  scene_id: "33333333-3333-4333-8333-333333333333",
  shot_number: 1, duration_sec: 6,
  location: { location_id: "44444444-4444-4444-8444-444444444444", asset_id: "LOC_FOREST_V001", asset_version: "V001" },
  characters: [{ character_id: "55555555-5555-4555-8555-555555555555", asset_id: "CHAR_MARK_V001", asset_version: "V001", costume_id: "default", position: [0,0,0], rotation: [0,0,0] }],
  camera: { shot_type: "WIDE" },
};

describe("SHOT_SCHEMA_V1 validáció", () => {
  it("elfogadja a minimális érvényes shotot és defaultokat tölt", () => {
    const s = validateShot(valid);
    expect(s.status).toBe("DRAFT");
    expect(s.render.fps).toBe(24);
    expect(s.camera.movement).toBe("STATIC");
  });
  it("megőrzi a karakterpróba nézetet mentés és újraolvasás során", () => {
    const shot = validateShot({ ...valid, render: { visual_style: "STORYBOOK_DRAFT_V002" } });
    expect(validateShot(JSON.parse(JSON.stringify(shot))).render.visual_style).toBe("STORYBOOK_DRAFT_V002");
  });
  it("elutasítja a rossz schema_versiont", () => {
    expect(() => validateShot({ ...valid, schema_version: "V2" })).toThrow();
  });
  it("elutasítja a rossz asset_version formátumot", () => {
    const bad = structuredClone(valid);
    bad.characters[0].asset_version = "v1";
    expect(() => validateShot(bad)).toThrow();
  });
  it("elutasítja a 0 másodperces shotot", () => {
    expect(() => validateShot({ ...valid, duration_sec: 0 })).toThrow();
  });
});
