import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { parsePage, type PageSearchParams } from "@/lib/pagination";
import { PaginationControls } from "@/components/admin/pagination-controls";

export const metadata: Metadata = { title: "Audit Log" };

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

type AuditLogSearchParams = PageSearchParams & { action?: string; from?: string; to?: string };

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<AuditLogSearchParams>;
}) {
  await requireAdminSession();
  const resolvedSearchParams = await searchParams;
  const { action, from, to } = resolvedSearchParams;
  const { page, skip, take } = parsePage(resolvedSearchParams);

  const createdAt: { gte?: Date; lt?: Date } = {};
  if (from) createdAt.gte = new Date(from);
  if (to) createdAt.lt = new Date(new Date(to).getTime() + 24 * 60 * 60 * 1000);

  const where = {
    ...(action ? { action } : {}),
    ...(from || to ? { createdAt } : {}),
  };

  const [entries, totalCount, actionRows] = await Promise.all([
    prisma.adminAuditLog.findMany({ where, orderBy: { createdAt: "desc" }, skip, take }),
    prisma.adminAuditLog.count({ where }),
    prisma.adminAuditLog.findMany({ distinct: ["action"], select: { action: true }, orderBy: { action: "asc" } }),
  ]);
  const actionOptions = actionRows.map((row) => row.action);

  return (
    <div>
      <h2 className="text-lg font-medium">Audit Log</h2>
      <p className="mt-2 text-neutral-500">Destructive and financial admin actions — deletes, voids, payments, payroll finalization, manual journal entries, settings changes.</p>

      <form method="GET" className="mt-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs text-neutral-500">Action</label>
          <select
            name="action"
            defaultValue={action ?? ""}
            className="w-full rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground"
          >
            <option value="">All actions</option>
            {actionOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-neutral-500">From</label>
          <input
            type="date"
            name="from"
            defaultValue={from ?? ""}
            className="w-full rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground"
          />
        </div>
        <div>
          <label className="block text-xs text-neutral-500">To</label>
          <input
            type="date"
            name="to"
            defaultValue={to ?? ""}
            className="w-full rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground"
          />
        </div>
        <button type="submit" className="rounded-control border border-border-subtle px-4 py-2 text-sm font-medium hover:border-foreground">
          Filter
        </button>
        {(action || from || to) && (
          <a href="/admin/audit-log" className="text-sm text-neutral-500 underline hover:text-foreground">
            Clear
          </a>
        )}
      </form>

      <ul className="mt-6 space-y-3">
        {entries.map((entry) => (
          <li key={entry.id} className="rounded-card border border-border-subtle p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="font-medium">{entry.summary}</span>
              <span className="text-neutral-500">{formatDateTime(entry.createdAt)}</span>
            </div>
            <p className="mt-1 text-xs text-neutral-500">{entry.action}</p>
          </li>
        ))}
        {entries.length === 0 && (
          <p className="text-sm text-neutral-500">
            {action || from || to ? "No audit log entries match this filter." : "No audit log entries yet."}
          </p>
        )}
      </ul>
      <PaginationControls
        pathname="/admin/audit-log"
        searchParams={resolvedSearchParams}
        page={page}
        pageSize={take}
        totalCount={totalCount}
      />
    </div>
  );
}
