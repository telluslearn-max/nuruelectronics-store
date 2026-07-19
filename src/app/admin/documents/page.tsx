import type { Metadata } from "next";
import Link from "next/link";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { StatusPill } from "@/components/admin/status-pill";
import { parsePage, type PageSearchParams } from "@/lib/pagination";
import { PaginationControls } from "@/components/admin/pagination-controls";

export const metadata: Metadata = { title: "Documents" };

type DocType = "invoice" | "estimate" | "delivery-note";

const TABS: { type: DocType; label: string }[] = [
  { type: "invoice", label: "Invoice" },
  { type: "estimate", label: "Estimate" },
  { type: "delivery-note", label: "Delivery note" },
];

const STATUS_OPTIONS_BY_TYPE: Record<DocType, string[]> = {
  invoice: ["draft", "sent", "partially_paid", "paid", "void"],
  estimate: ["draft", "sent", "accepted", "declined", "expired"],
  "delivery-note": ["pending", "delivered"],
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(date);
}

function isDocType(value: string | undefined): value is DocType {
  return value === "invoice" || value === "estimate" || value === "delivery-note";
}

type Row = {
  orderId: string;
  number: string;
  status: string;
  date: Date;
  primaryLabel: string;
  secondaryLabel: string | null;
};

async function loadRows(
  type: DocType,
  { status, skip, take }: { status?: string; skip: number; take: number },
): Promise<{ rows: Row[]; totalCount: number }> {
  if (type === "invoice") {
    const where = status ? { status: status as never } : {};
    const [invoices, totalCount] = await Promise.all([
      prisma.invoice.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { order: { include: { customer: true } } },
        skip,
        take,
      }),
      prisma.invoice.count({ where }),
    ]);
    return {
      rows: invoices.map((invoice) => ({
        orderId: invoice.orderId,
        number: invoice.number,
        status: invoice.status,
        date: invoice.createdAt,
        primaryLabel: invoice.order.customer.name ?? invoice.order.customer.email,
        secondaryLabel: formatPrice(invoice.total.toString(), invoice.order.currencyCode),
      })),
      totalCount,
    };
  }
  if (type === "estimate") {
    const where = status ? { status: status as never } : {};
    const [estimates, totalCount] = await Promise.all([
      prisma.estimate.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: { order: { include: { customer: true } } },
        skip,
        take,
      }),
      prisma.estimate.count({ where }),
    ]);
    return {
      rows: estimates.map((estimate) => ({
        orderId: estimate.orderId,
        number: estimate.number,
        status: estimate.status,
        date: estimate.createdAt,
        primaryLabel: estimate.order.customer.name ?? estimate.order.customer.email,
        secondaryLabel: formatPrice(estimate.total.toString(), estimate.order.currencyCode),
      })),
      totalCount,
    };
  }
  const where = status ? { status: status as never } : {};
  const [notes, totalCount] = await Promise.all([
    prisma.deliveryNote.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { order: { include: { customer: true } } },
      skip,
      take,
    }),
    prisma.deliveryNote.count({ where }),
  ]);
  return {
    rows: notes.map((note) => ({
      orderId: note.orderId,
      number: note.number,
      status: note.status,
      date: note.createdAt,
      primaryLabel: note.recipientName,
      secondaryLabel: note.order.customer.name ?? note.order.customer.email,
    })),
    totalCount,
  };
}

export default async function AdminDocumentsPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams & { type?: string; status?: string }>;
}) {
  await requireAdminSession();
  const resolvedSearchParams = await searchParams;
  const { type: rawType, status: rawStatus } = resolvedSearchParams;
  const type: DocType = isDocType(rawType) ? rawType : "invoice";
  const statusOptions = STATUS_OPTIONS_BY_TYPE[type];
  const status = rawStatus && statusOptions.includes(rawStatus) ? rawStatus : undefined;
  const { page, skip, take } = parsePage(resolvedSearchParams);
  const { rows, totalCount } = await loadRows(type, { status, skip, take });
  const activeTab = TABS.find((tab) => tab.type === type)!;
  const emptyLabel = activeTab.label.toLowerCase();

  return (
    <div className="relative pb-24">
      <h2 className="text-lg font-medium">Documents</h2>

      <div className="mt-4 flex gap-6 border-b border-border-subtle text-sm">
        {TABS.map((tab) => (
          <Link
            key={tab.type}
            href={`/admin/documents?type=${tab.type}`}
            className={`-mb-px border-b-2 pb-3 font-medium transition ${
              tab.type === type
                ? "border-foreground text-foreground"
                : "border-transparent text-neutral-500 hover:text-foreground"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </div>

      <form method="GET" className="mt-4 flex items-end gap-3">
        <input type="hidden" name="type" value={type} />
        <div>
          <label className="block text-xs text-neutral-500">Status</label>
          <select
            name="status"
            defaultValue={status ?? ""}
            className="w-full rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground"
          >
            <option value="">All</option>
            {statusOptions.map((option) => (
              <option key={option} value={option}>
                {option.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className="rounded-control border border-border-subtle px-4 py-2 text-sm font-medium hover:border-foreground">
          Filter
        </button>
      </form>

      {rows.length === 0 && !status ? (
        <Link
          href="/admin/orders/new"
          className="mt-6 flex flex-col items-center justify-center gap-2 rounded-card bg-blue-50 py-16 text-blue-700 transition hover:bg-blue-100"
        >
          <span className="text-2xl leading-none">+</span>
          <span className="font-medium">New {emptyLabel}</span>
        </Link>
      ) : rows.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">No {emptyLabel}s match this filter.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {rows.map((row) => (
            <li key={row.orderId + row.number} className="rounded-card border border-border-subtle p-4 text-sm">
              <Link
                href={`/admin/orders/${row.orderId}`}
                className="flex flex-wrap items-center justify-between gap-3 hover:opacity-80"
              >
                <span>
                  <span className="block font-medium">{row.number}</span>
                  <span className="mt-1 flex items-center gap-2">
                    <StatusPill status={row.status} />
                    <span className="text-neutral-500">{formatDate(row.date)}</span>
                  </span>
                </span>
                <span className="text-right">
                  <span className="block font-medium">{row.primaryLabel}</span>
                  {row.secondaryLabel && <span className="mt-1 block text-lg font-semibold">{row.secondaryLabel}</span>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <PaginationControls
        pathname="/admin/documents"
        searchParams={resolvedSearchParams}
        page={page}
        pageSize={take}
        totalCount={totalCount}
      />

      <Link
        href="/admin/orders/new"
        aria-label={`New ${emptyLabel}`}
        className="fixed bottom-8 right-8 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-2xl font-light text-white shadow-lg transition hover:bg-blue-700"
      >
        +
      </Link>
    </div>
  );
}
