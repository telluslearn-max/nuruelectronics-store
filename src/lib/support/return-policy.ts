import type { ReturnCaseReason } from "@prisma/client";

// Mirrors the published windows in /legal/refund-policy — change one, change both.
export const RETURN_WINDOW_DAYS = 7; // §1 Returns (change of mind)
export const DAMAGE_REPORT_WINDOW_HOURS = 48; // §4 Damaged, wrong, or missing items
export const WARRANTY_WINDOW_DAYS = 365; // §2 Warranty coverage (ex-UK 1-year; also a safe ceiling for genuine-product claims)

export type ReturnPolicyDecision = {
  status: "approved" | "denied" | "escalated";
  /** The remedy this decision commits to, if approved — drives whether a ledger accrual gets posted. */
  resolution: "refund" | "repair_or_replacement" | null;
  reasoning: string;
};

/**
 * Pure rule-based decision — no I/O — so it's cheap to reason about and to unit test. The concierge
 * calls this with facts it already looked up (order age, BNPL flag); it never has discretion beyond
 * what's encoded here, which is what makes the resulting case defensible as an autonomous decision.
 */
export function decideReturnCase(input: {
  reason: ReturnCaseReason;
  hoursSinceOrder: number;
  isBnpl: boolean;
}): ReturnPolicyDecision {
  const { reason, hoursSinceOrder, isBnpl } = input;
  const days = hoursSinceOrder / 24;
  const bnplNote = isBnpl
    ? " This order was financed via BNPL — the product return is covered here, but any deposit, installment, or credit-agreement adjustment is between the customer and the BNPL partner."
    : "";

  switch (reason) {
    case "change_of_mind": {
      if (days <= RETURN_WINDOW_DAYS) {
        return {
          status: "approved",
          resolution: isBnpl ? "repair_or_replacement" : "refund",
          reasoning: `Within the ${RETURN_WINDOW_DAYS}-day change-of-mind window (${days.toFixed(1)} days since order).${bnplNote}`,
        };
      }
      return {
        status: "denied",
        resolution: null,
        reasoning: `Outside the ${RETURN_WINDOW_DAYS}-day change-of-mind window (${days.toFixed(1)} days since order).`,
      };
    }

    case "damaged":
    case "wrong_item":
    case "missing_item": {
      if (hoursSinceOrder <= DAMAGE_REPORT_WINDOW_HOURS) {
        return {
          status: "approved",
          resolution: "refund",
          reasoning: `Reported within the ${DAMAGE_REPORT_WINDOW_HOURS}-hour damaged/wrong/missing-item window (${hoursSinceOrder.toFixed(1)} hours since order). Authorized pending photo verification.${bnplNote}`,
        };
      }
      return {
        status: "escalated",
        resolution: null,
        reasoning: `Reported ${hoursSinceOrder.toFixed(1)} hours after the order, past the ${DAMAGE_REPORT_WINDOW_HOURS}-hour self-service window — needs a human look before it's denied outright, since it could still be a warranty defect.`,
      };
    }

    case "warranty": {
      if (days <= WARRANTY_WINDOW_DAYS) {
        return {
          status: "approved",
          resolution: "repair_or_replacement",
          reasoning: `Within the ${WARRANTY_WINDOW_DAYS}-day warranty window (${days.toFixed(1)} days since order). Authorized for inspection/repair/replacement.${bnplNote}`,
        };
      }
      return {
        status: "escalated",
        resolution: null,
        reasoning: `${days.toFixed(1)} days since order, past the standard ${WARRANTY_WINDOW_DAYS}-day window — needs a human check against the specific manufacturer's warranty term.`,
      };
    }
  }
}
