import { describe, it, expect } from "vitest";
import { JsonDb } from "@/lib/db/json";
import { buildDemoData } from "@/lib/seed";
import { localizeEpisode } from "@/lib/localization";
import type { DialogueLine, LocalizedLine } from "@/lib/types";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import path from "path";

describe("Localization integritás", () => {
  it("master dialogue érintetlen marad + külön localized rekordok", async () => {
    const f = path.join(tmpdir(), `wt-${Math.random()}.json`);
    await fs.writeFile(f, JSON.stringify(buildDemoData()));
    const db = new JsonDb(f); await db.init();
    const ep = (await db.list<{ id: string }>("episodes"))[0];
    const before = await db.list<DialogueLine>("dialogue_lines");
    await localizeEpisode(db, ep.id, "en");
    const after = await db.list<DialogueLine>("dialogue_lines");
    expect(after.map((l) => [l.id, l.text])).toEqual(before.map((l) => [l.id, l.text])); // master nem változott
    const locs = await db.list<LocalizedLine>("localized_dialogue_lines");
    expect(locs.length).toBe(before.length);
    expect(locs.every((l) => l.language === "en" && l.status === "READY")).toBe(true);
  });
});
