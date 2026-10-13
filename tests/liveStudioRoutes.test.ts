import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('@/lib/auth',()=>({requireStudioUser:vi.fn()}));
vi.mock('@/lib/live/speech',async importOriginal=>({...await importOriginal<object>(),timedSpeech:vi.fn()}));
vi.mock('@/lib/budget',()=>({reserveProductionBudget:vi.fn()}));
import {requireStudioUser} from '@/lib/auth';
import {timedSpeech} from '@/lib/live/speech';
import {reserveProductionBudget} from '@/lib/budget';
import {POST as speech} from '@/app/api/live-studio/speech/route';
import {POST as reply} from '@/app/api/live-studio/reply/route';
const request=(body:unknown,origin='https://studio.example')=>new NextRequest('https://studio.example/api/live-studio/speech',{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(body)});
describe('Live paid API access boundaries',()=>{
  beforeEach(()=>{vi.clearAllMocks();vi.unstubAllEnvs();vi.mocked(requireStudioUser).mockResolvedValue({id:'test',email:'test@example.com',role:'studio'});});
  it('rejects unauthenticated speech before generating audio',async()=>{
    vi.mocked(requireStudioUser).mockRejectedValue(new Error('UNAUTHORIZED'));
    expect((await speech(request({text:'Szia',voiceId:'voice123'}))).status).toBe(401);expect(timedSpeech).not.toHaveBeenCalled();
  });
  it('rejects cross-origin paid calls',async()=>{
    expect((await speech(request({text:'Szia',voiceId:'voice123'},'https://evil.example'))).status).toBe(403);expect(timedSpeech).not.toHaveBeenCalled();
  });
  it('rejects unbounded text',async()=>{
    expect((await speech(request({text:'x'.repeat(1001),voiceId:'voice123'}))).status).toBe(400);expect(timedSpeech).not.toHaveBeenCalled();
  });
  it('fails closed when the AI service is absent without consuming budget',async()=>{
    vi.stubEnv('STORY_API_KEY','');
    const result=await reply(request({event:{id:'a',type:'comment',user:'Néző',text:'Szia'},character:{name:'Kapitány',personality:'vidám'}}));
    expect(result.status).toBe(503);expect(await result.json()).toEqual({error:'AI_NOT_CONFIGURED'});expect(reserveProductionBudget).not.toHaveBeenCalled();
  });
});
