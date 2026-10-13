const errors: Record<string, string> = {
  AI_NOT_CONFIGURED: "Az AI-válaszadó még nincs bekötve.",
  AI_VERIFICATION_REQUIRED: "A Vercel AI Gateway fiókellenőrzést kér a válaszadó aktiválásához.",
  AI_CREDITS_REQUIRED: "Az AI-válaszadó Vercel-kerete elfogyott. Ez külön keret a Runway-kreditektől.",
  AI_ACCESS_DENIED: "Az AI-szolgáltató nem fogadta el a stúdió hozzáférését.",
  AI_RATE_LIMITED: "Az AI-szolgáltató átmeneti híváskorlátot jelzett. A sor szünetel.",
  AI_INVALID_REPLY: "Az AI válasza nem felelt meg a két szereplő formátumának. A sor szünetel.",
  VIDEO_SERVICE_UNAVAILABLE: "Az AI-kapcsolat vagy a stúdió költségkerete nem elérhető. A sor szünetel.",
  UNAUTHORIZED: "A stúdió használatához jelentkezz be újra.",
  FORBIDDEN: "Ehhez stúdiójogosultság szükséges.",
};
export async function readAIResponse(response: Response): Promise<unknown> {
  const data = await response.json();
  if (!response.ok) throw new Error(errors[data?.error] || "Az AI-válasz nem készült el. A sor szünetel; nincs automatikus újrapróbálás.");
  return data;
}
