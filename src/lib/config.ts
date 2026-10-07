/** Production must never silently manufacture mock success. */
export function isProduction(): boolean {
  return !!process.env.VERCEL || process.env.NODE_ENV === "production";
}
export function requireConfiguration(provider: string, keys: string[]): void {
  const missing = keys.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`${provider}: hiányzó konfiguráció: ${missing.join(", ")}`);
}
export function rejectProductionMock(provider: string): void {
  if (isProduction()) throw new Error(`${provider}: éles környezetben mock nem használható. Állítsd be a valódi providert és a hozzáféréseit.`);
}
