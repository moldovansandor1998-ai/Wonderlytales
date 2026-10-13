import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/budget", () => ({ reserveProductionBudget: vi.fn() }));
import { reserveProductionBudget } from "@/lib/budget";
import { createAvatar, prepareAvatar, cancelAvatar, PIRATE_VOICE } from "@/lib/live/avatar";
const avatarId = "baa672bd-4424-4732-ad14-55eb52bc81f7";
const signedUrl = "wss://api.elevenlabs.io/v1/convai/conversation?signature=private";
const agent = () => ({ conversation_config: { asr: { user_input_audio_format: "pcm_16000" }, tts: { voice_id: PIRATE_VOICE }, agent: { language: "hu" }, conversation: { max_duration_seconds: 60 } } });
const response = (value: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(value), { status });
describe("Runway live provider boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("RUNWAYML_API_SECRET", "runway-secret"); vi.stubEnv("RUNWAY_AVATAR_ID", avatarId);
    vi.stubEnv("ELEVENLABS_API_KEY", "eleven-secret"); vi.stubEnv("ELEVENLABS_AGENT_ID", "agent_captain");
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("does not contact providers when configuration is missing", async () => {
    vi.stubEnv("RUNWAYML_API_SECRET", ""); const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(prepareAvatar()).rejects.toThrow("AVATAR_NOT_CONFIGURED"); expect(fetcher).not.toHaveBeenCalled();
  });
  it("rejects a failed character before obtaining a signed URL or spending", async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(response({ status: "FAILED" })).mockResolvedValueOnce(response(agent())); vi.stubGlobal("fetch", fetcher);
    await expect(prepareAvatar()).rejects.toThrow("RUNWAY_CHARACTER_NOT_READY"); expect(fetcher).toHaveBeenCalledTimes(2); expect(reserveProductionBudget).not.toHaveBeenCalled();
  });
  it("rejects another voice or an unbounded ElevenLabs agent", async () => {
    const wrong = agent(); wrong.conversation_config.tts.voice_id = "another-voice";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response({ status: "READY" })).mockResolvedValueOnce(response(wrong)));
    await expect(prepareAvatar()).rejects.toThrow("ELEVENLABS_AGENT_SETTINGS_REQUIRED");
    const long = agent(); long.conversation_config.conversation.max_duration_seconds = 600;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(response({ status: "READY" })).mockResolvedValueOnce(response(long)));
    await expect(prepareAvatar()).rejects.toThrow("ELEVENLABS_AGENT_SETTINGS_REQUIRED");
  });
  it("sends a provider duration cap and preserves the ElevenLabs integration without prompt overrides", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ id: avatarId })); vi.stubGlobal("fetch", fetcher);
    await expect(createAvatar({ avatarId, signedUrl })).resolves.toBe(avatarId);
    expect(vi.mocked(reserveProductionBudget).mock.calls.map(c => c[0])).toEqual(["runway_live_60s", "elevenlabs_agent_60s"]);
    const payload = JSON.parse(fetcher.mock.calls[0][1].body);
    expect(payload).toEqual({ model: "gwm1_avatars", avatar: { type: "custom", avatarId }, maxDuration: 60, integration: { type: "elevenlabs", signedUrl } });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("never retries ambiguous paid creation or exposes provider error text", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ secret: "private" }, 500)); vi.stubGlobal("fetch", fetcher);
    await expect(createAvatar({ avatarId, signedUrl })).rejects.toThrow("RUNWAY_REQUEST_FAILED"); expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("blocks paid submission if either budget reservation fails", async () => {
    vi.mocked(reserveProductionBudget).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error("ceiling missing"));
    const fetcher = vi.fn(); vi.stubGlobal("fetch", fetcher);
    await expect(createAvatar({ avatarId, signedUrl })).rejects.toThrow("ceiling missing"); expect(fetcher).not.toHaveBeenCalled();
  });
  it("uses the cancellation endpoint and accepts an already-removed session", async () => {
    const fetcher = vi.fn().mockResolvedValue(response({}, 404)); vi.stubGlobal("fetch", fetcher);
    await cancelAvatar(avatarId); expect(fetcher.mock.calls[0][1].method).toBe("DELETE");
    fetcher.mockResolvedValueOnce(new Response(null, { status: 200 }));
    await expect(cancelAvatar(avatarId)).resolves.toBeUndefined();
  });
});
