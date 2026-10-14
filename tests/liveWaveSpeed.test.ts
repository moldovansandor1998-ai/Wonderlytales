import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/lib/budget', () => ({ reserveProductionBudget: vi.fn(), getProductionBudget: vi.fn() }));
import { getProductionBudget, reserveProductionBudget } from '@/lib/budget';
import { generateLiveReply, liveAiProvider } from '@/lib/live/ai';
import { dialogueMessages, dialogueSchema } from '@/lib/live/duo';
const event = { id: 'c1', type: 'comment' as const, user: 'Peti', text: 'Isti, te vagy a szék kapitánya?', count: 1 };
const input = { event, history: [] };
const dialogue = { turns: [{ speaker: 'ali', text: 'Peti, a széknek már van kapitánya, csak hajója nincs!', emotion: 'laugh' }, { speaker: 'isti', text: 'Igazatok van, legalább itt nem leszek tengeribeteg.', emotion: 'neutral' }] };
const response = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const generate = (signal = new AbortController().signal) => generateLiveReply(dialogueMessages(input), dialogueSchema, signal, 400);
describe('Dynamic live AI with existing WaveSpeed connection', () => {
  beforeEach(() => {
    vi.resetAllMocks(); vi.stubEnv('LIVE_AI_GATEWAY_ENABLED', 'false'); vi.stubEnv('STORY_API_KEY', ''); vi.stubEnv('WAVESPEED_API_KEY', 'private-wave-key');
    vi.mocked(getProductionBudget).mockResolvedValue(null);
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it('uses a configured story provider before WaveSpeed', () => { vi.stubEnv('STORY_API_KEY', 'story'); expect(liveAiProvider()).toBe('story'); });
  it('keeps the comment as user data and validates both dynamically generated turns', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ data: { status: 'completed', outputs: ['```json\n' + JSON.stringify(dialogue) + '\n```'] } }));
    vi.stubGlobal('fetch', fetcher);
    const result = await generate(); expect(result.status).toBe(200); expect(await result.json()).toEqual(dialogue);
    expect(reserveProductionBudget).toHaveBeenCalledOnce(); expect(reserveProductionBudget).toHaveBeenCalledWith('story');
    const [url, options] = fetcher.mock.calls[0];
    expect(url).toBe('https://api.wavespeed.ai/api/v3/wavespeed-ai/any-llm');
    const body = JSON.parse(options.body); expect(body.system_prompt).not.toContain(event.text); expect(body.prompt).toContain(event.text);
    expect(body.model).toBe('google/gemini-3.1-flash-lite'); expect(body.max_tokens).toBeLessThanOrEqual(700);
  });
  it('polls the same accepted task without another paid submission', async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn().mockResolvedValueOnce(response({ data: { id: 'task-1', status: 'processing' } })).mockResolvedValueOnce(response({ data: { id: 'task-1', status: 'completed', outputs: [JSON.stringify(dialogue)] } }));
    vi.stubGlobal('fetch', fetcher);
    const pending = generate(); await vi.advanceTimersByTimeAsync(750); expect((await pending).status).toBe(200);
    expect(fetcher.mock.calls[1][0]).toBe('https://api.wavespeed.ai/api/v3/predictions/task-1/result');
    expect(fetcher.mock.calls.filter(c => c[1].method === 'POST')).toHaveLength(1); vi.useRealTimers();
  });
  it('blocks spending when the configured ceiling is too low', async () => {
    vi.mocked(getProductionBudget).mockResolvedValue({ configured_services: { story: 0.001 } } as never);
    const fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher);
    expect((await generate()).status).toBe(503); expect(fetcher).not.toHaveBeenCalled(); expect(reserveProductionBudget).not.toHaveBeenCalled();
  });
  it('never substitutes canned text or retries a failed paid call', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ error: 'private provider text' }, 500)); vi.stubGlobal('fetch', fetcher);
    const result = await generate(); expect(await result.json()).toEqual({ error: 'AI_PROVIDER_ERROR' }); expect(fetcher).toHaveBeenCalledOnce();
  });
  it('does not fetch model-supplied URLs or accept invalid speaker output', async () => {
    const fetcher = vi.fn().mockResolvedValue(response({ data: { status: 'completed', outputs: ['https://untrusted.example/secret'] } })); vi.stubGlobal('fetch', fetcher);
    expect((await generate()).status).toBe(502); expect(fetcher).toHaveBeenCalledOnce();
  });
  it('preserves full dialogue memory and confirmed music state outside the system prompt', () => {
    const messages = dialogueMessages({ event, history: [{ user: 'Peti', text: 'előző komment', reply: 'Ali: korábbi tréfa. Isti: elismerem.' }], music: {requested:'próbadal', started:false} });
    expect(JSON.parse(messages[1].content)).toMatchObject({ studioMusic: {requested:'próbadal', started:false}, recentConversation: [{ user: 'Peti' }] });
    expect(messages[0].content).toContain('studioMusic.started=true');
  });
});
