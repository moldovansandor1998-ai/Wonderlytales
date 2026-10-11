import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { createHash } from 'crypto';
import { requireStudioUser } from './auth';
import { reserveProductionBudget } from './budget';
import { getStorage } from './providers/storage';
import { fetchWithTimeout } from './providers/translation';
import manifest from '../../production/titokvaros/render-manifest.json';
import { titokvarosPrefix } from './titokvaros';
export {manifest as titokvarosRenderManifest};
export type DemoRender={status:string;id:string;provider_job_id?:string;clip_key?:string;clip_sha256?:string;frames?:number;error?:string};
function spec(id:string){const job=manifest.jobs.find(j=>j.id===id);if(!job)throw new Error('Ismeretlen Titokváros renderfeladat.');return {...job,scene_key:('scene_key' in job?job.scene_key:manifest.scene_key) as string,scene_sha256:('scene_sha256' in job?job.scene_sha256:manifest.scene_sha256) as string};}
function stateKey(id:string){spec(id);return `${titokvarosPrefix}/jobs/${id}.json`;}
export async function readDemoRender(id:string):Promise<DemoRender|null>{const s=getStorage();return await s.exists(stateKey(id))?JSON.parse((await s.get(stateKey(id))).toString()):null;}
function provider(){if(!process.env.RUNPOD_API_KEY||!process.env.NATIVE_RUNPOD_ENDPOINT_ID)throw new Error('A natív RunPod nincs beállítva.');return {base:`https://api.runpod.ai/v2/${process.env.NATIVE_RUNPOD_ENDPOINT_ID}`,headers:{Authorization:`Bearer ${process.env.RUNPOD_API_KEY}`,'Content-Type':'application/json'}};}
export async function submitDemoRender(id:string){
 await requireStudioUser();const job=spec(id);const saved=await readDemoRender(id);if(saved)throw new Error('Ez a feladat már elindult. Frissítsd az állapotát.');
 const p=provider();const s=getStorage();const source=await s.get(job.scene_key);
 if(createHash('sha256').update(source).digest('hex')!==job.scene_sha256)throw new Error('A Blender forrás ellenőrzőösszege eltér.');
 const frames=job.frame_end-job.frame_start+1;if(frames<1||frames>360)throw new Error('Túl hosszú renderfeladat.');
 const {S3_ENDPOINT,S3_ACCESS_KEY_ID,S3_SECRET_ACCESS_KEY,S3_BUCKET}=process.env;
 if(!S3_ENDPOINT||!S3_ACCESS_KEY_ID||!S3_SECRET_ACCESS_KEY||!S3_BUCKET)throw new Error('R2 hozzáférés szükséges.');
 const r2=new S3Client({endpoint:S3_ENDPOINT,region:'auto',credentials:{accessKeyId:S3_ACCESS_KEY_ID,secretAccessKey:S3_SECRET_ACCESS_KEY},forcePathStyle:true});
 try{await r2.send(new PutObjectCommand({Bucket:S3_BUCKET,Key:stateKey(id)+'.claim',Body:JSON.stringify({id,sha:job.scene_sha256,at:new Date().toISOString()}),IfNoneMatch:'*',ContentType:'application/json'}));}catch(e){if((e as {$metadata?:{httpStatusCode?:number}}).$metadata?.httpStatusCode===412)throw new Error('A feladatot már lefoglalták; nincs automatikus újraküldés.');throw e;}
 await reserveProductionBudget('native_render');
 await s.put(stateKey(id),JSON.stringify({id,status:'SUBMISSION_UNCERTAIN'}),'application/json');
 const r=await fetchWithTimeout(`${p.base}/run`,{method:'POST',headers:p.headers,body:JSON.stringify({input:{operation:'RENDER_NATIVE_FRAMES',scene_key:job.scene_key,scene_sha256:job.scene_sha256,renderer_revision:manifest.renderer_revision,frame_start:job.frame_start,frame_end:job.frame_end,width:1920,height:1080,samples:48},policy:{executionTimeout:1800000,ttl:3600000}})},30000);
 if(!r.ok){await s.put(stateKey(id),JSON.stringify({id,status:'SUBMIT_REJECTED',error:`RunPod HTTP ${r.status}`}), 'application/json');throw new Error(`RunPod HTTP ${r.status}`);}
 const result=await r.json() as {id:string};if(!/^[a-zA-Z0-9_-]{8,120}$/.test(result.id))throw new Error('Hiányzó távoli feladatazonosító.');
 await s.put(stateKey(id),JSON.stringify({id,status:'SUBMITTED',provider_job_id:result.id,source_sha256:job.scene_sha256,production_approved:false}), 'application/json');
}
export async function pollDemoRender(id:string){
 await requireStudioUser();const job=spec(id),saved=await readDemoRender(id);if(!saved?.provider_job_id)throw new Error('Nincs mentett távoli azonosító; ne küldd újra a munkát.');if(saved.status==='RENDERED_PENDING_QC')return;
 const p=provider(),s=getStorage();const r=await fetchWithTimeout(`${p.base}/status/${saved.provider_job_id}`,{headers:p.headers},30000);if(!r.ok)throw new Error(`RunPod státusz HTTP ${r.status}`);
 const d=await r.json();
 if(d.status==='COMPLETED'){
  const o=d.output,c=o?.clip,frames=job.frame_end-job.frame_start+1;
  if(o?.status!=='RENDERED'||o.source_sha256!==job.scene_sha256||o.renderer_revision!==manifest.renderer_revision||o.frames!==frames||o.frame_start!==job.frame_start||o.frame_end!==job.frame_end||o.fps!==24||o.native_frame_step!==1||o.width!==1920||o.height!==1080||o.outputs?.length!==frames||c?.verified_frames!==frames||c?.verified_fps!==24||c?.verified_width!==1920||c?.verified_height!==1080||!c?.key?.startsWith(`renders/native/S1E1/${job.scene_sha256}/`)||!c.sha256?.match(/^[a-f0-9]{64}$/))throw new Error('Hiányos vagy eltérő natív rendereredmény.');
  const bytes=await s.get(c.key);if(bytes.length!==c.bytes||createHash('sha256').update(bytes).digest('hex')!==c.sha256)throw new Error('A videó ellenőrzőösszege eltér.');
  await s.put(stateKey(id),JSON.stringify({...saved,status:'RENDERED_PENDING_QC',clip_key:c.key,clip_sha256:c.sha256,frames,execution_ms:d.executionTime,production_approved:false}), 'application/json');
 }else await s.put(stateKey(id),JSON.stringify({...saved,status:String(d.status),...(d.error?{error:String(d.error).slice(0,500)}:{})}), 'application/json');
}
