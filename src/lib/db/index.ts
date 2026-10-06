/**
 * Adatelérési réteg. Ha a Supabase env változók meg vannak adva, Supabase
 * adapter indul; egyébként lokális JSON-alapú MOCK adatbázis (data/demo.json),
 * automatikus demo seeddel. Így kulcs nélkül is végigtesztelhető a rendszer.
 */
import type { JsonDb } from "./json";

export interface Db {
  list<T>(table: string): Promise<T[]>;
  find<T>(table: string, pred: (row: T) => boolean): Promise<T[]>;
  get<T extends { id: string }>(table: string, id: string): Promise<T | null>;
  insert<T extends { id: string }>(table: string, row: T): Promise<T>;
  update<T extends { id: string }>(table: string, id: string, patch: Partial<T>): Promise<T>;
  remove(table: string, id: string): Promise<void>;
  mode(): "supabase" | "mock";
}

let cached: Db | null = null;

export async function getDb(): Promise<Db> {
  if (cached) return cached;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const publishable = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (process.env.VERCEL && (!url || !publishable)) throw new Error("Production database configuration missing: Supabase URL / publishable key");
  if (url && (key || publishable)) {
    const { SupabaseDb } = await import("./supabase");
    cached = new SupabaseDb(key ? url : undefined, key);
  } else {
    const { JsonDb: J } = await import("./json");
    const db: JsonDb = new J();
    await db.init();
    cached = db;
  }
  return cached;
}

export function newId(): string {
  return crypto.randomUUID();
}
export function now(): string {
  return new Date().toISOString();
}
