import { randomUUID } from "crypto";
import { getStorage } from "../src/lib/providers/storage";

async function main() {
  if (process.env.STORAGE_PROVIDER !== "s3") throw new Error("Storage smoke requires STORAGE_PROVIDER=s3; local storage is not production proof.");
  const storage = getStorage();
  const key = `smoke/${randomUUID()}.txt`;
  const payload = Buffer.from("Wonderly R2 storage smoke");
  let uploaded = false;
  try {
    await storage.put(key, payload, "text/plain"); uploaded = true;
    if (!await storage.exists(key)) throw new Error("HEAD failed");
    if (!(await storage.get(key)).equals(payload)) throw new Error("GET mismatch");
    const response = await fetch(await storage.signedUrl(key, 60));
    if (!response.ok || !Buffer.from(await response.arrayBuffer()).equals(payload)) throw new Error("Signed GET failed");
    await storage.delete(key); uploaded = false;
    if (await storage.exists(key)) throw new Error("DELETE failed");
    console.log("PASS: R2 PUT / HEAD / GET / signed GET / DELETE");
  } finally { if (uploaded) await storage.delete(key); }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
