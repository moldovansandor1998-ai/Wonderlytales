type Detail = { name?: string; exception?: unknown; cause?: unknown; message?: string; reason?: string; response?: {status?:number;statusCode?:number}; config?: { routeId?:string; requestErr?: unknown; requestErrs?: unknown[] } };
function details(error:unknown,seen=new Set<unknown>(),depth=0):Detail[] {
  if (!error || typeof error!=="object" || seen.has(error) || depth>4 || seen.size>=20) return [];
  seen.add(error);const value=error as Detail;
  return [value,...[value.exception,value.cause,value.config?.requestErr,...(value.config?.requestErrs||[])].flatMap(inner=>details(inner,seen,depth+1))];
}
/** Fixed labels only: never return provider messages, URLs, headers, or payloads. */
export function tikTokDiagnostics(error:unknown) {
  return details(error).map(value=>{
    const message=value.message||"";
    const routes=["fetchRoomIdRoute","fetchRoomInfoRoute","fetchRoomInfoHtmlRoute","fetchRoomInfoApiLiveRoute","fetchRoomIdFromEulerRoute","fetchSignedWebSocketFromEulerRoute"];
    const route=routes.find(route=>value.config?.routeId===route||message.includes(`[${route}]`));
    const http=value.response?.status??value.response?.statusCode;
    const reasons=["Rate Limited","Connect Error","Empty Payload","Sign Error","Empty Cookies","Premium Feature","Authenticated WS"];
    return {route:route||"unknown",...(http&&http>=100&&http<=599?{http}:{}),
      ...(reasons.includes(value.reason||"")?{reason:value.reason}:{}),
      htmlMissing:/Failed to extract.*(?:SIGI_STATE|LiveRoom)/.test(message),
      permission:/lack of permission|do not have permission|Unauthorized/i.test(message),
      offline:/requested user isn't online|user is offline/i.test(message),
      timeout:/timeout|timed out/i.test(message)};
  });
}
/** Return only fixed, safe diagnostics. Provider payloads can contain cookies or tokens. */
export function tikTokFailure(error: unknown): {code:string;message:string} {
  const nodes=details(error);
  // SDK constructor names are minified by the production build. Its fixed messages,
  // reason and HTTP status survive; traverse nested transport errors without copying payloads.
  for (const detail of nodes) {
  const error=detail;
  const name = error instanceof Error ? error.constructor.name : detail.name || "UnknownError";
  const message = detail.message || "";
  if (name === "UserOfflineError" || /requested user isn't online|user is offline/i.test(message)) return {code:"TIKTOK_OFFLINE",message:"Ez a TikTok-fiók jelenleg nincs élő adásban. Indítsd el a LIVE-ot a TikTokban, majd itt az automata műsort."};
  if (name === "InvalidUniqueIdError") return {code:"TIKTOK_USERNAME",message:"A TikTok-felhasználónév nem megfelelő. A @ utáni azonosítót add meg, ne a megjelenített nevet."};
  if (name === "SignatureRateLimitError" || detail.reason==="Rate Limited" || detail.response?.status===429 || detail.response?.statusCode===429 || /(?:status|code|http)\D{0,10}429/i.test(message)) return {code:"TIKTOK_RATE_LIMIT",message:"A kommentkapcsolat szolgáltatója elérte a kapcsolódási korlátot. Várj néhány percet; új videógenerálás nem indult."};
  if (["SignAPIError","PremiumFeatureError","SignatureMissingTokensError","AuthenticatedWebSocketConnectionError"].includes(name) || ["Connect Error","Empty Payload","Sign Error","Empty Cookies","Premium Feature","Authenticated WS"].includes(detail.reason||"") || /Euler Stream.*lack of permission|permission from the signature provider/.test(message)) return {code:"TIKTOK_SIGN_SERVICE",message:"A TikTok-kapcsolat aláíró szolgáltatója nem engedte a csatlakozást. A szerver Euler Stream hozzáférését vagy keretét kell ellenőrizni."};
  if (name === "ConnectTimeoutError" || /timeout|timed out/i.test(message)) return {code:"TIKTOK_TIMEOUT",message:"A TikTok nem válaszolt időben. Ellenőrizd, hogy fut-e az adás, majd csatlakozz újra."};
  }
  return {code:"TIKTOK_CONNECT_FAILED",message:"Nem sikerült kiolvasni a TikTok-adást. Ellenőrizd a @felhasználónevet és azt, hogy már fut-e a LIVE. Szolgáltatói korlátozás is okozhatja."};
}
