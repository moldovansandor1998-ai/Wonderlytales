import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareSupabase } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const res = NextResponse.redirect(new URL("/", req.url));
  if (code) {
    const supabase = createMiddlewareSupabase(req, res);
    await supabase.auth.exchangeCodeForSession(code);
  }
  return res;
}
