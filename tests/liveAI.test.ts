import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
vi.mock('@/lib/budget', () => ({reserveProductionBudget:vi.fn(),getProductionBudget:vi.fn()}));
vi.mock('@vercel/oidc', () => ({getVercelOidcToken:vi.fn()}));
import { getVercelOidcToken } from '@vercel/oidc';
import { reserveProductionBudget, getProductionBudget } from '@/lib/budget';
import { generateLiveReply } from '@/lib/live/ai';
import { readAIResponse } from '@/lib/live/client';
const schema = z.object({text:z.string()});
const messages = [{role:'system',content:'Return JSON.'},{role:'user',content:'Hello'}];
const run = () => generateLiveReply(messages,schema,new AbortController().signal,700);
describe('Bounded live AI gateway',()=>{
  beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('LIVE_AI_GATEWAY_ENABLED','true');vi.stubEnv('AI_GATEWAY_API_KEY','');vi.mocked(getVercelOidcToken).mockResolvedValue('fresh-token');vi.mocked(getProductionBudget).mockResolvedValue({configured_services:{live_ai:0.06}} as never);});
  afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
  it('uses a fresh OIDC token and the pinned model after reserving the live budget',async()=>{
    const fetch=vi.fn(async(_url,options)=>{
      expect(reserveProductionBudget).toHaveBeenCalledWith('live_ai');
      expect(options.headers.Authorization).toBe('Bearer fresh-token');
      expect(JSON.parse(options.body)).toMatchObject({model:'openai/gpt-6.1-sol',max_completion_tokens:800,reasoning_effort:'low',service_tier:'default'});
      expect(JSON.parse(options.body)).not.toHaveProperty('temperature');
      expect(JSON.parse(options.body)).not.toHaveProperty('max_tokens');
      return new Response(JSON.stringify({choices:[{message:{content:'{"text":"Hello"}'}}]}));
    });vi.stubGlobal('fetch',fetch);
    expect(await (await run()).json()).toEqual({text:'Hello'});
    expect(fetch).toHaveBeenCalledOnce();expect(fetch.mock.calls[0][0]).toBe('https://ai-gateway.vercel.sh/v1/chat/completions');
    expect(getVercelOidcToken).toHaveBeenCalledOnce();
  });
  it('does not spend if authentication or input bounds fail',async()=>{
    vi.mocked(getVercelOidcToken).mockRejectedValueOnce(new Error('no token'));
    expect((await run()).status).toBe(503);
    expect((await generateLiveReply([{role:'user',content:'x'.repeat(20001)}],schema,new AbortController().signal,700)).status).toBe(400);
    expect(reserveProductionBudget).not.toHaveBeenCalled();
  });
  it('requires the verified reservation for the full model before any paid attempt',async()=>{
    vi.mocked(getProductionBudget).mockResolvedValueOnce({configured_services:{live_ai:0.05}} as never);
    const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
    expect(await (await run()).json()).toEqual({error:'AI_BUDGET_NOT_CONFIGURED'});
    expect(reserveProductionBudget).not.toHaveBeenCalled();expect(fetch).not.toHaveBeenCalled();
  });
  it('stops before provider spending when the budget is unavailable',async()=>{
    vi.mocked(reserveProductionBudget).mockRejectedValueOnce(new Error('budget'));
    const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
    await expect(run()).rejects.toThrow('budget');expect(fetch).not.toHaveBeenCalled();
  });
  it.each([[403,'customer_verification_required','AI_VERIFICATION_REQUIRED'],[402,'insufficient_funds','AI_CREDITS_REQUIRED'],[429,'rate_limit','AI_RATE_LIMITED']])('reports provider status %s without leaking the body or retrying',async(status,code,expected)=>{
    const fetch=vi.fn().mockResolvedValue(new Response(JSON.stringify({error:{code,message:'private-provider-detail'}}),{status:Number(status)}));vi.stubGlobal('fetch',fetch);
    const response=await run();const result=await response.clone().json();expect(result).toEqual({error:expected});
    await expect(readAIResponse(response)).rejects.toThrow();expect(fetch).toHaveBeenCalledOnce();
  });
  it('does not substitute a canned reply for invalid AI output',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:'not json'}}]}))));
    expect(await (await run()).json()).toEqual({error:'AI_INVALID_REPLY'});
  });
});
