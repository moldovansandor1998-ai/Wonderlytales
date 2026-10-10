import { NextRequest, NextResponse } from "next/server";
import { requireStudioUser, createServerSupabase } from "@/lib/auth";
import { getStorage } from "@/lib/providers/storage";
export async function GET(req:NextRequest) {
 try { await requireStudioUser(); } catch { return NextResponse.json({error:"UNAUTHORIZED"},{status:401}); }
 const id=req.nextUrl.searchParams.get("run");
 if(!id || !/^[a-f0-9-]{36}$/i.test(id))return NextResponse.json({error:"INVALID_RUN"},{status:400});
 const {data,error}=await createServerSupabase().from("film_runs").select("output_key").eq("id",id).maybeSingle();
 if(error || !data?.output_key)return NextResponse.json({error:"VIDEO_NOT_AVAILABLE"},{status:404});
 const url=await getStorage().signedUrl(data.output_key,300);
 return NextResponse.redirect(url,{headers:{"Cache-Control":"private, no-store"}});
}
