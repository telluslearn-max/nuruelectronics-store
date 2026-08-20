/**
 * Merges positions, sweeps, and Binance transfer records into one wallet-activity timeline —
 * "did my deposit land, and where did the money go" without a block explorer. Deliberately zero
 * RPC calls: an on-chain Transfer-log scan (getLogs) was considered and dropped for this pass —
 * public RPCs range-cap and rate-limit it, and everything meaningful about wallet activity in
 * this app already exists in Postgres. All row builders are pure; the Prisma queries that feed
 * them live in reports/capital-circle-wallet.ts.
 */
export type WalletActivitySource = "position" | "sweep" | "binance-in" | "binance-out";
export type WalletActivityDirection = "in" | "out";

export type WalletActivityRow = {
  key: string;
  source: WalletActivitySource;
  direction: WalletActivityDirection;
  atMs: number;
  amountUsd: number | null;
  label: string;
  status: string;
  txHash: string | null;
};

const LABEL_MAX_LENGTH = 80;

export type PositionForActivity = { id: string; question: string; sizeUsd: number; status: string; txHash: string | null; createdAt: Date };

export function positionToActivityRow(position: PositionForActivity): WalletActivityRow {
  const label = position.question.length > LABEL_MAX_LENGTH ? `${position.question.slice(0, LABEL_MAX_LENGTH - 3)}...` : position.question;
  return {
    key: `position:${position.id}`,
    source: "position",
    direction: "out",
    atMs: position.createdAt.getTime(),
    amountUsd: position.sizeUsd,
    label,
    status: position.status,
    txHash: position.txHash,
  };
}

export type SweepForActivity = {
  id: string;
  weekStart: Date;
  confirmedUsdcAmount: number | null;
  confirmedAt: Date | null;
  detectedUsdcAmount: number | null;
  detectedAt: Date | null;
  detectedTxHash: string | null;
};

/** null when the sweep is still a bare proposal — neither the webhook nor a human has recorded
    money actually arriving, so there's nothing yet worth showing as "activity". */
export function sweepToActivityRow(sweep: SweepForActivity): WalletActivityRow | null {
  const weekLabel = `Weekly profit sweep — week of ${sweep.weekStart.toISOString().slice(0, 10)}`;
  if (sweep.confirmedAt && sweep.confirmedUsdcAmount != null) {
    return {
      key: `sweep:${sweep.id}`,
      source: "sweep",
      direction: "in",
      atMs: sweep.confirmedAt.getTime(),
      amountUsd: sweep.confirmedUsdcAmount,
      label: weekLabel,
      status: "confirmed",
      txHash: sweep.detectedTxHash,
    };
  }
  if (sweep.detectedAt && sweep.detectedUsdcAmount != null) {
    return {
      key: `sweep:${sweep.id}`,
      source: "sweep",
      direction: "in",
      atMs: sweep.detectedAt.getTime(),
      amountUsd: sweep.detectedUsdcAmount,
      label: weekLabel,
      status: "detected (unconfirmed)",
      txHash: sweep.detectedTxHash,
    };
  }
  return null;
}

export type AuditLogForActivity = { id: string; action: string; createdAt: Date; metadata: unknown };

const BINANCE_DEPOSIT_ACTION = "capital-circle.binance-deposit.success";
const BINANCE_WITHDRAW_ACTION = "capital-circle.wallet-withdraw.success";

/** metadata is Json? on the Prisma model — parsed defensively, never trusted to have the shape
    the action that wrote it intended. */
export function auditLogToActivityRow(entry: AuditLogForActivity): WalletActivityRow | null {
  if (entry.action !== BINANCE_DEPOSIT_ACTION && entry.action !== BINANCE_WITHDRAW_ACTION) return null;

  const metadata = entry.metadata as { amountUsdc?: unknown } | null;
  const amountUsd = typeof metadata?.amountUsdc === "number" ? metadata.amountUsdc : null;
  const isDeposit = entry.action === BINANCE_DEPOSIT_ACTION;

  return {
    key: `audit:${entry.id}`,
    source: isDeposit ? "binance-in" : "binance-out",
    direction: isDeposit ? "in" : "out",
    atMs: entry.createdAt.getTime(),
    amountUsd,
    label: isDeposit ? "Deposit from Binance" : "Withdrawal to Binance",
    status: "success",
    txHash: null,
  };
}

/** Pure merge: drop nulls, newest first, truncate. Ordering across heterogeneous sources is the
    one thing worth testing here on its own — each row builder above is trivial by comparison. */
export function mergeWalletActivity(rows: Array<WalletActivityRow | null>, limit: number): WalletActivityRow[] {
  return rows
    .filter((row): row is WalletActivityRow => row !== null)
    .sort((a, b) => b.atMs - a.atMs)
    .slice(0, limit);
}
