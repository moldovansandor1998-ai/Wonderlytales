"use server";
import { createServerSupabase, requireStudioUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
export async function controlFilm(id: string, action: string) {
 await requireStudioUser();
 const db=createServerSupabase();
 if(action==='RESUME'){
  const {data,error}=await db.from('film_runs').select('quality_report').eq('id',id).single();
  if(error||!data)throw new Error('A gyártási futás nem ellenőrizhető.');
  if(data.quality_report?.archived===true)throw new Error('Ez a korábbi sorozat archív futása; nem indítható újra.');
 }
 const {error} = await db.rpc("control_film", {p_run:id,p_action:action});
 if (error) throw new Error(error.message);
 revalidatePath("/production");
}
