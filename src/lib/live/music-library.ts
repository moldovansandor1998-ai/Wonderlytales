import type { MusicMood } from "./music-director";
export type SavedTrack = { id: string; title: string; mood: MusicMood | "any"; file: Blob };
const STORE = "tracks";
async function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("wonderly-live-music-v1", 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function readMusic(): Promise<SavedTrack[]> {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(STORE).objectStore(STORE).getAll();
      request.onsuccess = () => resolve((request.result as SavedTrack[]).filter(track => track.file instanceof Blob && typeof track.title === "string" && typeof track.id === "string"));
      request.onerror = () => reject(request.error);
    });
  } finally { db.close(); }
}
export async function writeMusic(track: SavedTrack) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).put(track);
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
export async function deleteMusic(id: string) {
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
