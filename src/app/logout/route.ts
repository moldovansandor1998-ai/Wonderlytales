import { NextResponse } from "next/server";
import { createServerSupabase, authEnabled } from "@/lib/auth";

export async function GET(req: Request) {
  if (authEnabled()) {
    const supabase = createServerSupabase();
    await supabase.auth.signOut();
  }
  return NextResponse.redirect(new URL("/login", req.url));
}
