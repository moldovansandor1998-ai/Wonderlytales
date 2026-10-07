import { createServerSupabase } from "./auth";
import { isProduction } from "./config";

export interface ProductionBudget {
  daily_limit_usd: number; timezone: string; budget_day: string;
  reserved_usd: number; remaining_usd: number;
  configured_services: Record<string, number>;
  provider_billing_cap_verified: boolean;
}
export async function getProductionBudget(): Promise<ProductionBudget | null> {
  if (!isProduction()) return null;
  const { data, error } = await createServerSupabase().rpc("production_budget_status");
  if (error || !data) throw new Error("A napi gyártási keret nem ellenőrizhető.");
  return data as ProductionBudget;
}
/** Atomic reservation before EVERY paid attempt. Never refund an ambiguous failure.
 * Unknown provider cost ceiling blocks submission; a daily ledger is not a billing cap.
 */
export async function reserveProductionBudget(service: string): Promise<void> {
  if (!isProduction()) return;
  const { error, data } = await createServerSupabase().rpc("reserve_production_budget", { p_service: service });
  if (error || !data?.reservation_id) {
    const reason = error?.message.includes("DAILY_BUDGET_EXCEEDED") ? "A napi 100 USD-os gyártási keret elfogyott."
      : error?.message.includes("BUDGET_SERVICE_CEILING_UNVERIFIED") ? "A szolgáltatás munkánkénti költségplafonja még nincs ellenőrizve."
      : "A gyártási keret nem ellenőrizhető.";
    throw new Error(reason);
  }
}
