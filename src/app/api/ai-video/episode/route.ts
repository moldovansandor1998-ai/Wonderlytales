import {NextRequest,NextResponse} from 'next/server';
import {access,apiError,json,readJson} from '@/lib/ai-video/http';
import {R2VideoStore} from '@/lib/ai-video/storage';
import {episodeAction,episodeOverview} from '@/lib/ai-video/episode';
export const dynamic='force-dynamic';
export const maxDuration=120;
export async function GET(request:NextRequest){try{const user=await access(request);const data=await episodeOverview(new R2VideoStore(user.id));if(request.nextUrl.searchParams.get('export')==='1')return new NextResponse(JSON.stringify({...data,exportedAt:new Date().toISOString(),assemblyStatus:'SOURCES_ONLY_NOT_A_FINAL_FILM',audioWorkflow:'ElevenLabs audio is separate. Visible dialogue needs lip-sync before final mastering.'},null,2),{headers:{'Content-Type':'application/json','Content-Disposition':'attachment; filename="Titokvaros_1_resz_vagasi_terv.json"','Cache-Control':'private, no-store'}});return json(data);}catch(e){return apiError(e);}}
export async function POST(request:NextRequest){try{const user=await access(request,true);return json(await episodeAction(await readJson(request),new R2VideoStore(user.id)));}catch(e){return apiError(e);}}
