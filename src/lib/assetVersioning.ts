import type { Db } from "./db";
import { newId, now } from "./db";

export class LockedAssetError extends Error {}

interface VersionRow { id: string; version: string; status: "DRAFT"|"LOCKED"; locked_at: string | null; }

/** LOCKED production asset nem módosítható in-place; módosítás = új verzió */
export async function lockVersion(db: Db, table: string, id: string): Promise<void> {
  const v = await db.get<VersionRow>(table, id);
  if (!v) throw new Error("Version not found");
  await db.update<VersionRow>(table, id, { status: "LOCKED", locked_at: now() });
}

export async function assertEditable(db: Db, table: string, id: string): Promise<void> {
  const v = await db.get<VersionRow>(table, id);
  if (!v) throw new Error("Version not found");
  if (v.status === "LOCKED") throw new LockedAssetError(`A(z) ${v.version} verzió LOCKED – módosítás csak új verzióként lehetséges.`);
}

export function nextVersion(current: string): string {
  const n = parseInt(current.replace(/^V/, ""), 10) + 1;
  return `V${String(n).padStart(3, "0")}`;
}
export { newId };
