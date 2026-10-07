/** Read-only access check; never schedules authoring or exposes the token. */
export const DINO_MODEL = "facebook/dinov3-vitl16-pretrain-lvd1689m";

export async function checkHuggingFaceAccess(token: string | undefined) {
  if (!token) return { status: "BLOCKED_MISSING_HF_TOKEN", model: DINO_MODEL };
  try {
    const options = { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" as const, signal: AbortSignal.timeout(15000) };
    const identity = await fetch("https://huggingface.co/api/whoami-v2", options);
    if (identity.status !== 200) return { status: "BLOCKED_TOKEN_VALIDATION", model: DINO_MODEL, identityHttpStatus: identity.status };
    const response = await fetch(`https://huggingface.co/${DINO_MODEL}/resolve/main/config.json`, { ...options, signal: AbortSignal.timeout(15000) });
    if (response.status !== 200) return { status: "BLOCKED_MODEL_ACCESS", model: DINO_MODEL, modelHttpStatus: response.status };
    const configuration: unknown = await response.json();
    if (!configuration || typeof configuration !== "object" || Array.isArray(configuration)) return { status: "INVALID_CONFIG", model: DINO_MODEL };
    return { status: "VERIFIED", model: DINO_MODEL, identityHttpStatus: 200, modelHttpStatus: 200 };
  } catch {
    return { status: "BLOCKED_NETWORK_OR_RESPONSE", model: DINO_MODEL };
  }
}
