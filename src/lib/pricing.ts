/** Pricing config – nincs hardcoded ár a logikában; env-ben felülírható */
export interface PriceEntry { unit: string; unitPriceUsd: number; }
export interface PricingConfig {
  gpuPerSec: number; ttsPerChar: number; translationPerChar: number;
  genVideoPerSec: number; storagePerGbMonth: number; llmPerKToken: number;
}
export function getPricing(): PricingConfig {
  const n = (k: string, d: number) => Number(process.env[k] ?? d);
  return {
    gpuPerSec: n("PRICE_GPU_PER_SEC", 0.012),
    ttsPerChar: n("PRICE_TTS_PER_CHAR", 0.00008),
    translationPerChar: n("PRICE_TRANSLATION_PER_CHAR", 0.00002),
    genVideoPerSec: n("PRICE_GENVIDEO_PER_SEC", 0.4),
    storagePerGbMonth: n("PRICE_STORAGE_PER_GB_MONTH", 0.015),
    llmPerKToken: n("PRICE_LLM_PER_KTOKEN", 0.002),
  };
}
