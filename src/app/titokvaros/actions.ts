'use server';
import { revalidatePath } from 'next/cache';
import { designNewVoice,selectNewVoice } from '@/lib/titokvarosVoices';
export async function designVoiceAction(code:string){await designNewVoice(code);revalidatePath('/titokvaros');}
export async function selectVoiceAction(code:string,index:number){await selectNewVoice(code,index);revalidatePath('/titokvaros');}
