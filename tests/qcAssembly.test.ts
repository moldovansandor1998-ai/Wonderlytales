import { describe, it, expect } from "vitest";
import { JsonDb } from "@/lib/db/json";
import { buildDemoData } from "@/lib/seed";
import { runQc } from "@/lib/qc";
import { buildSrt, assembleEpisode, ffmpegAvailable } from "@/lib/assembly";
import type { ShotRow } from "@/lib/types";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import path from "path";

async function seededDb() {
  const f = path.join(tmpdir(), `wt-${Math.random()}.json`);
  await fs.writeFile(f, JSON.stringify(buildDemoData()));
  const db = new JsonDb(f); await db.init(); return db;
}

describe("Determinisztikus QC", () => {
  it("lockolt assetek → ASSET_VERSION PASS", async () => {
    const db = await seededDb();
    const shot = (await db.list<ShotRow>("shots"))[1];
    shot.data.qc.required_checks = ["ASSET_VERSION","LOCATION","PROP_CONTINUITY","COSTUME","CHARACTER"];
    const results = await runQc(db, shot, null, false);
    const av = results.find((r) => r.check_name === "ASSET_VERSION");
    expect(av!.status).toBe("PASS");
    const loc = results.find((r) => r.check_name === "LOCATION");
    expect(loc!.status).toBe("PASS");
    const prop = results.find((r) => r.check_name === "PROP_CONTINUITY");
    expect(prop!.status).toBe("PASS");
  });
  it("érvénytelen prop state → FAIL", async () => {
    const db = await seededDb();
    const shot = (await db.list<ShotRow>("shots"))[1];
    shot.data.props[0].state = "NEM_LETEZIK";
    shot.data.qc.required_checks = ["PROP_CONTINUITY"];
    const results = await runQc(db, shot, null, false);
    expect(results[0].status).toBe("FAIL");
    expect((await db.get<ShotRow>("shots", shot.id))!.status).toBe("QC_FAILED");
  });
});

describe("FFmpeg assembly", () => {
  it("SRT formátum", () => {
    const srt = buildSrt([{ start: 0, end: 2.5, text: "Szia!" }]);
    expect(srt).toContain("00:00:00,000 --> 00:00:02,500");
    expect(srt).toContain("Szia!");
  });
  it("assembly master + meta", async () => {
    const db = await seededDb();
    const ep = (await db.list<{ id: string }>("episodes"))[0];
    for (const sh of await db.list<ShotRow>("shots")) await db.update<ShotRow>("shots", sh.id, { status: "FINAL_READY" });
    const out = path.join(tmpdir(), `wt-asm-${Math.random()}`);
    const r = await assembleEpisode(db, ep.id, "hu", out, { mock: true }); // explicit mock mód a régi teszthez
    expect(r.durationSec).toBeGreaterThan(0);
    await fs.access(r.masterPath);
    await fs.access(r.subtitlePath);
    const meta = JSON.parse(await fs.readFile(r.metadataPath, "utf8"));
    expect((meta.clips ?? meta.shots).length).toBe(3);
    if (r.renderer === "ffmpeg") {
      const buf = await fs.readFile(r.masterPath);
      expect(buf.length).toBeGreaterThan(1000); // valódi MP4
    }
  }, 60000);
});
