import "server-only";
import { prisma } from "../prisma";
import { logAdminAction } from "../audit-log";
import { CAPITAL_CIRCLE_LIVE } from "./config";
import { isCircleWalletConfigured, getCircleWalletClient } from "./circle-wallet-client";

export type RecordPositionInput = {
  conditionId: string;
  tokenId: string;
  question: string;
  thesis: string;
  sizeUsd: number;
};

export type RecordPositionResult = {
  positionId: string;
  status: "simulated" | "executed" | "rejected";
  txHash: string | null;
  note: string;
};

/**
 * The only tool with wallet-signing authority — everything upstream
 * (research-tool, sizing-tool) only ever produces a thesis and a bounded
 * size. When CAPITAL_CIRCLE_LIVE is false (the only possible value today —
 * see config.ts), or the Circle wallet isn't configured, this always writes
 * a "simulated" position instead of touching a real order. It never
 * silently escalates the other way: a live flag with no wallet configured
 * still simulates.
 */
export async function recordPosition(input: RecordPositionInput): Promise<RecordPositionResult> {
  const canGoLive = CAPITAL_CIRCLE_LIVE && isCircleWalletConfigured;

  if (!canGoLive) {
    const position = await prisma.capitalCirclePosition.create({
      data: {
        venue: "polymarket",
        marketId: input.conditionId,
        tokenId: input.tokenId,
        question: input.question,
        thesis: input.thesis,
        sizeUsd: input.sizeUsd,
        status: "simulated",
      },
    });
    await logAdminAction({
      action: "capital-circle.position.simulate",
      entityType: "capital_circle_position",
      entityId: position.id,
      summary: `Capital Circle would size $${input.sizeUsd.toFixed(2)} into "${input.question}" — simulated (${CAPITAL_CIRCLE_LIVE ? "no Circle wallet configured yet" : "CAPITAL_CIRCLE_LIVE is false"}).`,
      metadata: { conditionId: input.conditionId, tokenId: input.tokenId, sizeUsd: input.sizeUsd, thesis: input.thesis },
    });
    return {
      positionId: position.id,
      status: "simulated",
      txHash: null,
      note: "Recorded as simulated — no real funds or wallet involved yet.",
    };
  }

  const wallet = getCircleWalletClient();
  try {
    const { txHash } = await wallet.signAndSendPolymarketOrder({
      tokenId: input.tokenId,
      sizeUsd: input.sizeUsd,
      side: "BUY",
    });
    const position = await prisma.capitalCirclePosition.create({
      data: {
        venue: "polymarket",
        marketId: input.conditionId,
        tokenId: input.tokenId,
        question: input.question,
        thesis: input.thesis,
        sizeUsd: input.sizeUsd,
        status: "executed",
        txHash,
      },
    });
    await logAdminAction({
      action: "capital-circle.position.execute",
      entityType: "capital_circle_position",
      entityId: position.id,
      summary: `Capital Circle executed $${input.sizeUsd.toFixed(2)} into "${input.question}" — tx ${txHash}.`,
      metadata: { conditionId: input.conditionId, tokenId: input.tokenId, sizeUsd: input.sizeUsd, thesis: input.thesis, txHash },
    });
    return { positionId: position.id, status: "executed", txHash, note: "Executed for real." };
  } catch (error) {
    const position = await prisma.capitalCirclePosition.create({
      data: {
        venue: "polymarket",
        marketId: input.conditionId,
        tokenId: input.tokenId,
        question: input.question,
        thesis: input.thesis,
        sizeUsd: input.sizeUsd,
        status: "rejected",
      },
    });
    await logAdminAction({
      action: "capital-circle.position.reject",
      entityType: "capital_circle_position",
      entityId: position.id,
      summary: `Capital Circle execution failed for "${input.question}": ${error instanceof Error ? error.message : "unknown error"}.`,
      metadata: { conditionId: input.conditionId, tokenId: input.tokenId, sizeUsd: input.sizeUsd },
    });
    return {
      positionId: position.id,
      status: "rejected",
      txHash: null,
      note: error instanceof Error ? error.message : "Execution failed.",
    };
  }
}
