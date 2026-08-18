import "server-only";
import type { CapitalCircleWalletStatus, ExpenseCategory, ExpensePaymentSource, PaymentMethod } from "@prisma/client";
import { redirectWithError } from "./admin-feedback";

export const PAYMENT_METHODS = ["cash", "mpesa"] as const satisfies readonly PaymentMethod[];
export const EXPENSE_CATEGORIES = ["cogs", "sga", "other"] as const satisfies readonly ExpenseCategory[];
export const EXPENSE_PAYMENT_SOURCES = ["cash", "mpesa", "petty_cash"] as const satisfies readonly ExpensePaymentSource[];
export const CAPITAL_CIRCLE_WALLET_STATUSES = ["pending", "active", "frozen"] as const satisfies readonly CapitalCircleWalletStatus[];

/**
 * Validates a FormData string field against an allowlist before it's treated as a Prisma
 * enum value. Without this, a malformed or tampered field (e.g. `method` on a payment form)
 * reaches the DB as an arbitrary string — or worse, silently matches an unintended branch in
 * code that switches on it, like `cashAccountForMethod`'s cash/mpesa fallback, which would post
 * a garbage value to the M-Pesa account instead of failing loudly.
 */
export function parseEnumField<T extends string>(
  formData: FormData,
  field: string,
  allowed: readonly T[],
  redirectPath: string,
): T {
  const value = String(formData.get(field) ?? "");
  if (!(allowed as readonly string[]).includes(value)) {
    redirectWithError(redirectPath, `Invalid ${field}: "${value}".`);
  }
  return value as T;
}
