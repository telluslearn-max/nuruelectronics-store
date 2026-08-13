import "server-only";
import { logInteraction } from "@/lib/interactions";
import type { ConciergeContext } from "./types";

export type LogCustomerSignalArgs = {
  intent?: string;
  budgetSignal?: string;
  categoryInterest?: string;
};

/** Backs the concierge's `log_customer_signal` tool — persists a Gemini-inferred customer-intelligence
 * signal as an Interaction row (source=CONCIERGE_CHAT), kept strictly separate from the Customer/Order
 * facts tables (see the schema comment on the Interaction model). */
export async function logCustomerSignal(ctx: ConciergeContext, args: LogCustomerSignalArgs): Promise<{ ok: true }> {
  await logInteraction({
    sessionId: ctx.sessionId,
    customerId: ctx.customerId,
    source: "CONCIERGE_CHAT",
    inferredIntent: args.intent ?? null,
    inferredBudgetSignal: args.budgetSignal ?? null,
    inferredCategory: args.categoryInterest ?? null,
  });
  return { ok: true };
}
