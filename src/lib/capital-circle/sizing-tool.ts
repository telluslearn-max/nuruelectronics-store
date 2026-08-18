import "server-only";
import { prisma } from "../prisma";
import { DEFAULT_PER_POSITION_CAP_USD } from "./config";
import { weekStartOf } from "./sweep";

export type SizingResult = {
  approvedUsd: number;
  capUsd: number;
  capped: boolean;
  reason: string;
};

function dayStartOf(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function monthStartOf(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

/** Real capital already committed since `since` — simulated/rejected positions never moved funds, so they don't count against a velocity cap. */
async function executedUsdSince(since: Date): Promise<number> {
  const result = await prisma.capitalCirclePosition.aggregate({
    where: { status: "executed", createdAt: { gte: since } },
    _sum: { sizeUsd: true },
  });
  return Number(result._sum.sizeUsd ?? 0);
}

/**
 * Risk/Sizing's job, made literal: bound a requested position size against every cap that
 * applies — the per-tx cap (or the conservative default while no real wallet exists, see
 * config.ts), then whichever daily/weekly/monthly velocity caps the active wallet has set,
 * checked against what's actually been executed in each window. These are deliberately the
 * same numbers that would also be set as the real Circle wallet-limit policy, so app-level
 * and wallet-level limits agree by construction. Velocity caps have no default — unlike the
 * per-tx cap, they only bind once a wallet has real ones configured.
 */
export async function sizePosition(requestedUsd: number): Promise<SizingResult> {
  const wallet = await prisma.capitalCircleWallet.findFirst({
    where: { status: "active" },
    orderBy: { createdAt: "desc" },
  });

  const perTxCapUsd = wallet?.perTxCapUsd != null ? Number(wallet.perTxCapUsd) : DEFAULT_PER_POSITION_CAP_USD;

  if (requestedUsd <= 0) {
    return { approvedUsd: 0, capUsd: perTxCapUsd, capped: false, reason: "Requested size was zero or negative." };
  }

  let approvedUsd = requestedUsd;
  let bindingCapUsd = perTxCapUsd;
  let bindingReason: string | null = null;

  if (approvedUsd > perTxCapUsd) {
    approvedUsd = perTxCapUsd;
    bindingReason = `exceeds the ${wallet ? "wallet's configured" : "default"} per-position cap of $${perTxCapUsd.toFixed(2)}`;
  }

  const now = new Date();
  const velocityWindows: { label: string; capUsd: number | null; since: Date }[] = [
    { label: "daily", capUsd: wallet?.dailyCapUsd != null ? Number(wallet.dailyCapUsd) : null, since: dayStartOf(now) },
    { label: "weekly", capUsd: wallet?.weeklyCapUsd != null ? Number(wallet.weeklyCapUsd) : null, since: weekStartOf(now) },
    { label: "monthly", capUsd: wallet?.monthlyCapUsd != null ? Number(wallet.monthlyCapUsd) : null, since: monthStartOf(now) },
  ];

  for (const window of velocityWindows) {
    if (window.capUsd == null) continue;
    const spentSoFar = await executedUsdSince(window.since);
    const headroom = Math.max(0, window.capUsd - spentSoFar);
    if (approvedUsd > headroom) {
      approvedUsd = headroom;
      bindingCapUsd = window.capUsd;
      bindingReason = `only $${headroom.toFixed(2)} of headroom remains under the ${window.label} cap of $${window.capUsd.toFixed(2)} ($${spentSoFar.toFixed(2)} already executed)`;
    }
  }

  if (bindingReason) {
    return {
      approvedUsd,
      capUsd: bindingCapUsd,
      capped: true,
      reason: `Requested $${requestedUsd.toFixed(2)} ${bindingReason} — sized down to $${approvedUsd.toFixed(2)}.`,
    };
  }

  return { approvedUsd: requestedUsd, capUsd: perTxCapUsd, capped: false, reason: "Within all configured caps, no adjustment needed." };
}
