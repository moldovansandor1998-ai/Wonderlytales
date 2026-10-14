import type { MusicTrack } from "./dj";
export type SavedMusic = Omit<MusicTrack, "url"> & { file: Blob };

async function database() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("wonderly-live-music-v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("tracks", { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("A zenetárat egy másik ablak használja."));
  });
}
export async function musicLibrary(action: "list"): Promise<SavedMusic[]>;
export async function musicLibrary(action: "save", record: SavedMusic): Promise<void>;
export async function musicLibrary(action: "remove", id: string): Promise<void>;
export async function musicLibrary(action: "list" | "save" | "remove", value?: SavedMusic | string): Promise<SavedMusic[] | void> {
  const db = await database();
  try {
    return await new Promise<SavedMusic[] | void>((resolve, reject) => {
      const transaction = db.transaction("tracks", action === "list" ? "readonly" : "readwrite"), store = transaction.objectStore("tracks");
      const request = action === "list" ? store.getAll() : action === "save" ? store.put(value) : store.delete(value as string);
      transaction.oncomplete = () => resolve(action === "list" ? request.result as SavedMusic[] : undefined);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error || new Error("A zenetár mentése megszakadt."));
    });
  } finally { db.close(); }
}
