import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ElevenLabsTts, ttsCacheKey, MockTts } from "@/lib/providers/tts";
import { ProductionTranslationProvider, MockTranslationProvider } from "@/lib/providers/translation";
import { LlmStoryEngine, MockStoryEngine, StoryOutputSchema } from "@/lib/providers/story";
import { LocalVisemeFacial } from "@/lib/providers/facial";
import { RemoteRenderWorker, MockRenderWorker } from "@/lib/worker";
import { LocalStorageProvider } from "@/lib/providers/storage";
import { createServer, type Server } from "http";
import { tmpdir } from "os";
import path from "path";

describe("TTS", () => {
  it("cache hash determinisztikus és konfig-érzékeny", () => {
    const a = ttsCacheKey("Szia", { language: "hu", voiceId: "v1" });
    expect(a).toBe(ttsCacheKey("Szia", { language: "hu", voiceId: "v1" }));
    expect(a).not.toBe(ttsCacheKey("Szia", { language: "en", voiceId: "v1" }));
  });
  it("mock TTS path + duration", async () => {
    const r = await new MockTts().synthesize("Helló világ", { language: "hu", voiceId: "x" });
    expect(r.path).toContain("audio/tts/hu/x/");
    expect(r.durationSec).toBeGreaterThan(0);
  });
  it("ElevenLabs adapter: sikeres HTTP hívás (mock szerver)", async () => {
    const audio = Buffer.concat([Buffer.alloc(2048, 7)]);
    const srv: Server = createServer((req, res) => {
      expect(req.headers["xi-api-key"]).toBe("test-key");
      let body = "";
      req.on("data", chunk => body += chunk);
      req.on("end", () => {
        const payload = JSON.parse(body);
        expect(payload.model_id).toBe("eleven_flash_v2_5");
        expect(payload.language_code).toBe("hu");
        res.writeHead(200, { "Content-Type": "audio/mpeg" }); res.end(audio);
      });
    });
    await new Promise<void>((r) => srv.listen(0, r));
    const port = (srv.address() as { port: number }).port;
    const tts = new ElevenLabsTts("test-key", `http://127.0.0.1:${port}/v1`);
    const r = await tts.synthesize("Teszt szöveg", { language: "hu", voiceId: "voice1" });
    expect(r.audio!.length).toBe(2048);
    expect(r.costUsd).toBeGreaterThan(0);
    srv.close();
  });
  it("ElevenLabs adapter: HTTP 400 → hiba", async () => {
    const srv = createServer((req, res) => { res.writeHead(400); res.end("bad"); });
    await new Promise<void>((r) => srv.listen(0, r));
    const port = (srv.address() as { port: number }).port;
    await expect(new ElevenLabsTts("k", `http://127.0.0.1:${port}/v1`).synthesize("x", { language: "hu", voiceId: "v" })).rejects.toThrow(/ElevenLabs/);
    srv.close();
  });
});

describe("Translation provider", () => {
  it("production adapter LLM endpointot hív (mock szerver)", async () => {
    const srv = createServer((req, res) => {
      let b = ""; req.on("data", (c) => (b += c)); req.on("end", () => {
        expect(b).toContain("Márk"); // karakter neve átadva
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ choices: [{ message: { content: "Look, Lili!" } }] }));
      });
    });
    await new Promise<void>((r) => srv.listen(0, r));
    const port = (srv.address() as { port: number }).port;
    const p = new ProductionTranslationProvider("k", `http://127.0.0.1:${port}/v1`);
    const r = await p.translate({ text: "Nézd, Lili!", sourceLang: "hu", targetLang: "en", characterName: "Márk", emotion: "excited", timingSec: 2, ageRange: "4-9" });
    expect(r.text).toBe("Look, Lili!");
    srv.close();
  });
});

describe("StoryEngine", () => {
  it("mock output séma-érvényes", async () => {
    const out = await new MockStoryEngine().generateEpisode({ bible: "b", seasonContext: "", previousSummaries: [], brief: "teszt", ageRange: "4-9", durationSec: 1200, language: "hu" });
    expect(StoryOutputSchema.parse(out).title).toBeTruthy();
  });
  it("LLM adapter: érvénytelen JSON → retry → érvényes (mock szerver)", async () => {
    let calls = 0;
    const srv = createServer((req, res) => {
      calls++;
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ choices: [{ message: { content: calls === 1 ? "nem json" : JSON.stringify({ title: "T", synopsis: "S", acts: [{ title: "A", summary: "a" }], scenes: [{ title: "sc", location_hint: "LOC", beats: ["b"], characters: ["Márk"] }], continuity_notes: [], season_arc_contribution: "x" }) } }] }));
    });
    await new Promise<void>((r) => srv.listen(0, r));
    const port = (srv.address() as { port: number }).port;
    const eng = new LlmStoryEngine("k", `http://127.0.0.1:${port}/v1`);
    const out = await eng.generateEpisode({ bible: "b", seasonContext: "", previousSummaries: [], brief: "x", ageRange: "4-9", durationSec: 60, language: "hu" });
    expect(out.title).toBe("T");
    expect(calls).toBe(2); // repair retry történt
    srv.close();
  });
});

describe("Facial local fallback", () => {
  it("viseme timeline generálás", async () => {
    const t = await new LocalVisemeFacial().generate({ audioPath: "a.wav", audioDurationSec: 2, text: "Szia Lili!", facialProfile: "F", visemeProfile: "V", emotion: "happy" });
    expect(t.format).toBe("BLENDSHAPE_V1");
    expect(t.keys.length).toBeGreaterThan(2);
    expect(t.keys[0].shapes.smile).toBeGreaterThan(0);
    expect(t.keys.at(-1)!.t).toBeLessThanOrEqual(2);
  });
});

describe("RemoteRenderWorker (RunPod) mock HTTP szerverrel", () => {
  it("submit → poll → COMPLETED", async () => {
    const srv = createServer((req, res) => {
      if (req.url === "/v2/ep1/run") { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ id: "job1" })); }
      else if (req.url === "/v2/ep1/status/job1") { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ status: "COMPLETED", output: { status: "SUCCEEDED", output: "out.mp4", frames: 96, durationSec: 4, renderSec: 10, gpuSec: 40, renderer: "blender", error: null } })); }
      else { res.writeHead(404); res.end(); }
    });
    await new Promise<void>((r) => srv.listen(0, r));
    const port = (srv.address() as { port: number }).port;
    const w = new RemoteRenderWorker("ep1", "key");
    // base URL felülírás teszthez
    (w as unknown as { base: () => string });
    const orig = (w as never as { base(): string }).base;
    (w as never as { base(): string }).base = () => `http://127.0.0.1:${port}/v2/ep1`;
    // gyors poll
    const origSetTimeout = global.setTimeout;
    const resultPromise = w.submit({ shot_id: "s1", duration_sec: 4 }, "PREVIEW");
    const result = await resultPromise;
    expect(result.status).toBe("SUCCEEDED");
    expect(result.output).toBe("out.mp4");
    expect(result.renderer).toBe("runpod");
    srv.close();
  }, 15000);
});

describe("Storage local", () => {
  it("put/get/exists/delete + sha256 meta", async () => {
    const p = new LocalStorageProvider();
    (p as never as { root: string }).root = path.join(tmpdir(), `wt-st-${Math.random()}`);
    const meta = await p.put("a/b.txt", "hello", "text/plain");
    expect(meta.sha256).toHaveLength(64);
    expect(meta.size).toBe(5);
    expect(await p.exists("a/b.txt")).toBe(true);
    expect((await p.get("a/b.txt")).toString()).toBe("hello");
    await p.delete("a/b.txt");
    expect(await p.exists("a/b.txt")).toBe(false);
  });
});

describe("MockRenderWorker", () => {
  it("immutable snapshotból output", async () => {
    const r = await new MockRenderWorker().submit({ shot_id: "s1", revision: 2, duration_sec: 5, render: { fps: 24 } }, "FINAL");
    expect(r.status).toBe("SUCCEEDED");
    expect(r.output).toContain("final_r2.mp4");
    expect(r.frames).toBe(120);
    expect(r.gpuSec).toBeGreaterThan(0);
  });
});
