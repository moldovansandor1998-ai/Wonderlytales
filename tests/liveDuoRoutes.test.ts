import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
vi.mock('@/lib/auth',()=>({requireStudioUser:vi.fn()}));
vi.mock('@/lib/budget',()=>({reserveProductionBudget:vi.fn()}));
import { requireStudioUser } from '@/lib/auth';
import { reserveProductionBudget } from '@/lib/budget';
import { POST } from '@/app/api/live-studio/dialogue/route';
const payload={event:{id:'x',type:'comment',user:'Néző',text:'Szia'}};
const request=(body:unknown=payload,origin='https://studio.example')=>new NextRequest('https://studio.example/api/live-studio/dialogue',{method:'POST',headers:{'content-type':'application/json',origin},body:JSON.stringify(body)});
describe('Duo API boundaries',()=>{
  beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('STORY_API_KEY','test');vi.mocked(requireStudioUser).mockResolvedValue({id:'u',email:'u@example.com',role:'studio'});});
  afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
  it('checks authentication and origin before charging',async()=>{
    vi.mocked(requireStudioUser).mockRejectedValueOnce(new Error('UNAUTHORIZED'));
    expect((await POST(request())).status).toBe(401);
    expect((await POST(request(payload,'https://evil.example'))).status).toBe(403);
    expect(reserveProductionBudget).not.toHaveBeenCalled();
  });
  it('rejects invalid input before spending',async()=>{
    expect((await POST(request({event:{...payload.event,text:'x'.repeat(501)}}))).status).toBe(400);
    expect(reserveProductionBudget).not.toHaveBeenCalled();
  });
  it('fails closed on unavailable budget',async()=>{
    vi.mocked(reserveProductionBudget).mockRejectedValueOnce(new Error('no budget'));
    const fetch=vi.fn();vi.stubGlobal('fetch',fetch);
    expect((await POST(request())).status).toBe(503);expect(fetch).not.toHaveBeenCalled();
  });
  it('bounds unusable-output retries to two separately budgeted attempts',async()=>{
    const fetch=vi.fn(async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({turns:[{speaker:'arbitrary',text:'Szia',emotion:'happy'}]})}}]})));
    vi.stubGlobal('fetch',fetch);
    const response=await POST(request());expect(response.status).toBe(502);expect(fetch).toHaveBeenCalledTimes(2);expect(reserveProductionBudget).toHaveBeenCalledTimes(2);
  });
  it('generates a new contextual reply after rejecting pizza instead of using a phrase bank',async()=>{
    const outputs=['Pista harminckét négyzetméter pizzát evett, hová rakja?', 'Pista a széket is úgy nézi, mintha az tehetne róla!'];
    const fetch=vi.fn(async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({turns:[{speaker:'ali',text:outputs.shift(),emotion:'laugh'}]})}}]})));
    vi.stubGlobal('fetch',fetch);
    const response=await POST(request({event:{...payload.event,user:'Bence',text:'dagadt geci'}}));
    expect(response.status).toBe(200);
    expect((await response.json()).turns[0].text).toBe('Bence, Pista a széket is úgy nézi, mintha az tehetne róla!');
    expect(fetch).toHaveBeenCalledTimes(2);expect(reserveProductionBudget).toHaveBeenCalledTimes(2);
  });
  it.each([402,429,503])('does not retry provider status %s',async(status)=>{
    const fetch=vi.fn(async()=>new Response(JSON.stringify({error:{code:'provider_failure'}}),{status}));vi.stubGlobal('fetch',fetch);
    expect((await POST(request())).status).toBe(502);
    expect(fetch).toHaveBeenCalledOnce();expect(reserveProductionBudget).toHaveBeenCalledOnce();
  });
  it('returns one short response even if the provider adds another voice',async()=>{
    const dialogue={turns:[{speaker:'ali',text:'Isti már integet, csak közben elfelejtette, kinek!',emotion:'happy'},{speaker:'isti',text:'Én is köszönök.',emotion:'neutral'}]};
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(dialogue)}}]}))));
    const response=await POST(request());expect(response.status).toBe(200);
    const actual=await response.json();
    expect(actual.turns[0].text).toBe('Néző, Isti már integet, csak közben elfelejtette, kinek!');
    expect(actual.turns).toHaveLength(1);
  });
});
