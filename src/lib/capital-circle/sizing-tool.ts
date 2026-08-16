import "server-only";
import { prisma } from "../prisma";
import { DEFAULT_PER_POSITION_CAP_USD } from "./config";

export type SizingResult = {
  approvedUsd: number;
  capUsd: number;
  capped: boolean;
  reason: string;
};

/**
 * Risk/Sizing's job, made literal: bound a requested position size against
 * the wallet's configured per-tx cap (or the conservative default while no
 * real wallet exists — see config.ts). This is deliberately the same number
 * that would later be set as the real Circle wallet-limit policy, so
 * app-level and wallet-level limits agree by construction (see the plan
 * doc's "How the circuit breaker actually gets enforced").
 */
export async function sizePosition(requestedUsd: number): Promise<SizingResult> {
  const wallet = await prisma.capitalCircleWallet.findFirst({
    where: { status: "active" },
    orderBy: { createdAt: "desc" },
  });

  const capUsd = wallet?.perTxCapUsd != null ? Number(wallet.perTxCapUsd) : DEFAULT_PER_POSITION_CAP_USD;

  if (requestedUsd <= 0) {
    return { approvedUsd: 0, capUsd, capped: false, reason: "Requested size was zero or negative." };
  }

  if (requestedUsd > capUsd) {
    return {
      approvedUsd: capUsd,
      capUsd,
      capped: true,
      reason: `Requested $${requestedUsd.toFixed(2)} exceeds the ${wallet ? "wallet's configured" : "default"} per-position cap of $${capUsd.toFixed(2)} — sized down.`,
    };
  }

  return { approvedUsd: requestedUsd, capUsd, capped: false, reason: "Within cap, no adjustment needed." };
}
