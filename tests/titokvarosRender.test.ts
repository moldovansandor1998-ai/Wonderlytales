import {describe,it,expect,vi,beforeEach} from 'vitest';
const m=vi.hoisted(()=>({auth:vi.fn(),reserve:vi.fn(),send:vi.fn(),fetch:vi.fn(),exists:vi.fn(),get:vi.fn(),put:vi.fn()}));
vi.mock('@/lib/auth',()=>({requireStudioUser:m.auth}));
vi.mock('@/lib/budget',()=>({reserveProductionBudget:m.reserve}));
vi.mock('@/lib/providers/storage',()=>({getStorage:()=>({exists:m.exists,get:m.get,put:m.put})}));
vi.mock('@/lib/providers/translation',()=>({fetchWithTimeout:m.fetch}));
vi.mock('@aws-sdk/client-s3',()=>({S3Client:class{send=m.send},PutObjectCommand:class{constructor(public input:unknown){}}}));
import manifest from '../production/titokvaros/render-manifest.json';
import {submitDemoRender,pollDemoRender} from '@/lib/titokvarosRender';
describe('Titokvaros native diagnostic paid boundary',()=>{
 beforeEach(()=>{vi.resetAllMocks();m.auth.mockResolvedValue({role:'studio'});m.exists.mockResolvedValue(false);process.env.RUNPOD_API_KEY='test-only';process.env.NATIVE_RUNPOD_ENDPOINT_ID='test-endpoint';});
 it('rejects unauthenticated submission before storage access',async()=>{m.auth.mockRejectedValue(new Error('UNAUTHORIZED'));await expect(submitDemoRender('TV_GAIT_V001')).rejects.toThrow('UNAUTHORIZED');expect(m.exists).not.toHaveBeenCalled();expect(m.fetch).not.toHaveBeenCalled();});
 it('cannot submit arbitrary frame ranges or assets',async()=>{await expect(submitDemoRender('../scene')).rejects.toThrow('Ismeretlen');expect(m.reserve).not.toHaveBeenCalled();});
 it('rejects changed source before any paid submission',async()=>{m.get.mockResolvedValue(Buffer.from('changed blend'));await expect(submitDemoRender('TV_GAIT_V001')).rejects.toThrow('ellenőrzőösszege');expect(m.reserve).not.toHaveBeenCalled();expect(m.fetch).not.toHaveBeenCalled();});
 it('never resubmits an uncertain job',async()=>{m.exists.mockResolvedValue(true);m.get.mockResolvedValue(Buffer.from('{"id":"TV_GAIT_V001","status":"SUBMISSION_UNCERTAIN"}'));await expect(submitDemoRender('TV_GAIT_V001')).rejects.toThrow('már elindult');expect(m.reserve).not.toHaveBeenCalled();expect(m.fetch).not.toHaveBeenCalled();});
 it('cannot poll without a durable provider job id',async()=>{await expect(pollDemoRender('TV_GAIT_V001')).rejects.toThrow('Nincs mentett');expect(m.fetch).not.toHaveBeenCalled();});
 it('rejects a completed old-source clip for the new dialogue scene',async()=>{
  const job=manifest.jobs[1];m.exists.mockResolvedValue(true);m.get.mockResolvedValue(Buffer.from(JSON.stringify({id:job.id,status:'IN_PROGRESS',provider_job_id:'saved-job-id'})));
  m.fetch.mockResolvedValue({ok:true,json:async()=>({status:'COMPLETED',output:{status:'RENDERED',source_sha256:manifest.scene_sha256,renderer_revision:manifest.renderer_revision,frames:288,frame_start:job.frame_start,frame_end:job.frame_end,fps:24,native_frame_step:1,width:1920,height:1080,outputs:Array(288).fill({}),clip:{verified_frames:288,verified_fps:24,verified_width:1920,verified_height:1080,key:`renders/native/S1E1/${manifest.scene_sha256}/clip.mp4`,sha256:'a'.repeat(64)}}})});
  await expect(pollDemoRender(job.id)).rejects.toThrow('eltérő natív');expect(m.put).not.toHaveBeenCalled();expect(m.reserve).not.toHaveBeenCalled();
 });

});
