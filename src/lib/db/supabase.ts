import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Db } from "./index";

/**
 * Supabase adapter – service-role key KIZÁRÓLAG szerveroldalon használható,
 * soha ne importáld kliens komponensből. RLS bekapcsolva minden táblán;
 * a service role bypassolja az RLS-t, ezért az API route-okban auth check kell.
 */
export class SupabaseDb implements Db {
  private client: SupabaseClient;
  constructor(url: string, serviceKey: string) {
    this.client = createClient(url, serviceKey, { auth: { persistSession: false } });
  }
  mode(): "supabase" { return "supabase"; }
  async list<T>(table: string): Promise<T[]> {
    const { data, error } = await this.client.from(table).select("*");
    if (error) throw new Error(error.message);
    return (data ?? []) as T[];
  }
  async find<T>(table: string, pred: (row: T) => boolean): Promise<T[]> {
    return (await this.list<T>(table)).filter(pred);
  }
  async get<T extends { id: string }>(table: string, id: string): Promise<T | null> {
    const { data, error } = await this.client.from(table).select("*").eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return (data as T) ?? null;
  }
  async insert<T extends { id: string }>(table: string, row: T): Promise<T> {
    const { data, error } = await this.client.from(table).insert(row).select().single();
    if (error) throw new Error(error.message);
    return data as T;
  }
  async update<T extends { id: string }>(table: string, id: string, patch: Partial<T>): Promise<T> {
    const { data, error } = await this.client.from(table).update(patch as never).eq("id", id).select().single();
    if (error) throw new Error(error.message);
    return data as T;
  }
  async remove(table: string, id: string): Promise<void> {
    const { error } = await this.client.from(table).delete().eq("id", id);
    if (error) throw new Error(error.message);
  }
}
