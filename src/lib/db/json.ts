import { promises as fs } from "fs";
import path from "path";
import type { Db } from "./index";

export class JsonDb implements Db {
  private FILE: string;
  constructor(file?: string) { this.FILE = file ?? path.join(process.cwd(), "data", "demo.json"); }
  private store: Record<string, unknown[]> = {};
  private loaded = false;

  async init() {
    if (this.loaded) return;
    try {
      this.store = JSON.parse(await fs.readFile(this.FILE, "utf8"));
    } catch {
      const { buildDemoData } = await import("../seed");
      this.store = buildDemoData() as Record<string, unknown[]>;
      await this.persist();
    }
    this.loaded = true;
  }
  private async persist() {
    await fs.mkdir(path.dirname(this.FILE), { recursive: true });
    await fs.writeFile(this.FILE, JSON.stringify(this.store, null, 2));
  }
  mode(): "mock" { return "mock"; }
  async list<T>(table: string): Promise<T[]> {
    return ((this.store[table] ?? []) as T[]);
  }
  async find<T>(table: string, pred: (row: T) => boolean): Promise<T[]> {
    return ((this.store[table] ?? []) as T[]).filter(pred);
  }
  async get<T extends { id: string }>(table: string, id: string): Promise<T | null> {
    return ((this.store[table] ?? []) as T[]).find((r) => r.id === id) ?? null;
  }
  async insert<T extends { id: string }>(table: string, row: T): Promise<T> {
    (this.store[table] ??= []).push(row);
    await this.persist();
    return row;
  }
  async update<T extends { id: string }>(table: string, id: string, patch: Partial<T>): Promise<T> {
    const rows = (this.store[table] ?? []) as T[];
    const i = rows.findIndex((r) => r.id === id);
    if (i < 0) throw new Error(`Not found: ${table}/${id}`);
    rows[i] = { ...rows[i], ...patch };
    await this.persist();
    return rows[i];
  }
  async remove(table: string, id: string): Promise<void> {
    this.store[table] = ((this.store[table] ?? []) as { id: string }[]).filter((r) => r.id !== id);
    await this.persist();
  }
}
