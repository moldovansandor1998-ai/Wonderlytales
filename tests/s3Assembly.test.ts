import { describe, it, expect } from "vitest";
import { S3StorageProvider } from "@/lib/providers/storage";
import { assembleClips, generateTestClip, probeFile, ffmpegAvailable } from "@/lib/assembly";
import { createServer, type Server } from "http";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import path from "path";

/** Minimális S3-kompatibilis mock szerver (forcePathStyle: /bucket/key) */
function mockS3(): { server: Server; store: Map<string, Buffer>; port: () => number } {
  const store = new Map<string, Buffer>();
  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://x");
    const m = url.pathname.match(/^\/([^/]+)\/(.+)$/);
    const key = m ? m[2] : url.pathname.replace(/^\//, "");
    if (req.method === "PUT") {
      const chunks: Buffer[] = [];
      req.on("data", (c) => chunks.push(c));
      req.on("end", () => { store.set(key, Buffer.concat(chunks)); res.writeHead(200, { ETag: '"x"' }); res.end(); });
    } else if (req.method === "GET") {
      const d = store.get(key);
      if (d) { res.writeHead(200); res.end(d); } else { res.writeHead(404); res.end(); }
    } else if (req.method === "HEAD") {
      res.writeHead(store.has(key) ? 200 : 404); res.end();
    } else if (req.method === "DELETE") {
      store.delete(key); res.writeHead(204); res.end();
    } else { res.writeHead(400); res.end(); }
  });
  return { server, store, port: () => (server.address() as { port: number }).port };
}

describe("S3/R2 adapter mock HTTP szerverrel", () => {
  it("put/get/exists/delete teljes kör", async () => {
    const { server } = mockS3();
    await new Promise<void>((r) => server.listen(0, r));
    const port = (server.address() as { port: number }).port;
    const s3 = new S3StorageProvider(`http://127.0.0.1:${port}`, "bucket", "ak", "sk");
    const meta = await s3.put("shots/sh001/r1/preview.mp4", Buffer.from("fake-video-data"), "video/mp4", { shot: "sh001" });
    expect(meta.sha256).toHaveLength(64);
    expect(meta.mime).toBe("video/mp4");
    expect(await s3.exists("shots/sh001/r1/preview.mp4")).toBe(true);
    expect((await s3.get("shots/sh001/r1/preview.mp4")).toString()).toBe("fake-video-data");
    expect(await s3.exists("nincs.mp4")).toBe(false);
    await s3.delete("shots/sh001/r1/preview.mp4");
    expect(await s3.exists("shots/sh001/r1/preview.mp4")).toBe(false);
    server.close();
  }, 20000);
});

describe("FFmpeg REAL concat integration", () => {
  it("3 különböző clip → normalize → concat → ffprobe validáció", async () => {
    if (!(await ffmpegAvailable())) { console.warn("FFmpeg hiányzik – skip"); return; }
    const dir = path.join(tmpdir(), `wt-concat-${Math.random()}`);
    await fs.mkdir(dir, { recursive: true });
    // 3 rövid, különböző test clip (különböző szín, hossz, forrás-fps)
    const clips: { shotNumber: number; path: string; dur: number }[] = [];
    const specs = [{ n: 1, dur: 2, color: "0x8b0000", fps: 24 }, { n: 2, dur: 3, color: "0x004d00", fps: 30 }, { n: 3, dur: 2.5, color: "0x00008b", fps: 24 }];
    for (const sp of specs) {
      const p = path.join(dir, `src_${sp.n}.mp4`);
      await generateTestClip(p, { durationSec: sp.dur, color: sp.color, label: `TEST_${sp.n}` });
      clips.push({ shotNumber: sp.n, path: p, dur: sp.dur });
    }
    const totalDur = specs.reduce((a, s) => a + s.dur, 0);
    const result = await assembleClips({ clips, cues: [{ start: 0.5, end: 1.5, text: "Teszt felirat" }], outDir: path.join(dir, "out"), title: "concat-test" });
    expect(result.clipCount).toBe(3);
    const probe = await probeFile(result.masterPath);
    expect(probe.width).toBe(1920);
    expect(probe.height).toBe(1080);
    expect(Math.abs(probe.fps - 24)).toBeLessThan(0.5);
    expect(probe.videoCodec).toBe("h264");
    // mindhárom clip bekerült: a master duration ≈ a klipek összege
    expect(Math.abs(probe.durationSec - totalDur)).toBeLessThan(1.0);
    // subtitle + metadata
    const srt = await fs.readFile(result.subtitlePath, "utf8");
    expect(srt).toContain("Teszt felirat");
    const meta = JSON.parse(await fs.readFile(result.metadataPath, "utf8"));
    expect(meta.clips.length).toBe(3);
    await fs.rm(dir, { recursive: true, force: true });
  }, 120000);

  it("hiányzó input → production módban FAIL (nincs csendes placeholder)", async () => {
    if (!(await ffmpegAvailable())) return;
    const dir = path.join(tmpdir(), `wt-fail-${Math.random()}`);
    await expect(assembleClips({ clips: [{ shotNumber: 1, path: path.join(dir, "nemletezik.mp4") }], cues: [], outDir: path.join(dir, "out") })).rejects.toThrow(/Hiányzó final shot/);
  });
});
