import {describe,it,expect,vi,beforeEach} from 'vitest';
const m=vi.hoisted(()=>({auth:vi.fn(),reserve:vi.fn(),send:vi.fn(),fetch:vi.fn(),exists:vi.fn(),get:vi.fn(),put:vi.fn(),upsert:vi.fn()}));
vi.mock('@/lib/auth',()=>({requireStudioUser:m.auth,createServerSupabase:()=>({from:()=>({upsert:m.upsert})})}));
vi.mock('@/lib/budget',()=>({reserveProductionBudget:m.reserve}));
vi.mock('@/lib/providers/storage',()=>({getStorage:()=>({exists:m.exists,get:m.get,put:m.put})}));
vi.mock('@/lib/providers/translation',()=>({fetchWithTimeout:m.fetch}));
vi.mock('@aws-sdk/client-s3',()=>({S3Client:class{send=m.send},PutObjectCommand:class{constructor(public input:unknown){}}}));
import {designNewVoice,selectNewVoice} from '@/lib/titokvarosVoices';
describe('new cast voice safety and recovery',()=>{
 beforeEach(()=>{vi.resetAllMocks();m.auth.mockResolvedValue({role:'studio'});m.exists.mockResolvedValue(false);m.upsert.mockResolvedValue({error:null});Object.assign(process.env,{ELEVENLABS_API_KEY:'test-only',S3_ENDPOINT:'https://storage.test',S3_ACCESS_KEY_ID:'test',S3_SECRET_ACCESS_KEY:'test',S3_BUCKET:'test'});});
 it('blocks unauthenticated requests before storage or provider use',async()=>{m.auth.mockRejectedValue(new Error('UNAUTHORIZED'));await expect(designNewVoice('MIRA')).rejects.toThrow('UNAUTHORIZED');expect(m.send).not.toHaveBeenCalled();expect(m.fetch).not.toHaveBeenCalled();});
 it('does not accept arbitrary characters or storage paths',async()=>{await expect(designNewVoice('../MIRA')).rejects.toThrow('Ismeretlen');expect(m.reserve).not.toHaveBeenCalled();});
 it('does not submit when budget reservation fails',async()=>{m.reserve.mockRejectedValue(new Error('DAILY_BUDGET_EXCEEDED'));await expect(designNewVoice('MIRA')).rejects.toThrow('DAILY_BUDGET_EXCEEDED');expect(m.fetch).not.toHaveBeenCalled();});
 it('permanent claim blocks a second paid submission',async()=>{m.send.mockRejectedValue({$metadata:{httpStatusCode:412}});await expect(designNewVoice('MIRA')).rejects.toThrow('már elindult');expect(m.reserve).not.toHaveBeenCalled();expect(m.fetch).not.toHaveBeenCalled();});
 it('reuses stored auditions without billing',async()=>{m.exists.mockResolvedValue(true);m.get.mockResolvedValue(Buffer.from(JSON.stringify({status:'AUDITION_PENDING',previews:[{id:'existing'}]})));await designNewVoice('MIRA');expect(m.fetch).not.toHaveBeenCalled();expect(m.reserve).not.toHaveBeenCalled();});
 it('recovers a provider-success DB-failure without creating another voice',async()=>{m.exists.mockResolvedValue(true);m.get.mockResolvedValue(Buffer.from(JSON.stringify({status:'ASSIGNED_PENDING_ACTING_REVIEW',voice_id:'newVoiceAlreadyCreated'})));await selectNewVoice('MIRA',0);expect(m.fetch).not.toHaveBeenCalled();expect(m.upsert).toHaveBeenCalledOnce();expect(m.upsert.mock.calls[0][0].voice_id).toBe('newVoiceAlreadyCreated');});
 it('rejects unrecorded preview index',async()=>{m.exists.mockResolvedValue(true);m.get.mockResolvedValue(Buffer.from(JSON.stringify({previews:[]})));await expect(selectNewVoice('MIRA',10)).rejects.toThrow('Ismeretlen');expect(m.fetch).not.toHaveBeenCalled();});
});
