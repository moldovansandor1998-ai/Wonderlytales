import { gzipSync } from "node:zlib";
import { NextResponse } from "next/server";
import { createServerSupabase, getStudioUser } from "@/lib/auth";
import { getStorage } from "@/lib/providers/storage";

export const dynamic = "force-dynamic";
export const maxDuration = 300;
const versions: Record<string, string> = { CHAR_MARK: "V005", CHAR_LILI: "V005", CHAR_MORZSI: "V006", CHAR_POTTY: "V006", CHAR_BOGYO: "V006", CHAR_ZIZI: "V006" };

/** Authenticated review of an actual recorded draft; never exposes storage credentials. */
export async function GET(request: Request, { params }: { params: { character: string } }) {
  const user = await getStudioUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!["admin", "studio"].includes(user.role)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  const referenceVersion = versions[params.character];
  if (!referenceVersion) {
    return NextResponse.json({ error: "UNKNOWN_CHARACTER" }, { status: 404 });
  }
  const db = createServerSupabase();
  const { data: character } = await db.from("characters").select("id").eq("code", params.character).single();
  if (!character) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const { data: version } = await db.from("character_versions").select("model_asset_id,status")
    .eq("character_id", character.id).eq("version", referenceVersion).single();
  if (!version?.model_asset_id || version.status !== "DRAFT") {
    return NextResponse.json({ error: "DRAFT_NOT_AVAILABLE" }, { status: 404 });
  }
  const { data: asset } = await db.from("assets").select("object_key,sha256,kind,metadata")
    .eq("id", version.model_asset_id).single();
  const expected = `assets/characters/${params.character}/drafts/${referenceVersion}/${asset?.sha256}.glb`;
  if (!asset || asset.kind !== "CHARACTER_MODEL" || !/^[a-f0-9]{64}$/.test(asset.sha256)
    || asset.object_key !== expected || asset.metadata?.status !== "DRAFT_UNRIGGED") {
    return NextResponse.json({ error: "DRAFT_NOT_VERIFIED" }, { status: 409 });
  }
  try {
    const storage = getStorage();
    if (!(await storage.exists(expected))) return NextResponse.json({ error: "ASSET_MISSING" }, { status: 404 });
    const compressed = new URL(request.url).searchParams.get("format") === "gzip";
    const raw = await storage.get(expected);
    const bytes = compressed ? gzipSync(raw) : raw;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (let offset = 0; offset < bytes.length; offset += 65536) controller.enqueue(new Uint8Array(bytes.subarray(offset, offset + 65536)));
        controller.close();
      },
    });
    return new NextResponse(stream, { headers: {
      "Cache-Control": "private, no-store", "Content-Type": compressed ? "application/gzip" : "model/gltf-binary",
      "Content-Disposition": `attachment; filename="${params.character}_${referenceVersion}_UNRIGGED_DRAFT.glb${compressed ? ".gz" : ""}"`,
    }});
  } catch {
    return NextResponse.json({ error: "DRAFT_STORAGE_UNAVAILABLE" }, { status: 503 });
  }
}
