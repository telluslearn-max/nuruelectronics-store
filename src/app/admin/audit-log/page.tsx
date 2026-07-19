import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { parsePage, type PageSearchParams } from "@/lib/pagination";
import { PaginationControls } from "@/components/admin/pagination-controls";

export const metadata: Metadata = { title: "Audit Log" };

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export default async function AdminAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  await requireAdminSession();
  const resolvedSearchParams = await searchParams;
  const { page, skip, take } = parsePage(resolvedSearchParams);

  const [entries, totalCount] = await Promise.all([
    prisma.adminAuditLog.findMany({ orderBy: { createdAt: "desc" }, skip, take }),
    prisma.adminAuditLog.count(),
  ]);

  return (
    <div>
      <h2 className="text-lg font-medium">Audit Log</h2>
      <p className="mt-2 text-neutral-500">Destructive and financial admin actions — deletes, voids, payments, payroll finalization, manual journal entries, settings changes.</p>

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
        {entries.length === 0 && <p className="text-sm text-neutral-500">No audit log entries yet.</p>}
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
