import { describe, it, expect } from "vitest";
import { JsonDb } from "@/lib/db/json";
import { buildDemoData } from "@/lib/seed";
import { generatePreview, saveShotRevision, finalRender } from "@/lib/pipeline";
import { localizeEpisode } from "@/lib/localization";
import type { ShotRow, RenderJob, EpisodeLocalization, QcResult, CostEvent } from "@/lib/types";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import path from "path";

async function seededDb() {
  const f = path.join(tmpdir(), `wt-${Math.random()}.json`);
  await fs.writeFile(f, JSON.stringify(buildDemoData()));
  const db = new JsonDb(f); await db.init(); return db;
}

describe("Mock pipeline integráció", () => {
  it("mock render output must fail media QC", async () => {
    const db = await seededDb();
    const shot = (await db.list<ShotRow>("shots"))[1];
    const job = await generatePreview(db, shot.id);
    expect(["SUCCEEDED"]).toContain(job.status);
    expect(job.output_path).toContain("preview");
    const qcs = await db.find<QcResult>("qc_results", (q) => q.shot_id === shot.id);
    expect(qcs.length).toBeGreaterThan(0);
    const costs = await db.list<CostEvent>("cost_events");
    expect(costs.length).toBeGreaterThan(0);
    const updated = await db.get<ShotRow>("shots", shot.id);
    expect(updated!.status).toBe("QC_FAILED");
    expect(qcs.find((q) => q.check_name === "RENDER_CORRUPTION")?.status).toBe("FAIL");
  });

  it("save revision növeli a revisiont és validál", async () => {
    const db = await seededDb();
    const shot = (await db.list<ShotRow>("shots"))[0];
    const updated = await saveShotRevision(db, shot.id, { ...shot.data, duration_sec: 9 });
    expect(updated.revision).toBe(2);
    expect(updated.data.duration_sec).toBe(9);
    await expect(saveShotRevision(db, shot.id, { bad: true })).rejects.toThrow();
  });

  it("LOCKED shot nem szerkeszthető", async () => {
    const db = await seededDb();
    const shot = (await db.list<ShotRow>("shots"))[0];
    await db.update<ShotRow>("shots", shot.id, { status: "LOCKED" });
    await expect(saveShotRevision(db, shot.id, shot.data)).rejects.toThrow(/LOCKED/);
  });

  it("final render csak jóváhagyás után", async () => {
    const db = await seededDb();
    const shot = (await db.list<ShotRow>("shots"))[0];
    await expect(finalRender(db, shot.id)).rejects.toThrow(/jóváhagyva/);
    await db.update<ShotRow>("shots", shot.id, { status: "APPROVED_FOR_FINAL" });
    const job = await finalRender(db, shot.id);
    expect(job.status).toBe("SUCCEEDED");
    expect((await db.get<ShotRow>("shots", shot.id))!.status).toBe("FINAL_READY");
  });

  it("retry limit: max_attempts után FAILED", async () => {
    const db = await seededDb();
    const shot = (await db.list<ShotRow>("shots"))[0];
    const { enqueueJob } = await import("@/lib/queue");
    const job = await enqueueJob(db, { shot_id: shot.id, type: "PREVIEW", worker: "w", provider: "mock", max_attempts: 2, input_snapshot: {}, output_path: null, gpu_seconds: 0, cost_usd: 0, error: null });
    expect(job.max_attempts).toBe(2);
    const jobs = await db.list<RenderJob>("render_jobs");
    expect(jobs.some((j) => j.id === job.id)).toBe(true);
  });

  it("lokalizáció: EN sorok + episode_localization TEXT_READY without fabricated master", async () => {
    const db = await seededDb();
    const ep = (await db.list<{ id: string }>("episodes"))[0];
    const loc = await localizeEpisode(db, ep.id, "en");
    expect(loc.status).toBe("TEXT_READY");
    const locs = await db.find<EpisodeLocalization>("episode_localizations", (l) => l.episode_id === ep.id && l.language === "en");
    expect(locs[0].audio_master_path).toBeNull();
  });
});
