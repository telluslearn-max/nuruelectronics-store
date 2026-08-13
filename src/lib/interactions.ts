import "server-only";
import type { InteractionSource } from "@prisma/client";
import { getCurrentDbCustomerId } from "./customer";
import { prisma } from "./prisma";
import { getSessionId } from "./session";

export type LogInteractionInput = {
  sessionId: string;
  customerId?: string | null;
  source: InteractionSource;
  productHandle?: string | null;
  inferredIntent?: string | null;
  inferredBudgetSignal?: string | null;
  inferredCategory?: string | null;
};

/**
 * Records one Interaction row — the AI-derived/inferred-signal side of the customer intelligence
 * layer, deliberately kept out of Customer/Order (see the schema comment on the Interaction model).
 * Best-effort: telemetry, not the operation it's attached to, so a DB hiccup here never breaks the
 * page render or concierge turn that triggered it.
 */
export async function logInteraction(input: LogInteractionInput): Promise<void> {
  try {
    await prisma.interaction.create({
      data: {
        sessionId: input.sessionId,
        customerId: input.customerId ?? null,
        source: input.source,
        productHandle: input.productHandle ?? null,
        inferredIntent: input.inferredIntent ?? null,
        inferredBudgetSignal: input.inferredBudgetSignal ?? null,
        inferredCategory: input.inferredCategory ?? null,
      },
    });
  } catch (error) {
    console.error("Failed to log interaction:", error);
  }
}

/** Server-side PRODUCT_VIEW logging for a product page render — see src/app/(storefront)/products/[handle]/page.tsx.
 * This is now the source of truth for "recently viewed" server-side signal; the existing client-side
 * localStorage list (src/components/use-recently-viewed.ts) stays as-is, an anonymous UX fallback only. */
export async function logProductView(productHandle: string): Promise<void> {
  const sessionId = await getSessionId();
  if (!sessionId) return;
  const customerId = await getCurrentDbCustomerId();
  await logInteraction({ sessionId, customerId, source: "PRODUCT_VIEW", productHandle });
}

/** The "delayed conversion" backfill: attaches every still-anonymous Interaction row under this
 * session to a now-known Customer. Called from src/lib/customer.ts (sign-in) and
 * src/lib/admin-actions.ts (importShopifyOrder, when the imported order's Shopify cart carried a
 * nuru_session_id attribute — see SESSION_CART_ATTRIBUTE_KEY in src/lib/session.ts). */
export async function backfillInteractionsForCustomer(sessionId: string, customerId: string): Promise<void> {
  try {
    await prisma.interaction.updateMany({
      where: { sessionId, customerId: null },
      data: { customerId },
    });
  } catch (error) {
    console.error("Failed to backfill interactions for customer:", error);
  }
}

/** Recent order-history + Interaction signal for a signed-in customer, for the homepage
 * recommendation prompt (src/lib/personalization/recommendations.ts) — real purchases, not just
 * whatever's in this browser's localStorage. */
export async function getCustomerRecommendationSignals(customerId: string): Promise<string[]> {
  const [orders, interactions] = await Promise.all([
    prisma.order.findMany({
      where: { customerId },
      include: { items: true },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    prisma.interaction.findMany({
      where: { customerId },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
  ]);
  const purchasedTitles = orders.flatMap((order) => order.items.map((item) => item.title));
  const inferredSignals = interactions
    .map((interaction) => interaction.inferredCategory ?? interaction.productHandle ?? interaction.inferredIntent)
    .filter((value): value is string => Boolean(value));
  return Array.from(new Set([...purchasedTitles, ...inferredSignals]));
}

/** Recently-viewed product handles from server-side Interaction rows for an anonymous session — the
 * server-side counterpart to the client-supplied localStorage list. */
export async function getSessionRecommendationHandles(sessionId: string): Promise<string[]> {
  const interactions = await prisma.interaction.findMany({
    where: { sessionId, productHandle: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 15,
    select: { productHandle: true },
  });
  return Array.from(
    new Set(interactions.map((interaction) => interaction.productHandle).filter((handle): handle is string => Boolean(handle))),
  );
}
