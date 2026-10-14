type Detail = { name?: string; exception?: unknown; message?: string; config?: { requestErr?: unknown; requestErrs?: unknown[] } };
/** Return only fixed, safe diagnostics. Provider payloads can contain cookies or tokens. */
export function tikTokFailure(error: unknown): {code:string;message:string} {
  const detail = (error && typeof error === "object" ? error : {}) as Detail;
  if (detail.exception) return tikTokFailure(detail.exception);
  const name = error instanceof Error ? error.constructor.name : detail.name || "UnknownError";
  const message = detail.message || "";
  if (name === "UserOfflineError") return {code:"TIKTOK_OFFLINE",message:"Ez a TikTok-fiók jelenleg nincs élő adásban. Indítsd el a LIVE-ot a TikTokban, majd itt az automata műsort."};
  if (name === "InvalidUniqueIdError") return {code:"TIKTOK_USERNAME",message:"A TikTok-felhasználónév nem megfelelő. A @ utáni azonosítót add meg, ne a megjelenített nevet."};
  if (name === "SignatureRateLimitError" || /(?:status|code|http)\D{0,10}429/i.test(message)) return {code:"TIKTOK_RATE_LIMIT",message:"A kommentkapcsolat szolgáltatója elérte a kapcsolódási korlátot. Várj néhány percet; új videógenerálás nem indult."};
  if (["SignAPIError","PremiumFeatureError","SignatureMissingTokensError","AuthenticatedWebSocketConnectionError"].includes(name)) return {code:"TIKTOK_SIGN_SERVICE",message:"A TikTok-kapcsolat aláíró szolgáltatója nem engedte a csatlakozást. A szerver Euler Stream hozzáférését vagy keretét kell ellenőrizni."};
  if (name === "ConnectTimeoutError" || /timeout|timed out/i.test(message)) return {code:"TIKTOK_TIMEOUT",message:"A TikTok nem válaszolt időben. Ellenőrizd, hogy fut-e az adás, majd csatlakozz újra."};
  const nested = [...(detail.config?.requestErrs || []), detail.config?.requestErr].filter(Boolean);
  for (const inner of nested) {
    // Inspect one level only: no arbitrary recursive provider objects.
    const value = inner as Detail;
    const known = tikTokFailure({name:inner instanceof Error ? inner.constructor.name : value.name,message:value.message});
    if (known.code !== "TIKTOK_CONNECT_FAILED") return known;
  }
  return {code:"TIKTOK_CONNECT_FAILED",message:"Nem sikerült kiolvasni a TikTok-adást. Ellenőrizd a @felhasználónevet és azt, hogy már fut-e a LIVE. Szolgáltatói korlátozás is okozhatja."};
}
