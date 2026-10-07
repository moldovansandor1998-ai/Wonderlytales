/** Supabase SSR auth – szerveroldali session kezelés. Mock módban (nincs Supabase env) auth nincs kikényszerítve. */
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { isProduction } from "./config";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

export function authEnabled(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY));
}

export function createServerSupabase() {
  const cookieStore = cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(toSet: { name: string; value: string; options: CookieOptions }[]) {
        try { toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)); } catch { /* Server Componentből hívva – middleware frissíti */ }
      },
    },
  });
}

export function createMiddlewareSupabase(req: NextRequest, res: NextResponse) {
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!, {
    cookies: {
      getAll() { return req.cookies.getAll(); },
      setAll(toSet: { name: string; value: string; options: CookieOptions }[]) { toSet.forEach(({ name, value, options }) => { req.cookies.set(name, value); res.cookies.set(name, value, options); }); },
    },
  });
}

export interface StudioUser { id: string; email: string; role: "admin" | "studio" | "viewer"; }

/** Only administrator-assigned app_metadata roles grant Studio access. */
export async function getStudioUser(): Promise<StudioUser | null> {
  if (!authEnabled()) {
    if (isProduction()) return null;
    return { id: "local-dev", email: "dev@localhost", role: "admin" };
  }
  const supabase = createServerSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const role = (user.app_metadata?.role as StudioUser["role"]) ?? "viewer";
  return { id: user.id, email: user.email ?? "", role };
}

export async function requireStudioUser(): Promise<StudioUser> {
  const u = await getStudioUser();
  if (!u) throw new Error("UNAUTHORIZED");
  if (!["admin", "studio"].includes(u.role)) throw new Error("FORBIDDEN");
  return u;
}
