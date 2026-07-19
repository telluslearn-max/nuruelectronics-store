import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { createManualJournalEntry } from "@/lib/ledger-actions";
import { parsePage, type PageSearchParams } from "@/lib/pagination";
import { PaginationControls } from "@/components/admin/pagination-controls";
import { FeedbackBanner } from "@/components/admin/feedback-banner";

export const metadata: Metadata = { title: "Journal" };

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(date);
}

const inputClass =
  "w-full rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground";
const primaryButtonClass =
  "rounded-control bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90";

const LINE_ROWS = 6;

export default async function AdminJournalPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams & { success?: string; error?: string }>;
}) {
  await requireAdminSession();
  const resolvedSearchParams = await searchParams;
  const { success, error } = resolvedSearchParams;
  const { page, skip, take } = parsePage(resolvedSearchParams, 50);

  const [entries, totalCount, accounts] = await Promise.all([
    prisma.journalEntry.findMany({
      orderBy: { date: "desc" },
      skip,
      take,
      include: { lines: { include: { account: true } } },
    }),
    prisma.journalEntry.count(),
    prisma.account.findMany({ orderBy: { code: "asc" } }),
  ]);

  return (
    <div>
      <h2 className="text-lg font-medium">Journal</h2>
      <FeedbackBanner success={success} error={error} />
      <p className="mt-2 text-neutral-500">
        Most entries post automatically from invoices, receipts, and other business events. Use the form below only
        for adjustments.
      </p>

      <ul className="mt-6 space-y-4">
        {entries.map((entry) => (
          <li key={entry.id} className="rounded-card border border-border-subtle p-4 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-medium">{entry.description}</span>
              <span className="text-neutral-500">{formatDate(entry.date)}</span>
            </div>
            <ul className="mt-2 space-y-1">
              {entry.lines.map((line) => (
                <li key={line.id} className="flex flex-wrap justify-between gap-2 text-neutral-600">
                  <span>
                    {line.account.code} {line.account.name}
                  </span>
                  <span>
                    {Number(line.debit) > 0 && `Dr ${formatPrice(line.debit.toString(), "KES")}`}
                    {Number(line.credit) > 0 && `Cr ${formatPrice(line.credit.toString(), "KES")}`}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
        {entries.length === 0 && <p className="text-sm text-neutral-500">No journal entries yet.</p>}
      </ul>
      <PaginationControls
        pathname="/admin/journal"
        searchParams={resolvedSearchParams}
        page={page}
        pageSize={take}
        totalCount={totalCount}
      />

      <details className="mt-8">
        <summary className="cursor-pointer text-sm font-medium">New manual entry</summary>
        <form action={createManualJournalEntry} className="mt-4 max-w-3xl space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs text-neutral-500">Date</label>
              <input type="date" name="date" required className={`mt-1 w-full ${inputClass}`} />
            </div>
            <div>
              <label className="block text-xs text-neutral-500">Description</label>
              <input type="text" name="description" required className={`mt-1 w-full ${inputClass}`} />
            </div>
          </div>

          <div>
            <div className="hidden grid-cols-12 gap-2 text-xs text-neutral-500 sm:grid">
              <span className="col-span-6">Account</span>
              <span className="col-span-3">Debit</span>
              <span className="col-span-3">Credit</span>
            </div>
            <div className="mt-2 space-y-3 sm:space-y-2">
              {Array.from({ length: LINE_ROWS }).map((_, i) => (
                <div key={i} className="grid grid-cols-1 gap-2 border-b border-border-subtle/60 pb-3 sm:grid-cols-12 sm:border-0 sm:pb-0">
                  <select name={`line_account_${i}`} className={`sm:col-span-6 ${inputClass}`}>
                    <option value="">Account</option>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.code}>
                        {account.code} {account.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    name={`line_debit_${i}`}
                    placeholder="Debit"
                    className={`sm:col-span-3 ${inputClass}`}
                  />
                  <input
                    type="number"
                    step="0.01"
                    name={`line_credit_${i}`}
                    placeholder="Credit"
                    className={`sm:col-span-3 ${inputClass}`}
                  />
                </div>
              ))}
            </div>
          </div>

          <button type="submit" className={primaryButtonClass}>
            Post entry
          </button>
        </form>
      </details>
    </div>
  );
}
