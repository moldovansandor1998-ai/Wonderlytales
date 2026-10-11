import { NextRequest,NextResponse } from 'next/server';
import { getStudioUser } from '@/lib/auth';
import { getStorage } from '@/lib/providers/storage';
import { titokvarosFiles, titokvarosPrefix, newVoiceCode } from '@/lib/titokvaros';
import { demoLineKey } from '@/lib/titokvarosAudio';
export const dynamic='force-dynamic';
export async function GET(req:NextRequest){
 const user=await getStudioUser();if(!user)return NextResponse.json({error:'UNAUTHORIZED'},{status:401});
 if(!['admin','studio'].includes(user.role))return NextResponse.json({error:'FORBIDDEN'},{status:403});
 let key:string|undefined;
 const file=req.nextUrl.searchParams.get('file');
 if(file&&Object.prototype.hasOwnProperty.call(titokvarosFiles,file))key=titokvarosFiles[file as keyof typeof titokvarosFiles].key;
 const voice=req.nextUrl.searchParams.get('voice'),index=req.nextUrl.searchParams.get('preview');
 if(voice&&index&&/^[0-4]$/.test(index))try{key=`${titokvarosPrefix}/voices/${newVoiceCode(voice)}/preview_${index}.mp3`;}catch{}
 const line=req.nextUrl.searchParams.get('line');if(line)try{key=demoLineKey(line)+'.mp3';}catch{}
 if(!key)return NextResponse.json({error:'INVALID_ARTIFACT'},{status:400});
 try{const s=getStorage();if(!await s.exists(key))return NextResponse.json({error:'Ez az anyag még nem készült el.'},{status:404});const response=NextResponse.redirect(await s.signedUrl(key,300),307);response.headers.set('Cache-Control','private, no-store');return response;}catch{return NextResponse.json({error:'ARTIFACT_UNAVAILABLE'},{status:503});}
}
