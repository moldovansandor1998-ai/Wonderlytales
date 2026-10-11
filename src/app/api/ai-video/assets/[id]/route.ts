import {NextRequest,NextResponse} from 'next/server';
import {access,apiError} from '@/lib/ai-video/http';
import {R2VideoStore} from '@/lib/ai-video/storage';
import {WaveSpeedError} from '@/lib/providers/wavespeed';
export const dynamic='force-dynamic';export const maxDuration=120;
export async function GET(r:NextRequest,{params}:{params:{id:string}}){try{
 const u=await access(r),extension=r.nextUrl.searchParams.get('type')??'mp4';
 if(!['mp3','mp4','wav'].includes(extension))throw new WaveSpeedError('INVALID_INPUT',400);
 const range=r.headers.get('range');if(range&&!/^bytes=\d*-\d*$/.test(range))throw new WaveSpeedError('INVALID_INPUT',400);
 const source=await fetch(await new R2VideoStore(u.id).assetUrl(params.id,extension as 'mp3'|'mp4'|'wav'),{redirect:'error',signal:AbortSignal.timeout(90000),headers:range?{Range:range}:{}});
 if(!source.ok)throw new WaveSpeedError('MEDIA_UNAVAILABLE',404);
 const headers=new Headers({'Cache-Control':'private, no-store','Content-Type':extension==='mp4'?'video/mp4':extension==='wav'?'audio/wav':'audio/mpeg','Accept-Ranges':'bytes'});
 if(r.nextUrl.searchParams.get('download')==='1')headers.set('Content-Disposition',`attachment; filename="wonderlytales-${params.id}.${extension}"`);
 for(const h of ['content-length','content-range']){const v=source.headers.get(h);if(v)headers.set(h,v);}return new NextResponse(source.body,{status:source.status,headers});
}catch(e){return apiError(e);}}
