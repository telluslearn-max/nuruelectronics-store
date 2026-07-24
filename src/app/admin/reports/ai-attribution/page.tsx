import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/admin-auth";
import { isShopifyAdminConfigured } from "@/lib/shopify/admin-api";
import { formatPrice } from "@/lib/format";
import { getConciergeAttributionReport } from "@/lib/reports/concierge-attribution";

export const metadata: Metadata = { title: "AI Concierge Attribution" };

function formatDate(dateString: string | Date) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(new Date(dateString));
}

function formatPercent(share: number) {
  return `${Math.round(share * 100)}%`;
}

export default async function AdminAiAttributionPage() {
  await requireAdminSession();

  const { rows, summary, shopifyError } = await getConciergeAttributionReport();
  const currency = rows[0]?.currency ?? "KES";

  return (
    <div>
      <h2 className="text-lg font-medium">AI Concierge Attribution</h2>
      <p className="mt-2 text-neutral-500">
        Shopify orders where the AI concierge added items to the cart or surfaced checkout, vs. everything else.
      </p>
      {!isShopifyAdminConfigured && (
        <p className="mt-2 text-sm text-neutral-500">
          Set SHOPIFY_ADMIN_API_ACCESS_TOKEN to include live Shopify orders here.
        </p>
      )}
      {shopifyError && <p className="mt-2 text-sm text-red-600">Couldn&apos;t load Shopify orders: {shopifyError}</p>}

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-card border border-border-subtle p-4">
          <p className="text-xs text-neutral-500">AI-assisted orders</p>
          <p className="mt-1 text-lg font-semibold">
            {summary.assistedOrders} <span className="text-sm font-normal text-neutral-500">/ {summary.totalOrders}</span>
          </p>
          <p className="text-xs text-neutral-500">{formatPercent(summary.assistedOrderShare)} of orders</p>
        </div>
        <div className="rounded-card border border-border-subtle p-4">
          <p className="text-xs text-neutral-500">AI-assisted GMV</p>
          <p className="mt-1 text-lg font-semibold">{formatPrice(summary.assistedGmv.toFixed(2), currency)}</p>
          <p className="text-xs text-neutral-500">{formatPercent(summary.assistedGmvShare)} of total GMV</p>
        </div>
        <div className="rounded-card border border-border-subtle p-4">
          <p className="text-xs text-neutral-500">Total orders</p>
          <p className="mt-1 text-lg font-semibold">{summary.totalOrders}</p>
        </div>
        <div className="rounded-card border border-border-subtle p-4">
          <p className="text-xs text-neutral-500">Total GMV</p>
          <p className="mt-1 text-lg font-semibold">{formatPrice(summary.totalGmv.toFixed(2), currency)}</p>
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h3 className="text-sm font-medium">Orders</h3>
        <a
          href="/api/reports/ai-attribution/csv"
          className="rounded-control border border-border-subtle px-4 py-2 text-sm font-medium hover:border-foreground"
        >
          Export CSV
        </a>
      </div>

      <ul className="mt-4 space-y-3 sm:hidden">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center justify-between gap-3 rounded-card border border-border-subtle p-4 text-sm">
            <span>
              <span className="block font-medium">{row.customer}</span>
              <span className="mt-1 block text-neutral-500">
                {row.source} · {formatDate(row.date)}
              </span>
              {row.conciergeAssisted && (
                <span className="mt-1 inline-block rounded-full border border-border-subtle px-2 py-0.5 text-xs text-neutral-600">
                  AI concierge
                </span>
              )}
            </span>
            <span className="text-lg font-semibold">{formatPrice(row.total.toFixed(2), row.currency)}</span>
          </li>
        ))}
        {rows.length === 0 && <p className="text-sm text-neutral-500">No orders recorded yet.</p>}
      </ul>

      <div className="mt-4 hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-border-subtle text-left text-xs text-neutral-500">
              <th className="py-2">Date</th>
              <th className="py-2">Customer</th>
              <th className="py-2">Order</th>
              <th className="py-2">AI concierge</th>
              <th className="py-2 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border-subtle/60">
                <td className="py-2">{formatDate(row.date)}</td>
                <td className="py-2">{row.customer}</td>
                <td className="py-2 text-neutral-500">{row.source}</td>
                <td className="py-2">{row.conciergeAssisted ? "Yes" : "—"}</td>
                <td className="py-2 text-right">{formatPrice(row.total.toFixed(2), row.currency)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-neutral-500">
                  No orders recorded yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
