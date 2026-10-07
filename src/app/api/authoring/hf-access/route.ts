import { NextResponse } from "next/server";
import { getStudioUser } from "@/lib/auth";
import { checkHuggingFaceAccess } from "@/lib/providers/huggingface";

export const dynamic = "force-dynamic";
export async function GET() {
  const user = await getStudioUser();
  if (!user) return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  if (!["admin", "studio"].includes(user.role)) return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  return NextResponse.json(await checkHuggingFaceAccess(process.env.HF_TOKEN), { headers: { "Cache-Control": "no-store" } });
}
