import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { formatPrice } from "@/lib/format";
import { approveEscalatedCase, denyCase, markCaseRefunded } from "@/lib/support-actions";
import { parsePage, type PageSearchParams } from "@/lib/pagination";
import { PaginationControls } from "@/components/admin/pagination-controls";
import { FeedbackBanner } from "@/components/admin/feedback-banner";
import { StatusPill } from "@/components/admin/status-pill";
import { ConfirmSubmitButton } from "@/components/admin/confirm-submit-button";

export const metadata: Metadata = { title: "Support (AI Agent Decisions)" };

const inputClass =
  "w-full rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground";
const primaryButtonClass =
  "rounded-control bg-foreground px-3 py-1.5 text-xs font-medium text-background transition hover:opacity-90 disabled:opacity-50";
const dangerButtonClass =
  "rounded-control border border-border-subtle px-3 py-1.5 text-xs font-medium text-red-700 transition hover:border-red-300 disabled:opacity-50";

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function reasonLabel(reason: string) {
  return reason.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export default async function AdminSupportPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams & { success?: string; error?: string }>;
}) {
  await requireAdminSession();
  const resolvedSearchParams = await searchParams;
  const { success, error } = resolvedSearchParams;
  const { page, skip, take } = parsePage(resolvedSearchParams);

  const [cases, totalCount, agentDecidedCount] = await Promise.all([
    prisma.returnCase.findMany({ orderBy: { createdAt: "desc" }, skip, take }),
    prisma.returnCase.count(),
    prisma.returnCase.count({ where: { decidedBy: "agent" } }),
  ]);

  return (
    <div>
      <h2 className="text-lg font-medium">Support</h2>
      <FeedbackBanner success={success} error={error} />
      <p className="mt-2 text-neutral-500">
        Every return, refund, and warranty case decided by the AI concierge under store policy (see{" "}
        <code className="text-xs">src/lib/support/return-policy.ts</code>), or escalated here for a human call.{" "}
        {agentDecidedCount} of {totalCount} cases on file were decided by the agent, not staff.
      </p>

      <ul className="mt-6 space-y-4">
        {cases.map((returnCase) => (
          <li key={returnCase.id} className="rounded-card border border-border-subtle p-4 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">
                Order {returnCase.shopifyOrderName} · {reasonLabel(returnCase.reason)}
              </span>
              <span className="flex items-center gap-2">
                <span
                  className={`rounded-control px-2 py-0.5 text-xs font-medium ${
                    returnCase.decidedBy === "agent" ? "bg-violet-100 text-violet-700" : "bg-neutral-100 text-neutral-600"
                  }`}
                >
                  {returnCase.decidedBy === "agent" ? "Decided by AI" : "Decided by staff"}
                </span>
                <StatusPill status={returnCase.status} />
              </span>
            </div>

            <p className="mt-2 text-neutral-600">{returnCase.description}</p>
            <p className="mt-1 text-xs text-neutral-500">{returnCase.decisionBasis}</p>
            <p className="mt-2 text-xs text-neutral-400">
              {returnCase.customerEmail} · {formatDateTime(returnCase.createdAt)}
              {returnCase.refundAmount ? ` · ${formatPrice(returnCase.refundAmount.toString(), "KES")}` : ""}
            </p>

            {returnCase.status === "escalated" && (
              <div className="mt-4 flex flex-wrap gap-4 border-t border-border-subtle pt-4">
                <form action={approveEscalatedCase} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="caseId" value={returnCase.id} />
                  <div>
                    <label className="block text-xs text-neutral-500">Refund amount</label>
                    <input type="number" step="0.01" name="refundAmount" required className={`${inputClass} w-32`} />
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-500">Note (optional)</label>
                    <input type="text" name="note" className={`${inputClass} w-48`} />
                  </div>
                  <button type="submit" className={primaryButtonClass}>
                    Approve refund
                  </button>
                </form>
                <form action={denyCase}>
                  <input type="hidden" name="caseId" value={returnCase.id} />
                  <ConfirmSubmitButton
                    confirmMessage={`Deny the ${reasonLabel(returnCase.reason)} case for order ${returnCase.shopifyOrderName}?`}
                    className={dangerButtonClass}
                    pendingText="Denying…"
                  >
                    Deny
                  </ConfirmSubmitButton>
                </form>
              </div>
            )}

            {returnCase.status === "approved" && returnCase.refundAmount && (
              <form action={markCaseRefunded} className="mt-4 flex flex-wrap items-end gap-2 border-t border-border-subtle pt-4">
                <input type="hidden" name="caseId" value={returnCase.id} />
                <div>
                  <label className="block text-xs text-neutral-500">Paid out from</label>
                  <select name="paidFrom" required className={`${inputClass} w-32`}>
                    <option value="mpesa">M-Pesa</option>
                    <option value="cash">Cash</option>
                  </select>
                </div>
                <button type="submit" className={primaryButtonClass}>
                  Mark refunded
                </button>
              </form>
            )}
          </li>
        ))}
        {cases.length === 0 && <p className="text-sm text-neutral-500">No support cases yet.</p>}
      </ul>

      <PaginationControls
        pathname="/admin/support"
        searchParams={resolvedSearchParams}
        page={page}
        pageSize={take}
        totalCount={totalCount}
      />
    </div>
  );
}
