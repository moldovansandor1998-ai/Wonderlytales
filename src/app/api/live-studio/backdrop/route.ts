import { NextRequest } from "next/server";
import { z } from "zod";
import { access, apiError, json, readJson } from "@/lib/ai-video/http";
import { R2VideoStore } from "@/lib/ai-video/storage";
import { AvatarError } from "@/lib/live/avatar";
import { readBackdrop, startBackdrop } from "@/lib/live/backdrop";
export const runtime = "nodejs";
export const maxDuration = 120;
const failure = (e: unknown) => e instanceof AvatarError ? json({ error: e.code }, e.status) : apiError(e);
export async function GET(request: NextRequest) {
  try { const user = await access(request); return json(await readBackdrop(new R2VideoStore(user.id))); }
  catch (e) { return failure(e); }
}
export async function POST(request: NextRequest) {
  try {
    const user = await access(request, true);
    z.object({}).strict().parse(await readJson(request));
    const result = await startBackdrop(new R2VideoStore(user.id));
    return json({ status: result.status });
  } catch (e) { return failure(e); }
}
