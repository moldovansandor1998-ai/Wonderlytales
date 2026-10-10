export const MIN_FILM_DURATION_SEC = 40 * 60;
export const DEFAULT_FILM_DURATION_SEC = 60 * 60;

export function filmTargetDuration(value: unknown): number {
  if (value === null || value === undefined || value === "") return DEFAULT_FILM_DURATION_SEC;
  const seconds = Number(value);
  if (!Number.isSafeInteger(seconds) || seconds < MIN_FILM_DURATION_SEC) {
    throw new Error("A rajzfilm célhossza legalább 40 perc (2400 másodperc) legyen.");
  }
  return seconds;
}
