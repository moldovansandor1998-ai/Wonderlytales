import { describe, it, expect } from "vitest";
import { promises as fs } from "fs";
import path from "path";

describe("Auth protection (route döntés)", () => {
  it("mock módban minden route engedett", async () => {
    const { decideRoute } = await import("@/middleware");
    expect(decideRoute("/characters", false, false)).toBe("allow");
  });
  it("production: anon user → /login redirect", async () => {
    const { decideRoute } = await import("@/middleware");
    expect(decideRoute("/characters", true, false)).toBe("redirect-login");
    expect(decideRoute("/", true, false)).toBe("redirect-login");
  });
  it("production: bejelentkezett Studio user → allow", async () => {
    const { decideRoute } = await import("@/middleware");
    expect(decideRoute("/characters", true, true)).toBe("allow");
  });
  it("login és auth callback mindig nyilvános", async () => {
    const { decideRoute } = await import("@/middleware");
    expect(decideRoute("/login", true, false)).toBe("allow");
    expect(decideRoute("/auth/callback", true, false)).toBe("allow");
  });
  it("service-role key nem kerül kliens komponensbe", async () => {
    // fájl-scan: kliens komponensekben nem szerepelhet SUPABASE_SERVICE_ROLE_KEY
    const scanDir = async (dir: string): Promise<string[]> => {
      const out: string[] = [];
      for (const e of await fs.readdir(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) out.push(...await scanDir(p));
        else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
      }
      return out;
    };
    const files = await scanDir(path.join(process.cwd(), "src"));
    for (const f of files) {
      const content = await fs.readFile(f, "utf8");
      const isClient = content.startsWith('"use client"');
      if (isClient) expect(content).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    }
  });
});

describe("RLS smoke (migráció ellenőrzés)", () => {
  it("minden táblán RLS bekapcsolva + authenticated policy", async () => {
    const sql = await fs.readFile(path.join(process.cwd(), "supabase/migrations/0001_init.sql"), "utf8");
    const tables = [...sql.matchAll(/create table (?:if not exists )?(\w+)/g)].map((m) => m[1]);
    expect(tables.length).toBeGreaterThan(20);
    const rlsEnabled = [...sql.matchAll(/alter table (\w+) enable row level security/g)].map((m) => m[1]);
    const policyLoop = /create policy studio_user_all/.test(sql);
    for (const t of tables.filter((t) => t !== "profiles")) {
      expect(rlsEnabled.includes(t) || policyLoop).toBe(true);
    }
    // anon user nem módosíthat: policy-k csak 'authenticated' szerepre
    expect(sql).not.toMatch(/to anon\b/);
    expect(sql).toContain("to authenticated");
  });
});
