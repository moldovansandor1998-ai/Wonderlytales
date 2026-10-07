import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const exchange = vi.hoisted(() => vi.fn());
vi.mock("@/lib/auth", () => ({ createMiddlewareSupabase: (_req: unknown, res: { cookies: { set: (name: string, value: string) => void } }) => {
  res.cookies.set("test-session", "set-by-auth");
  return { auth: { exchangeCodeForSession: exchange } };
} }));
import { GET } from "@/app/auth/callback/route";
import { safeAuthNext } from "@/lib/auth-navigation";
const req = (query: string) => new NextRequest(`https://studio.example/auth/callback${query}`);
describe("Authentication callbacks", () => {
  beforeEach(() => { exchange.mockReset(); exchange.mockResolvedValue({ error: null }); });
  it("requires a code before touching authentication", async () => {
    expect((await GET(req(""))).headers.get("location")).toBe("https://studio.example/login?error=link");
    expect(exchange).not.toHaveBeenCalled();
  });
  it("reports expired or rejected links without leaking their codes", async () => {
    exchange.mockResolvedValue({ error: { message: "private code" } });
    const response = await GET(req("?code=private"));
    expect(response.headers.get("location")).toBe("https://studio.example/login?error=link");
  });
  it("retains session cookies when entering the password-change page", async () => {
    const response = await GET(req("?code=valid&next=/auth/update-password"));
    expect(response.headers.get("location")).toBe("https://studio.example/auth/update-password");
    expect(response.cookies.get("test-session")?.value).toBe("set-by-auth");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });
  it("ignores external callback destinations", async () => {
    expect((await GET(req("?code=valid&next=https://evil.example"))).headers.get("location")).toBe("https://studio.example/");
  });
  it("handles a transport failure", async () => {
    exchange.mockRejectedValue(new Error("offline"));
    expect((await GET(req("?code=valid"))).headers.get("location")).toBe("https://studio.example/login?error=link");
  });
  it("rejects browser-normalized external redirects after password login", () => {
    for (const path of ["//evil.example", "/\\evil.example", "https://evil.example", "/\nevil"]) expect(safeAuthNext(path)).toBe("/");
    expect(safeAuthNext("/characters")).toBe("/characters");
  });
});
