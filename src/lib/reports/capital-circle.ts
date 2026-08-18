import "server-only";
import { prisma } from "../prisma";
import { CAPITAL_CIRCLE_LIVE } from "../capital-circle/config";
import { isCircleWalletConfigured } from "../capital-circle/circle-wallet-client";

export type CapitalCircleReportPosition = {
  id: string;
  question: string;
  thesis: string;
  sizeUsd: number;
  status: string;
  txHash: string | null;
  createdAt: Date;
};

export type CapitalCircleReport = {
  live: boolean;
  positions: CapitalCircleReportPosition[];
  totalSimulatedUsd: number;
  totalExecutedUsd: number;
};

/** The week's decisions — this is the report /admin/reports/capital-circle renders. */
export async function getCapitalCircleReport(limit = 50): Promise<CapitalCircleReport> {
  const positions = await prisma.capitalCirclePosition.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  let totalSimulatedUsd = 0;
  let totalExecutedUsd = 0;
  for (const p of positions) {
    const size = Number(p.sizeUsd);
    if (p.status === "simulated") totalSimulatedUsd += size;
    if (p.status === "executed") totalExecutedUsd += size;
  }

  return {
    live: CAPITAL_CIRCLE_LIVE && isCircleWalletConfigured,
    positions: positions.map((p) => ({
      id: p.id,
      question: p.question,
      thesis: p.thesis,
      sizeUsd: Number(p.sizeUsd),
      status: p.status,
      txHash: p.txHash,
      createdAt: p.createdAt,
    })),
    totalSimulatedUsd,
    totalExecutedUsd,
  };
}
