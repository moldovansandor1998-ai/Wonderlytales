import { describe, it, expect } from "vitest";
import { JsonDb } from "@/lib/db/json";
import { lockVersion, assertEditable, nextVersion, LockedAssetError } from "@/lib/assetVersioning";
import { promises as fs } from "fs";
import { tmpdir } from "os";
import path from "path";

async function tmpDb() {
  const f = path.join(tmpdir(), `wt-${Math.random()}.json`);
  await fs.writeFile(f, JSON.stringify({ character_versions: [{ id: "v1", version: "V001", status: "DRAFT", locked_at: null }] }));
  const db = new JsonDb(f); await db.init(); return db;
}

describe("Asset versioning", () => {
  it("nextVersion V001 → V002", () => { expect(nextVersion("V001")).toBe("V002"); expect(nextVersion("V099")).toBe("V100"); });
  it("LOCKED verzió nem módosítható", async () => {
    const db = await tmpDb();
    await lockVersion(db, "character_versions", "v1");
    await expect(assertEditable(db, "character_versions", "v1")).rejects.toBeInstanceOf(LockedAssetError);
  });
  it("DRAFT verzió szerkeszthető", async () => {
    const db = await tmpDb();
    await expect(assertEditable(db, "character_versions", "v1")).resolves.toBeUndefined();
  });
});
