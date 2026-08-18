import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/admin-auth";
import { getCapitalCircleReport } from "@/lib/reports/capital-circle";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "Capital Circle" };

const STATUS_STYLES: Record<string, string> = {
  simulated: "bg-neutral-100 text-neutral-600",
  approved: "bg-blue-50 text-blue-700",
  executed: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-700",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? "bg-neutral-100 text-neutral-600"}`}>
      {status}
    </span>
  );
}

export default async function CapitalCirclePage() {
  await requireAdminSession();
  const report = await getCapitalCircleReport();

  return (
    <div>
      <h2 className="text-lg font-medium">Capital Circle</h2>
      <p className="mt-2 max-w-2xl text-neutral-500">
        The firewalled, USDC-funded pool that hunts for profit outside electronics retail — a Researcher / Risk-Sizing /
        Executor desk running weekly against real, live Polymarket markets. Every decision here is logged to the audit
        log before anything (real or simulated) is recorded.
      </p>

      <div
        className={`mt-4 inline-flex items-center gap-2 rounded-control border px-3 py-2 text-sm ${
          report.live ? "border-green-200 bg-green-50 text-green-800" : "border-border-subtle text-neutral-600"
        }`}
      >
        <span className={`h-2 w-2 rounded-full ${report.live ? "bg-green-500" : "bg-neutral-400"}`} />
        {report.live
          ? "Live — a configured Circle wallet can execute real orders."
          : "Simulation mode — no Circle wallet configured yet. Real markets, real reasoning, no real funds."}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-card border border-border-subtle p-4">
          <div className="text-xs text-neutral-500">Simulated (would-execute) total</div>
          <div className="mt-1 text-2xl font-medium tabular-nums">{formatPrice(report.totalSimulatedUsd.toFixed(2), "USD")}</div>
        </div>
        <div className="rounded-card border border-border-subtle p-4">
          <div className="text-xs text-neutral-500">Executed (real) total</div>
          <div className="mt-1 text-2xl font-medium tabular-nums">{formatPrice(report.totalExecutedUsd.toFixed(2), "USD")}</div>
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-400">Positions</h3>
        {report.positions.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">
            No cycles have run yet. The weekly cron hits <code className="rounded bg-neutral-100 px-1 py-0.5">/api/cron/capital-circle-cycle</code>{" "}
            every Monday — trigger it manually with the <code className="rounded bg-neutral-100 px-1 py-0.5">CRON_SECRET</code> bearer token to see one now.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {report.positions.map((p) => (
              <li key={p.id} className="rounded-card border border-border-subtle p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="font-medium">{p.question}</div>
                  <StatusPill status={p.status} />
                </div>
                <p className="mt-2 text-sm text-neutral-600">{p.thesis}</p>
                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
                  <span className="tabular-nums">{formatPrice(p.sizeUsd.toFixed(2), "USD")}</span>
                  <span>{p.createdAt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}</span>
                  {p.txHash && <span className="font-mono">{p.txHash}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
