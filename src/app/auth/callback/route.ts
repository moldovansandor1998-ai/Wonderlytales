import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareSupabase } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const failure = () => NextResponse.redirect(new URL("/login?error=link", req.url));
  const code = req.nextUrl.searchParams.get("code");
  if (!code || req.nextUrl.searchParams.has("error")) return failure();
  // Recovery is the only supported alternate callback destination.
  const next = req.nextUrl.searchParams.get("next") === "/auth/update-password" ? "/auth/update-password" : "/";
  const res = NextResponse.redirect(new URL(next, req.url));
  res.headers.set("Cache-Control", "private, no-store");
  try {
    const supabase = createMiddlewareSupabase(req, res);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return failure();
    return res;
  } catch {
    return failure();
  }
}
