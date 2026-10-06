import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareSupabase } from "@/lib/auth";

const PUBLIC_PATHS = ["/login", "/auth/callback", "/_next", "/favicon.ico"];

/** Pure route-döntés – külön tesztelhető */
export function decideRoute(pathname: string, authEnabled: boolean, hasUser: boolean): "allow" | "redirect-login" {
  if (!authEnabled) return "allow";
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return "allow";
  return hasUser ? "allow" : "redirect-login";
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const enabled = !!(process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY));
  if (!enabled) return NextResponse.next();
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const res = NextResponse.next();
  const supabase = createMiddlewareSupabase(req, res);
  const { data: { user } } = await supabase.auth.getUser();
  if (decideRoute(pathname, enabled, !!user) === "redirect-login") {
    const login = new URL("/login", req.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }
  return res;
}

export const config = { matcher: ["/((?!_next/static|_next/image|files).*)"] };
