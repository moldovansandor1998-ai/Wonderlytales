'use server';
import { revalidatePath } from 'next/cache';
import { designNewVoice,selectNewVoice } from '@/lib/titokvarosVoices';
export async function designVoiceAction(code:string){await designNewVoice(code);revalidatePath('/titokvaros');}
export async function selectVoiceAction(code:string,index:number){await selectNewVoice(code,index);revalidatePath('/titokvaros');}
export async function recordDemoLineAction(id:string){const {recordDemoLine}=await import('@/lib/titokvarosAudio');await recordDemoLine(id);revalidatePath('/titokvaros');}
export async function inspectVoiceAccountAction(){const {inspectVoiceAccount}=await import('@/lib/titokvarosVoices');const message=await inspectVoiceAccount();revalidatePath('/titokvaros');return message;}
