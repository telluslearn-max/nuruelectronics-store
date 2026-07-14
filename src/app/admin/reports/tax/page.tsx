import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { getShopifyTaxCollected, isShopifyAdminConfigured } from "@/lib/shopify/admin-api";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Tax Record" };

function startOfYear(): Date {
  return new Date(new Date().getFullYear(), 0, 1);
}

function startOfNextYear(): Date {
  return new Date(new Date().getFullYear() + 1, 0, 1);
}

export default async function AdminTaxReportPage() {
  await requireAdminSession();

  const from = startOfYear();
  const to = startOfNextYear();

  let shopifyError: string | null = null;

  const [invoices, shopifyTax] = await Promise.all([
    prisma.invoice.findMany({
      where: { issuedAt: { gte: from, lt: to } },
      select: { number: true, taxTotal: true, issuedAt: true },
    }),
    isShopifyAdminConfigured
      ? getShopifyTaxCollected(from, to).catch((error: unknown) => {
          shopifyError = error instanceof Error ? error.message : "Unknown error";
          return [];
        })
      : Promise.resolve([]),
  ]);

  const ownTaxTotal = invoices.reduce((sum, invoice) => sum + Number(invoice.taxTotal), 0);
  const shopifyTaxTotal = shopifyTax.reduce((sum, order) => sum + Number(order.totalTax.amount), 0);

  return (
    <div>
      <h2 className="text-lg font-medium">Tax Record — {new Date().getFullYear()}</h2>
      <p className="mt-2 text-neutral-500">
        Tax collected on invoiced orders (this system) alongside Shopify&apos;s own tax-collected figures for the
        same year.
      </p>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div className="rounded-card border border-border-subtle p-4">
          <p className="text-sm text-neutral-500">Tax on invoices (this system)</p>
          <p className="mt-1 text-lg font-medium">{formatPrice(ownTaxTotal.toFixed(2), "KES")}</p>
          <p className="mt-1 text-sm text-neutral-500">{invoices.length} invoice(s)</p>
        </div>
        <div className="rounded-card border border-border-subtle p-4">
          <p className="text-sm text-neutral-500">Tax collected on Shopify orders</p>
          {isShopifyAdminConfigured ? (
            <>
              <p className="mt-1 text-lg font-medium">{formatPrice(shopifyTaxTotal.toFixed(2), "KES")}</p>
              <p className="mt-1 text-sm text-neutral-500">{shopifyTax.length} order(s)</p>
            </>
          ) : (
            <p className="mt-1 text-sm text-neutral-500">Set SHOPIFY_ADMIN_API_ACCESS_TOKEN to include this.</p>
          )}
          {shopifyError && (
            <p className="mt-1 text-sm text-red-600">Couldn&apos;t load Shopify tax data: {shopifyError}</p>
          )}
        </div>
      </div>

      <p className="mt-6 text-sm font-medium">
        Combined tax collected: {formatPrice((ownTaxTotal + shopifyTaxTotal).toFixed(2), "KES")}
      </p>
    </div>
  );
}
