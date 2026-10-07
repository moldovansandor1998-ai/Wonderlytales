import { describe, it, expect } from "vitest";
import { execFile } from "child_process";
import { promisify } from "util";
import { promises as fs } from "fs";
import path from "path";
import { tmpdir } from "os";
import { validateShot } from "@/lib/schemas/shot";

const run = promisify(execFile);

describe("Blender worker fixture", () => {
  it("SH001/002/003 fixture ShotSchema-érvényes és kontinuus", async () => {
    const shots = [];
    for (const n of ["001","002","003"]) {
      const raw = JSON.parse(await fs.readFile(path.join(process.cwd(), "worker/fixtures", `shot_sh${n}.json`), "utf8"));
      shots.push(validateShot(raw));
    }
    expect(shots.map((s) => s.shot_number)).toEqual([1,2,3]);
    // continuity: a prop state DORMANT → GLOWING → ACTIVE
    expect(shots[0].props[0].state).toBe("DORMANT");
    expect(shots[1].props[0].state).toBe("GLOWING");
    expect(shots[2].props[0].state).toBe("ACTIVE");
    // ugyanaz a helyszín és karakter-asset végig
    expect(new Set(shots.map((s) => s.location.asset_id)).size).toBe(1);
    expect(shots[2].characters.length).toBeGreaterThan(shots[0].characters.length); // Morzsi csatlakozik
  });

  it("worker mock módban lefut python3-mal és result JSON-t ad", async () => {
    const out = path.join(tmpdir(), `wt-worker-${Math.random()}`);
    const { stdout } = await run("python3", [path.join(process.cwd(), "worker/blender_worker.py"), "--input", path.join(process.cwd(), "worker/fixtures/shot_sh001.json"), "--output", out, "--mock"], { timeout: 60000 });
    const line = stdout.split("\n").filter((l) => l.includes('"status"')).pop()!;
    const r = JSON.parse(line);
    expect(r.status).toBe("SUCCEEDED");
    expect(r.renderer).toBe("mock");
    expect(r.frames).toBeGreaterThan(0);
    expect(r.error).toBeNull();
    await fs.access(r.output);
  }, 90000);

  it("worker elutasítja a hibás fixture-t (schema validation)", async () => {
    const bad = path.join(tmpdir(), `wt-bad-${Math.random()}.json`);
    await fs.writeFile(bad, JSON.stringify({ schema_version: "WRONG" }));
    try {
      await run("python3", [path.join(process.cwd(), "worker/blender_worker.py"), "--input", bad, "--output", tmpdir(), "--mock"], { timeout: 60000 });
      expect.unreachable("a workernek hibával kell kilépnie");
    } catch (e) {
      const err = e as { code: number; stdout: string };
      expect(err.code).toBe(2);
      expect(err.stdout).toContain('"status": "FAILED"');
    }
  }, 90000);
});

describe("demo:e2e", () => {
  it("végigfut és valódi artifacteket gyárt", async () => {
    const { stdout } = await run(process.execPath, ["--import", "tsx", "scripts/demo-e2e.ts"], { cwd: process.cwd(), timeout: 400000 });
    expect(stdout).toContain("Demo kész");
    const report = JSON.parse(await fs.readFile(path.join(process.cwd(), "artifacts/demo/report.json"), "utf8"));
    expect(report.steps.length).toBeGreaterThan(10);
    expect(report.noReRenderForLocalization).toBe(true);
    // previews: 3 vizuálisan különböző shot
    for (const n of ["001","002","003"]) {
      const files = await fs.readdir(path.join(process.cwd(), "artifacts/demo/previews"));
      expect(files.some((f) => f.includes(`SH${n}`) || f.includes("11111111-1111-4111-8111-11111111111"))).toBe(true);
    }
    await fs.access(path.join(process.cwd(), "artifacts/demo/hu/master.mp4"));
    await fs.access(path.join(process.cwd(), "artifacts/demo/hu/subtitles.srt"));
    await fs.access(path.join(process.cwd(), "artifacts/demo/en/master.mp4"));
    // EN assembly ugyanazokból a klipekből (nincs újrarender)
    const enMeta = JSON.parse(await fs.readFile(path.join(process.cwd(), "artifacts/demo/en/metadata.json"), "utf8"));
    const huMeta = JSON.parse(await fs.readFile(path.join(process.cwd(), "artifacts/demo/hu/metadata.json"), "utf8"));
    expect(enMeta.clips.map((c: { path: string }) => c.path)).toEqual(huMeta.clips.map((c: { path: string }) => c.path));
  }, 420000);
});
