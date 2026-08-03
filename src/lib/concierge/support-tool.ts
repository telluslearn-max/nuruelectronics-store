import "server-only";
import type { ReturnCaseReason, ReturnCaseStatus } from "@prisma/client";
import { ACCOUNTS, postJournalEntry } from "@/lib/ledger";
import { logAdminAction } from "@/lib/audit-log";
import { prisma } from "@/lib/prisma";
import { getShopifyOrders, isShopifyAdminConfigured, type ShopifyAdminOrder } from "@/lib/shopify/admin-api";
import { decideReturnCase } from "@/lib/support/return-policy";

function normalizeOrderNumber(input: string): string {
  const trimmed = input.trim();
  return trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
}

type OrderLookupResult = ShopifyAdminOrder | { error: string };

/** Looks up a Shopify order by its customer-facing number and verifies it belongs to the given email — the only identity check available without a signed-in session. */
async function findOrderByNumber(orderNumber: string, email: string): Promise<OrderLookupResult> {
  if (!isShopifyAdminConfigured) {
    return { error: "Order lookup isn't available right now — use open_whatsapp_handoff so a staff member can check it." };
  }
  const name = normalizeOrderNumber(orderNumber);
  let orders: ShopifyAdminOrder[];
  try {
    ({ orders } = await getShopifyOrders({ query: `name:${name}`, first: 1 }));
  } catch (error) {
    console.error("Shopify order lookup failed", error);
    return { error: "Order lookup isn't working right now — use open_whatsapp_handoff so a staff member can check it." };
  }
  const order = orders[0];
  if (!order) return { error: `No order found matching ${name}.` };

  const orderEmail = order.customer?.email?.trim().toLowerCase();
  if (!orderEmail || orderEmail !== email.trim().toLowerCase()) {
    return { error: "That order number and email don't match our records — double-check both, or use open_whatsapp_handoff." };
  }
  return order;
}

export type OrderStatusResult =
  | {
      orderNumber: string;
      processedAt: string;
      financialStatus: string;
      fulfillmentStatus: string;
      total: { amount: string; currencyCode: string };
      items: { title: string; quantity: number }[];
    }
  | { error: string };

/** Backs the concierge's `check_order_status` tool. */
export async function checkOrderStatus(orderNumber: string, email: string): Promise<OrderStatusResult> {
  const order = await findOrderByNumber(orderNumber, email);
  if ("error" in order) return order;

  return {
    orderNumber: order.name,
    processedAt: order.processedAt,
    financialStatus: order.displayFinancialStatus,
    fulfillmentStatus: order.displayFulfillmentStatus,
    total: order.currentTotalPriceSet.shopMoney,
    items: order.lineItems.edges.map((edge) => ({ title: edge.node.title, quantity: edge.node.quantity })),
  };
}

export type FileReturnResult =
  | {
      caseId: string;
      status: ReturnCaseStatus;
      reasoning: string;
      refundAmount?: string;
      refundChannel?: string;
    }
  | { error: string };

/**
 * Backs the concierge's `request_return_or_refund` tool — the one place the AI makes a real
 * operational decision instead of just informing/selling. The decision itself is a pure policy
 * lookup (src/lib/support/return-policy.ts); this function's job is fetching the facts that policy
 * needs (order age, identity match), enforcing one open case per order, and — when the decision
 * commits to a refund — posting the accrual so the P&L reflects it immediately, atomically with the
 * case row and its audit log entry.
 */
export async function fileReturnOrRefund(args: {
  orderNumber: string;
  email: string;
  reason: ReturnCaseReason;
  description: string;
  isBnpl?: boolean;
  orderItemTitle?: string;
}): Promise<FileReturnResult> {
  const order = await findOrderByNumber(args.orderNumber, args.email);
  if ("error" in order) return order;

  const existing = await prisma.returnCase.findFirst({
    where: { shopifyOrderId: order.id, status: { not: "denied" } },
    orderBy: { createdAt: "desc" },
  });
  if (existing) {
    return {
      caseId: existing.id,
      status: existing.status,
      reasoning: `This order already has a case on file: ${existing.decisionBasis}`,
      refundAmount: existing.refundAmount?.toString(),
      refundChannel: existing.refundChannel ?? undefined,
    };
  }

  const hoursSinceOrder = (Date.now() - new Date(order.processedAt).getTime()) / (60 * 60 * 1000);
  const decision = decideReturnCase({ reason: args.reason, hoursSinceOrder, isBnpl: args.isBnpl ?? false });
  const shouldAccrue = decision.status === "approved" && decision.resolution === "refund";

  const matchedItem = args.orderItemTitle
    ? order.lineItems.edges.find((edge) => edge.node.title.toLowerCase().includes(args.orderItemTitle!.toLowerCase()))?.node
    : undefined;
  const refundAmount = matchedItem
    ? (Number(matchedItem.originalUnitPriceSet.shopMoney.amount) * matchedItem.quantity).toFixed(2)
    : order.currentTotalPriceSet.shopMoney.amount;

  const caseRecord = await prisma.$transaction(async (tx) => {
    let journalEntryId: string | undefined;
    if (shouldAccrue) {
      const entry = await postJournalEntry(tx, {
        date: new Date(),
        description: `Refund authorized by AI concierge — order ${order.name} (${args.reason})`,
        sourceType: "returnCase",
        sourceId: order.id,
        lines: [
          { accountCode: ACCOUNTS.SALES_RETURNS, debit: Number(refundAmount) },
          { accountCode: ACCOUNTS.REFUNDS_PAYABLE, credit: Number(refundAmount) },
        ],
      });
      journalEntryId = entry.id;
    }

    const created = await tx.returnCase.create({
      data: {
        shopifyOrderId: order.id,
        shopifyOrderName: order.name,
        customerEmail: args.email.trim().toLowerCase(),
        reason: args.reason,
        description: args.description,
        status: decision.status,
        decisionBasis: decision.reasoning,
        refundAmount: shouldAccrue ? refundAmount : undefined,
        refundChannel: shouldAccrue ? "shopify_checkout" : undefined,
        journalEntryId,
      },
    });

    await logAdminAction(
      {
        action: "concierge.return_case_decision",
        entityType: "returnCase",
        entityId: created.id,
        summary: `AI concierge ${created.status} a "${args.reason}" case for order ${order.name}`,
        metadata: { reason: args.reason, hoursSinceOrder, decision },
      },
      tx,
    );

    return created;
  });

  return {
    caseId: caseRecord.id,
    status: caseRecord.status,
    reasoning: caseRecord.decisionBasis,
    refundAmount: caseRecord.refundAmount?.toString(),
    refundChannel: caseRecord.refundChannel ?? undefined,
  };
}
