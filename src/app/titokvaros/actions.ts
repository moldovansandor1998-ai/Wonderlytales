'use server';
import { revalidatePath } from 'next/cache';
import { designNewVoice,selectNewVoice,inspectVoiceAccount } from '@/lib/titokvarosVoices';
import { recordDemoLine } from '@/lib/titokvarosAudio';
import { submitDemoRender,pollDemoRender } from '@/lib/titokvarosRender';
async function run(action:()=>Promise<string|void>){try{const message=await action();revalidatePath('/titokvaros');return {ok:true,message:message??'Kész'};}catch(e){return {ok:false,message:e instanceof Error?e.message:'A művelet nem sikerült.'};}}
export async function designVoiceAction(code:string){return run(()=>designNewVoice(code));}
export async function selectVoiceAction(code:string,index:number){return run(()=>selectNewVoice(code,index));}
export async function recordDemoLineAction(id:string){return run(()=>recordDemoLine(id));}
export async function inspectVoiceAccountAction(){return run(()=>inspectVoiceAccount());}
export async function submitDemoRenderAction(id:string){return run(()=>submitDemoRender(id));}
export async function pollDemoRenderAction(id:string){return run(()=>pollDemoRender(id));}
export async function assignTemporaryCastAction(){return run(async()=>{const {assignTemporaryCast}=await import('@/lib/titokvarosVoices');return assignTemporaryCast();});}
