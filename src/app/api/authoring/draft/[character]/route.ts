import { NextResponse } from "next/server";
import { createServerSupabase, getStudioUser } from "@/lib/auth";
import { getStorage } from "@/lib/providers/storage";

export const dynamic = "force-dynamic";

/** Authenticated review of an actual recorded draft; never exposes storage credentials. */
export async function GET(_request: Request, { params }: { params: { character: string } }) {
  const user = await getStudioUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!["admin", "studio"].includes(user.role)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  if (!["CHAR_MARK", "CHAR_LILI"].includes(params.character)) {
    return NextResponse.json({ error: "UNKNOWN_CHARACTER" }, { status: 404 });
  }
  const db = createServerSupabase();
  const { data: character } = await db.from("characters").select("id").eq("code", params.character).single();
  if (!character) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  const { data: version } = await db.from("character_versions").select("model_asset_id,status")
    .eq("character_id", character.id).eq("version", "V005").single();
  if (!version?.model_asset_id || version.status !== "DRAFT") {
    return NextResponse.json({ error: "DRAFT_NOT_AVAILABLE" }, { status: 404 });
  }
  const { data: asset } = await db.from("assets").select("object_key,sha256,kind,metadata")
    .eq("id", version.model_asset_id).single();
  const expected = `assets/characters/${params.character}/drafts/V005/${asset?.sha256}.glb`;
  if (!asset || asset.kind !== "CHARACTER_MODEL" || !/^[a-f0-9]{64}$/.test(asset.sha256)
    || asset.object_key !== expected || asset.metadata?.status !== "DRAFT_UNRIGGED") {
    return NextResponse.json({ error: "DRAFT_NOT_VERIFIED" }, { status: 409 });
  }
  try {
    const storage = getStorage();
    if (!(await storage.exists(expected))) return NextResponse.json({ error: "ASSET_MISSING" }, { status: 404 });
    return NextResponse.redirect(await storage.signedUrl(expected, 900), {
      status: 307, headers: { "Cache-Control": "private, no-store" },
    });
  } catch {
    return NextResponse.json({ error: "DRAFT_STORAGE_UNAVAILABLE" }, { status: 503 });
  }
}
