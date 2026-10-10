import {NextRequest,NextResponse} from "next/server";
import {createServerSupabase,requireStudioUser} from "@/lib/auth";
export async function POST(req:NextRequest) {
 try { await requireStudioUser(); } catch { return NextResponse.json({error:"UNAUTHORIZED"},{status:401}); }
 const raw=await req.text();
 if(Buffer.byteLength(raw)>2_000_000)return NextResponse.json({error:"MANIFEST_TOO_LARGE"},{status:413});
 let p:{episode_id:string;title:string;mode:string;manifest:unknown;quality_report:unknown};
 try{p=JSON.parse(raw);}catch{return NextResponse.json({error:"INVALID_JSON"},{status:400});}
 if(!p.title || p.title.length>200 || !["DIAGNOSTIC","FEATURE"].includes(p.mode) || !/^[a-f0-9-]{36}$/i.test(p.episode_id))return NextResponse.json({error:"INVALID_FILM"},{status:400});
 const {data,error}=await createServerSupabase().rpc("enqueue_film",{p_episode:p.episode_id,p_title:p.title,p_mode:p.mode,p_manifest:p.manifest,p_quality:p.quality_report??{}});
 if(error)return NextResponse.json({error:error.message},{status:400});
 return NextResponse.json({id:data,status:"HELD",production_approved:false},{status:201});
}
