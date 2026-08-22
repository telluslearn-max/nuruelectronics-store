import type { Metadata } from "next";
import { requireAdminSession } from "@/lib/admin-auth";
import {
  getCapitalCircleCycleStatus,
  getCapitalCircleIntelligenceReport,
  getCapitalCircleReport,
  getCapitalCircleWallets,
  getPendingSweeps,
  type CapitalCircleIntelligenceReport,
} from "@/lib/reports/capital-circle";
import { confirmSweep } from "@/lib/capital-circle/sweep-actions";
import { clearCapitalCirclePause } from "@/lib/capital-circle/wallet-actions";
import { formatPrice, formatEatDate, formatEatDateTime } from "@/lib/format";
import { FeedbackBanner } from "@/components/admin/feedback-banner";
import { PushSubscribeButton } from "@/components/admin/push-subscribe-button";
import { ScanStatus } from "@/components/admin/scan-status";
import { WalletSection } from "./wallet-section";

export const metadata: Metadata = { title: "Capital Circle" };

const STATUS_STYLES: Record<string, string> = {
  simulated: "bg-neutral-100 text-neutral-600",
  approved: "bg-blue-50 text-blue-700",
  executed: "bg-green-50 text-green-700",
  rejected: "bg-red-50 text-red-700",
  // Refused for lack of expected value — an amber "the desk declined", not a failure.
  edge_rejected: "bg-amber-50 text-amber-700",
  exited: "bg-blue-50 text-blue-700",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_STYLES[status] ?? "bg-neutral-100 text-neutral-600"}`}>
      {status}
    </span>
  );
}

/** Won (green) / lost (red) once a position has settled — resultUsd's sign is the source of
 * truth, matching the settlement math in settlement.ts (shares * finalPrice - sizeUsd). */
function ResultBadge({ resultUsd }: { resultUsd: number }) {
  const won = resultUsd >= 0;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium tabular-nums ${
        won ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
      }`}
    >
      {won ? "+" : "-"}
      {formatPrice(Math.abs(resultUsd).toFixed(2), "USD")}
    </span>
  );
}

/** The small "+$25.00 realized (2 settled)" line under a stat-card total — omitted entirely when
 * nothing in that bucket has settled yet, since "+$0.00" would misleadingly read as "broke even"
 * rather than "nothing to report." */
function PnlLine({ pnlUsd, resolvedCount }: { pnlUsd: number; resolvedCount: number }) {
  if (resolvedCount === 0) return null;
  return (
    <div className={`mt-1 text-sm font-medium tabular-nums ${pnlUsd >= 0 ? "text-green-700" : "text-red-700"}`}>
      {pnlUsd >= 0 ? "+" : "-"}
      {formatPrice(Math.abs(pnlUsd).toFixed(2), "USD")} realized ({resolvedCount} settled)
    </div>
  );
}

/** Ongoing/unresolved position — not yet a win or a loss, distinct from both. */
function LiveBadge() {
  return (
    <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
      live
    </span>
  );
}

/** Left-edge accent color for a position card — green/red/amber mirror the badges, so the whole
 * card reads as won/lost/live at a glance while scanning a long list, not just its small badge. */
function positionAccentClass(p: { status: string; resolvedAt: Date | null; resultUsd: number | null }): string {
  if (p.status === "rejected") return "border-l-neutral-200";
  if (p.resolvedAt && p.resultUsd != null) return p.resultUsd >= 0 ? "border-l-green-400" : "border-l-red-400";
  return "border-l-amber-400";
}

/** One cell of a position's Wagered/Odds/To win/Confidence mini-grid — label-over-value instead
 * of the inline "Label value" pairs this used to be, which stopped scanning well once a fourth
 * field (Confidence) got added to what was already a wrapping row of small text. */
function PositionStat({ label, value, valueClassName }: { label: string; value: string; valueClassName?: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-neutral-400">{label}</div>
      <div className={`mt-0.5 text-sm font-medium tabular-nums ${valueClassName ?? "text-neutral-700"}`}>{value}</div>
    </div>
  );
}

/**
 * The section that answers "is this thing actually any good?".
 *
 * Realized P&L over a few dozen short-horizon bets is mostly noise, so the
 * leading numbers here are calibration and the counterfactual sweep instead:
 * whether the model's stated 70% is a real 70%, and whether a different edge
 * threshold would have done better on the same markets. Both are measured over
 * every candidate the agent priced, including the ones it passed on, so they
 * aren't filtered by the model's own judgement.
 */
function IntelligenceSection({ report, pausedWalletId }: { report: CapitalCircleIntelligenceReport; pausedWalletId: string | null }) {
  const { calibration } = report;

  return (
    <div className="mt-8">
      <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-400">Forecasting quality</h3>

      {report.circuitBreaker.paused && (
        <div className="mt-3 rounded-card border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <div className="font-medium">Trading is paused</div>
          <p className="mt-1">{report.circuitBreaker.reason}</p>
          <p className="mt-1 text-xs text-red-700">
            Since {report.circuitBreaker.since ? formatEatDateTime(report.circuitBreaker.since) : "unknown"}. Look at why the losses happened before resuming —
            the pause exists because a losing run and a broken thesis generator look identical from the inside.
          </p>
          {pausedWalletId && (
            <form action={clearCapitalCirclePause} className="mt-3">
              <input type="hidden" name="walletId" value={pausedWalletId} />
              <button type="submit" className="rounded-control border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-800">
                Resume trading
              </button>
            </form>
          )}
        </div>
      )}

      <div
        className={`mt-3 rounded-card border p-4 ${
          report.urgency.positionsToday >= report.urgency.dailyTarget
            ? "border-green-200 bg-green-50"
            : report.urgency.hungry
              ? "border-amber-200 bg-amber-50"
              : "border-border-subtle"
        }`}
      >
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div className="text-sm font-medium">
            Today: {report.urgency.positionsToday} of {report.urgency.dailyTarget} target position
            {report.urgency.dailyTarget === 1 ? "" : "s"} placed
          </div>
          <div className="text-xs tabular-nums text-neutral-600">
            edge bar now {report.urgency.minEdge.toFixed(4)}
            {report.urgency.hoursSinceLastPosition != null
              ? ` · last position ${report.urgency.hoursSinceLastPosition.toFixed(1)}h ago`
              : " · no position ever placed"}
          </div>
        </div>
        <p className="mt-1 text-xs text-neutral-600">{report.urgency.reason}</p>
      </div>

      {calibration.sampleCount === 0 ? (
        <p className="mt-3 text-sm text-neutral-500">
          Nothing has resolved yet. Once markets the desk priced start closing, this section fills in with its Brier score,
          calibration by confidence band, and a sweep of what other edge thresholds would have earned on the same markets.
        </p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-card border border-border-subtle p-4">
              <div className="text-xs text-neutral-500">Brier score ({calibration.sampleCount} scored)</div>
              <div className="mt-1 text-2xl font-medium tabular-nums">{calibration.brierScore?.toFixed(3)}</div>
              <p className="mt-1 text-xs text-neutral-400">
                Lower is better. Always guessing the base rate would score {calibration.baseRateBrier?.toFixed(3)}.
              </p>
            </div>
            <div className="rounded-card border border-border-subtle p-4">
              <div className="text-xs text-neutral-500">Skill vs the base rate</div>
              <div
                className={`mt-1 text-2xl font-medium tabular-nums ${
                  calibration.skillScore == null ? "" : calibration.skillScore > 0 ? "text-green-700" : "text-red-700"
                }`}
              >
                {calibration.skillScore != null ? calibration.skillScore.toFixed(3) : "n/a"}
              </div>
              <p className="mt-1 text-xs text-neutral-400">
                Above zero means the forecasts add information. At or below zero they don&apos;t.
              </p>
            </div>
            <div className="rounded-card border border-border-subtle p-4">
              <div className="text-xs text-neutral-500">Trust in the model (λ)</div>
              <div className="mt-1 text-2xl font-medium tabular-nums">{report.shrinkage.lambda.toFixed(2)}</div>
              <p className="mt-1 text-xs text-neutral-400">{report.shrinkage.reason}</p>
            </div>
          </div>

          {calibration.meanBias != null && Math.abs(calibration.meanBias) > 0.03 && (
            <p className="mt-3 text-sm text-neutral-600">
              The desk is running{" "}
              <span className="font-medium">
                {Math.abs(calibration.meanBias * 100).toFixed(1)} points {calibration.meanBias > 0 ? "overconfident" : "underconfident"}
              </span>{" "}
              on average. Sizing already corrects for this via λ above, and the figure is fed back into each cycle&apos;s prompt.
            </p>
          )}

          {calibration.buckets.length > 0 && (
            <>
              {/* Cards on mobile — a 4-column table forced into overflow-x-auto is a sideways-scroll
                  puzzle on a phone; the same data reads at a glance stacked. */}
              <div className="mt-4 space-y-2 sm:hidden">
                {calibration.buckets.map((bucket) => (
                  <div key={bucket.label} className="rounded-card border border-border-subtle p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="font-medium tabular-nums">Said {bucket.label}</span>
                      <span className="text-xs text-neutral-400">n={bucket.count}</span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-xs">
                      <span className="text-neutral-500">
                        Actually happened <span className="tabular-nums text-neutral-700">{(bucket.actualRate * 100).toFixed(0)}%</span>
                      </span>
                      <span className={`tabular-nums font-medium ${Math.abs(bucket.gap) > 0.15 ? "text-red-700" : "text-neutral-500"}`}>
                        {bucket.gap > 0 ? "+" : ""}
                        {(bucket.gap * 100).toFixed(0)} gap
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 hidden overflow-x-auto sm:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-neutral-400">
                      <th className="py-2 pr-4 font-medium">Said</th>
                      <th className="py-2 pr-4 font-medium">Actually happened</th>
                      <th className="py-2 pr-4 font-medium">Gap</th>
                      <th className="py-2 font-medium">n</th>
                    </tr>
                  </thead>
                  <tbody>
                    {calibration.buckets.map((bucket) => (
                      <tr key={bucket.label} className="border-t border-border-subtle">
                        <td className="py-2 pr-4 tabular-nums">{bucket.label}</td>
                        <td className="py-2 pr-4 tabular-nums">{(bucket.actualRate * 100).toFixed(0)}%</td>
                        <td className={`py-2 pr-4 tabular-nums ${Math.abs(bucket.gap) > 0.15 ? "text-red-700" : "text-neutral-600"}`}>
                          {bucket.gap > 0 ? "+" : ""}
                          {(bucket.gap * 100).toFixed(0)}
                        </td>
                        <td className="py-2 tabular-nums text-neutral-500">{bucket.count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {report.categories.filter((category) => category.count >= 5).length > 0 && (
            <p className="mt-4 text-sm text-neutral-600">
              By topic:{" "}
              {report.categories
                .filter((category) => category.count >= 5)
                .map((category) => `${category.category} ${(category.winRate * 100).toFixed(0)}% of ${category.count}`)
                .join(" · ")}
            </p>
          )}
        </>
      )}

      {report.policySweep.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            What other thresholds would have earned
          </h3>
          <p className="mt-2 max-w-2xl text-sm text-neutral-500">
            Replayed over {report.labeledCandidateCount} resolved candidates the desk priced — including ones it passed on, so
            this isn&apos;t filtered by its own judgement. Read the trade count alongside the return: a setting that traded twice
            proves nothing, and a setting that only works at one exact threshold is fitted to noise.
          </p>
          {/* Cards on mobile — 6 columns has no honest table layout under ~400px; the same numbers
              read at a glance stacked, with the one that matters (return) up top. */}
          <div className="mt-3 space-y-2 sm:hidden">
            {report.policySweep.map((outcome) => (
              <div key={`${outcome.params.minEdge}-${outcome.params.lambda}`} className="rounded-card border border-border-subtle p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium tabular-nums">
                    edge {outcome.params.minEdge} · λ {outcome.params.lambda}
                  </span>
                  <span
                    className={`tabular-nums font-medium ${
                      outcome.returnOnStake == null ? "" : outcome.returnOnStake >= 0 ? "text-green-700" : "text-red-700"
                    }`}
                  >
                    {outcome.returnOnStake != null ? `${(outcome.returnOnStake * 100).toFixed(1)}%` : "—"}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <div className="text-neutral-400">Trades</div>
                    <div className="tabular-nums text-neutral-700">{outcome.tradeCount}</div>
                  </div>
                  <div>
                    <div className="text-neutral-400">Win rate</div>
                    <div className="tabular-nums text-neutral-700">{outcome.tradeCount > 0 ? `${(outcome.winRate * 100).toFixed(0)}%` : "—"}</div>
                  </div>
                  <div>
                    <div className="text-neutral-400">Staked</div>
                    <div className="tabular-nums text-neutral-700">{formatPrice(outcome.stakedUsd.toFixed(2), "USD")}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 hidden overflow-x-auto sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-neutral-400">
                  <th className="py-2 pr-4 font-medium">Min edge</th>
                  <th className="py-2 pr-4 font-medium">λ</th>
                  <th className="py-2 pr-4 font-medium">Trades</th>
                  <th className="py-2 pr-4 font-medium">Win rate</th>
                  <th className="py-2 pr-4 font-medium">Staked</th>
                  <th className="py-2 font-medium">Return on stake</th>
                </tr>
              </thead>
              <tbody>
                {report.policySweep.map((outcome) => (
                  <tr key={`${outcome.params.minEdge}-${outcome.params.lambda}`} className="border-t border-border-subtle">
                    <td className="py-2 pr-4 tabular-nums">{outcome.params.minEdge}</td>
                    <td className="py-2 pr-4 tabular-nums">{outcome.params.lambda}</td>
                    <td className="py-2 pr-4 tabular-nums text-neutral-500">{outcome.tradeCount}</td>
                    <td className="py-2 pr-4 tabular-nums">{outcome.tradeCount > 0 ? `${(outcome.winRate * 100).toFixed(0)}%` : "—"}</td>
                    <td className="py-2 pr-4 tabular-nums">{formatPrice(outcome.stakedUsd.toFixed(2), "USD")}</td>
                    <td
                      className={`py-2 tabular-nums ${
                        outcome.returnOnStake == null ? "" : outcome.returnOnStake >= 0 ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      {outcome.returnOnStake != null ? `${(outcome.returnOnStake * 100).toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {report.recentCycles.length > 0 && (
        <div className="mt-8">
          <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-400">
            Recent cycles{report.edgeRejectedCount > 0 ? ` — ${report.edgeRejectedCount} trade(s) refused for lack of edge` : ""}
          </h3>
          <ul className="mt-3 space-y-2">
            {report.recentCycles.map((cycle) => (
              <li key={cycle.id} className="rounded-card border border-border-subtle p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                  <span className="tabular-nums">{formatEatDateTime(cycle.startedAt)}</span>
                  <StatusPill status={cycle.action} />
                  <span>{cycle.candidateCount} candidates</span>
                  {cycle.hadNews && <span className="text-neutral-400">news grounded</span>}
                </div>
                <p className="mt-2 text-neutral-600">{cycle.summary}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default async function CapitalCirclePage({
  searchParams,
}: {
  searchParams: Promise<{ success?: string; error?: string }>;
}) {
  await requireAdminSession();
  const [report, pendingSweeps, wallets, intelligence, cycleStatus] = await Promise.all([
    getCapitalCircleReport(),
    getPendingSweeps(),
    getCapitalCircleWallets(),
    getCapitalCircleIntelligenceReport(),
    getCapitalCircleCycleStatus(),
  ]);
  const { success, error } = await searchParams;

  return (
    <div>
      <h2 className="text-lg font-medium">Capital Circle</h2>
      <FeedbackBanner success={success} error={error} />
      <p className="mt-2 max-w-2xl text-neutral-500">
        The firewalled, USDC-funded pool that hunts for profit outside electronics retail. Every hour it screens live
        Polymarket markets for liquidity and spread, has the model price the whole slate several times over, then decides
        in code which of those forecasts carry real expected value against the order book — and sizes them by fractional
        Kelly. The model estimates probabilities; it does not decide what to trade. Every decision is logged to the audit
        log before anything (real or simulated) is recorded.
      </p>

      <div
        className={`mt-4 flex items-center gap-2 rounded-card border p-4 text-sm ${
          report.live ? "border-green-200 bg-green-50 text-green-800" : "border-border-subtle text-neutral-600"
        }`}
      >
        <span className={`h-2 w-2 shrink-0 rounded-full ${report.live ? "bg-green-500" : "bg-neutral-400"}`} />
        {report.live
          ? "Live — a configured Circle wallet can execute real orders."
          : "Simulation mode — no Circle wallet configured yet. Real markets, real reasoning, no real funds."}
      </div>

      <ScanStatus status={cycleStatus} />

      <PushSubscribeButton />

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-card border border-border-subtle p-4">
          <div className="text-xs text-neutral-500">Simulated bets — wagered</div>
          <div className="mt-1 text-2xl font-medium tabular-nums">{formatPrice(report.totalSimulatedUsd.toFixed(2), "USD")}</div>
          <p className="mt-1 text-xs text-neutral-400">Play money — no wallet involved</p>
          <PnlLine pnlUsd={report.simulatedPnlUsd} resolvedCount={report.simulatedResolvedCount} />
        </div>
        <div className="rounded-card border border-border-subtle p-4">
          <div className="text-xs text-neutral-500">Real account — wagered</div>
          <div className="mt-1 text-2xl font-medium tabular-nums">{formatPrice(report.totalExecutedUsd.toFixed(2), "USD")}</div>
          <p className="mt-1 text-xs text-neutral-400">Actual USDC from the Circle wallet</p>
          <PnlLine pnlUsd={report.executedPnlUsd} resolvedCount={report.executedResolvedCount} />
        </div>
        <div className="rounded-card border border-border-subtle p-4">
          <div className="text-xs text-neutral-500">Combined P&amp;L ({report.resolvedCount} settled)</div>
          <div
            className={`mt-1 text-2xl font-medium tabular-nums ${
              report.resolvedCount === 0 ? "" : report.totalRealizedPnlUsd >= 0 ? "text-green-700" : "text-red-700"
            }`}
          >
            {report.resolvedCount > 0 && (report.totalRealizedPnlUsd >= 0 ? "+" : "-")}
            {formatPrice(Math.abs(report.totalRealizedPnlUsd).toFixed(2), "USD")}
          </div>
          <p className="mt-1 text-xs text-neutral-400">Simulated + real together — see the two cards above to split them</p>
        </div>
      </div>

      <IntelligenceSection
        report={intelligence}
        pausedWalletId={wallets.find((wallet) => wallet.pausedAt)?.id ?? null}
      />

      <div className="mt-8">
        <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-400">Positions</h3>
        {report.positions.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">
            No cycles have run yet. The cron hits <code className="rounded bg-neutral-100 px-1 py-0.5">/api/cron/capital-circle-cycle</code>{" "}
            every hour — trigger it manually with the <code className="rounded bg-neutral-100 px-1 py-0.5">CRON_SECRET</code> bearer token to see one now.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {report.positions.map((p) => (
              <li
                key={p.id}
                className={`rounded-card border border-l-4 border-border-subtle p-4 ${positionAccentClass(p)}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="font-medium">{p.question}</div>
                  <div className="flex shrink-0 items-center gap-2">
                    <StatusPill status={p.exitReason === "take_profit" || p.exitReason === "stop" ? "exited" : p.status} />
                    {p.status !== "rejected" &&
                      (p.resolvedAt && p.resultUsd != null ? <ResultBadge resultUsd={p.resultUsd} /> : <LiveBadge />)}
                  </div>
                </div>
                <p className="mt-2 text-sm text-neutral-600">{p.thesis}</p>

                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-border-subtle pt-3 sm:grid-cols-4">
                  <PositionStat label="Wagered" value={formatPrice(p.sizeUsd.toFixed(2), "USD")} />
                  {p.entryPrice != null && <PositionStat label="Odds" value={`${Math.round(p.entryPrice * 100)}%`} />}
                  {p.entryPrice != null && !p.resolvedAt && (
                    <PositionStat
                      label="To win"
                      value={formatPrice(((p.sizeUsd * (1 - p.entryPrice)) / p.entryPrice).toFixed(2), "USD")}
                      valueClassName="text-green-700"
                    />
                  )}
                  {p.confidencePct != null && <PositionStat label="Confidence" value={`${p.confidencePct}%`} />}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-400">
                  <span>{formatEatDateTime(p.createdAt)}</span>
                  {p.resolvedAt && <span>resolved {formatEatDateTime(p.resolvedAt)}</span>}
                  {p.txHash && <span className="font-mono">{p.txHash}</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <WalletSection wallets={wallets} />

      <div className="mt-8">
        <h3 className="text-xs font-medium uppercase tracking-wide text-neutral-400">Pending Sweeps</h3>
        <p className="mt-2 max-w-2xl text-sm text-neutral-500">
          Each week&apos;s proposed 40% profit split. Convert it to USDC yourself (Circle Mint or an exchange), send it to
          the wallet, then confirm the amount actually received below — nothing here moves money automatically.
        </p>
        {pendingSweeps.length === 0 ? (
          <p className="mt-3 text-sm text-neutral-500">
            No sweeps pending. The weekly cron hits{" "}
            <code className="rounded bg-neutral-100 px-1 py-0.5">/api/cron/profit-sweep</code> every Monday — trigger
            it manually with the <code className="rounded bg-neutral-100 px-1 py-0.5">CRON_SECRET</code> bearer token
            to see one now.
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {pendingSweeps.map((sweep) => (
              <li key={sweep.id} className="rounded-card border border-border-subtle p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="font-medium">
                    Week of {formatEatDate(sweep.weekStart)}
                  </div>
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
                    pending
                  </span>
                </div>
                <p className="mt-2 text-sm text-neutral-600">
                  Profit {formatPrice(sweep.totalProfitUsd.toFixed(2), "USD")} × {sweep.splitPercent}% ={" "}
                  <span className="font-medium">{formatPrice(sweep.sweepAmountUsd.toFixed(2), "USD")}</span> to sweep.
                </p>
                {sweep.detectedUsdcAmount != null && (
                  <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                    {formatPrice(sweep.detectedUsdcAmount.toFixed(2), "USD")} USDC detected — landed{" "}
                    {sweep.detectedAt && formatEatDateTime(sweep.detectedAt)}
                  </p>
                )}
                <form action={confirmSweep.bind(null, sweep.id)} className="mt-3 flex flex-wrap items-end gap-3">
                  <div>
                    <label className="block text-xs text-neutral-500">USDC amount received</label>
                    <input
                      type="number"
                      name="confirmedUsdcAmount"
                      step="0.01"
                      min="0"
                      defaultValue={(sweep.detectedUsdcAmount ?? sweep.sweepAmountUsd).toFixed(2)}
                      required
                      className="w-40 rounded-control border border-border-subtle px-3 py-2 text-sm outline-none focus:border-foreground"
                    />
                  </div>
                  <button
                    type="submit"
                    className="rounded-control bg-foreground px-4 py-2 text-sm font-medium text-background transition hover:opacity-90"
                  >
                    Confirm sweep
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
