import {describe,it,expect,vi,beforeEach} from 'vitest';
const m=vi.hoisted(()=>({auth:vi.fn(),reserve:vi.fn(),send:vi.fn(),fetch:vi.fn(),exists:vi.fn(),get:vi.fn(),put:vi.fn()}));
vi.mock('@/lib/auth',()=>({requireStudioUser:m.auth}));
vi.mock('@/lib/budget',()=>({reserveProductionBudget:m.reserve}));
vi.mock('@/lib/providers/storage',()=>({getStorage:()=>({exists:m.exists,get:m.get,put:m.put})}));
vi.mock('@/lib/providers/translation',()=>({fetchWithTimeout:m.fetch}));
vi.mock('@aws-sdk/client-s3',()=>({S3Client:class{send=m.send},PutObjectCommand:class{constructor(public input:unknown){}}}));
import {submitDemoRender,pollDemoRender} from '@/lib/titokvarosRender';
describe('Titokvaros native diagnostic paid boundary',()=>{
 beforeEach(()=>{vi.resetAllMocks();m.auth.mockResolvedValue({role:'studio'});m.exists.mockResolvedValue(false);});
 it('rejects unauthenticated submission before storage access',async()=>{m.auth.mockRejectedValue(new Error('UNAUTHORIZED'));await expect(submitDemoRender('TV_GAIT_V001')).rejects.toThrow('UNAUTHORIZED');expect(m.exists).not.toHaveBeenCalled();expect(m.fetch).not.toHaveBeenCalled();});
 it('cannot submit arbitrary frame ranges or assets',async()=>{await expect(submitDemoRender('../scene')).rejects.toThrow('Ismeretlen');expect(m.reserve).not.toHaveBeenCalled();});
 it('rejects changed source before any paid submission',async()=>{m.get.mockResolvedValue(Buffer.from('changed blend'));await expect(submitDemoRender('TV_GAIT_V001')).rejects.toThrow('ellenőrzőösszege');expect(m.reserve).not.toHaveBeenCalled();expect(m.fetch).not.toHaveBeenCalled();});
 it('never resubmits an uncertain job',async()=>{m.exists.mockResolvedValue(true);m.get.mockResolvedValue(Buffer.from('{"id":"TV_GAIT_V001","status":"SUBMISSION_UNCERTAIN"}'));await expect(submitDemoRender('TV_GAIT_V001')).rejects.toThrow('már elindult');expect(m.reserve).not.toHaveBeenCalled();expect(m.fetch).not.toHaveBeenCalled();});
 it('cannot poll without a durable provider job id',async()=>{await expect(pollDemoRender('TV_GAIT_V001')).rejects.toThrow('Nincs mentett');expect(m.fetch).not.toHaveBeenCalled();});
});
