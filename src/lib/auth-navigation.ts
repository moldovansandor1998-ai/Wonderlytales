/** Only same-origin paths can be used after authentication. */
export function safeAuthNext(next: string | null): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || /[\\\x00-\x20]/.test(next)) return "/";
  return next;
}

export function authErrorMessage(error: unknown): string {
  const code = typeof error === "object" && error !== null && "code" in error ? String(error.code) : "";
  if (code === "invalid_credentials") return "A Studio elutasította az e-mailes és jelszavas belépést. Használd az e-mailes belépőlinket vagy a jelszó-helyreállítást.";
  if (code === "over_email_send_rate_limit" || code === "over_request_rate_limit") return "Túl sok kérés érkezett. Várj egy kicsit, mielőtt új linket kérsz.";
  return error instanceof Error ? error.message : "A művelet nem sikerült. Próbáld újra később.";
}
