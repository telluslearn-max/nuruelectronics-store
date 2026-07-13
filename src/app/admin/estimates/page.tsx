import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Estimates" };

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(date);
}

export default async function AdminEstimatesPage() {
  await requireAdminSession();

  const estimates = await prisma.estimate.findMany({
    orderBy: { createdAt: "desc" },
    include: { order: { include: { customer: true } } },
  });

  return (
    <div>
      <h2 className="text-lg font-medium">Estimates</h2>
      <ul className="mt-6 space-y-3">
        {estimates.map((estimate) => (
          <li key={estimate.id} className="rounded-card border border-border-subtle p-4 text-sm">
            <Link href={`/admin/orders/${estimate.orderId}`} className="flex flex-wrap items-center justify-between gap-2 hover:underline">
              <span>
                {estimate.number} · {estimate.order.customer.name ?? estimate.order.customer.email} ·{" "}
                {formatDate(estimate.createdAt)}
              </span>
              <span className="text-neutral-500">
                {estimate.status} · {formatPrice(estimate.total.toString(), estimate.order.currencyCode)}
              </span>
            </Link>
          </li>
        ))}
        {estimates.length === 0 && <p className="text-sm text-neutral-500">No estimates yet.</p>}
      </ul>
    </div>
  );
}
