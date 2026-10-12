import {NextRequest,NextResponse} from 'next/server';
import {start} from 'workflow/api';
import {access,json,apiError,readJson} from '@/lib/ai-video/http';
import {R2VideoStore} from '@/lib/ai-video/storage';
import {readCut,cutAction} from '@/lib/ai-video/film-cut';
import {filmCut} from '@/workflows/film-cut';
export const dynamic='force-dynamic';export const maxDuration=120;
export async function GET(r:NextRequest){try{
 const u=await access(r),cut=await readCut(new R2VideoStore(u.id));
 if(r.nextUrl.searchParams.get('export')==='1')return new NextResponse(JSON.stringify({cut,exportedAt:new Date().toISOString(),reviewStatus:'PREVIEW_NOT_FINAL_APPROVAL'},null,2),{headers:{'Content-Type':'application/json','Content-Disposition':`attachment; filename="Titokvaros_bevezeto_${cut?.masterLastScene??15}_vagasi_terv.json"`,'Cache-Control':'private, no-store'}});
 return json({cut});
}catch(e){return apiError(e);}}
export async function POST(r:NextRequest){try{
 const u=await access(r,true),body=await readJson(r),result=await cutAction(body,new R2VideoStore(u.id));
 if(result.cut?.status==='QUEUED')await start(filmCut,[u.id]);
 return json(result);
}catch(e){return apiError(e);}}
