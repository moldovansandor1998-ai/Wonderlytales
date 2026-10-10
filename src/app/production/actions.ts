"use server";
import { createServerSupabase, requireStudioUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
export async function controlFilm(id: string, action: string) {
 await requireStudioUser();
 const {error} = await createServerSupabase().rpc("control_film", {p_run:id,p_action:action});
 if (error) throw new Error(error.message);
 revalidatePath("/production");
}
