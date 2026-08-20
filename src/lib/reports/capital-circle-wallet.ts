import "server-only";
import { unstable_cache } from "next/cache";
import { prisma } from "../prisma";
import { circleWalletAddress, getBalanceUsdc, isCircleWalletConfigured } from "../capital-circle/circle-wallet-client";
import { readCollateralBalance, readNativeBalance, type OnchainResult } from "../capital-circle/onchain";
import { MAX_TOTAL_EXPOSURE_USD } from "../capital-circle/config";

export const WALLET_ONCHAIN_TAG = "capital-circle-wallet-onchain";

/** Circle's balance call has no error handling of its own — see getBalanceUsdc's own comment on
    the separate, unverified risk of whether it even recognizes non-USDC-symbol collateral. */
export type CircleBalanceRead = { ok: true; amount: number } | { ok: false; reason: string };

export type WalletBalanceSnapshot = {
  configured: boolean;
  address: string | null;
  /** null specifically means "no wallet address to check," distinct from a failed read. */
  onchainCollateral: OnchainResult<number> | null;
  onchainNative: OnchainResult<number> | null;
  circleCollateral: CircleBalanceRead | null;
  discrepancyUsd: number | null;
  openExposureUsd: number;
  openPositionCount: number;
  portfolioLimitUsd: number;
  roomForNewPositionsUsd: number;
  fetchedAtMs: number;
};

/** Circle's indexed balance can lag the chain by a block or two, and a submitted-but-unmined
    outbound transfer is already debited on their side before it lands on-chain — a small,
    transient gap is expected, not an incident. Only flag past that. */
export function computeDiscrepancyUsd(onchain: number, circle: number): number | null {
  const diff = onchain - circle;
  const threshold = Math.max(0.01, 0.005 * onchain);
  return Math.abs(diff) > threshold ? diff : null;
}

async function loadWalletBalanceSnapshot(): Promise<WalletBalanceSnapshot> {
  const address = circleWalletAddress;

  const [onchainCollateral, onchainNative, circleCollateral, openCount, openExposure] = await Promise.all([
    address ? readCollateralBalance(address) : Promise.resolve(null),
    address ? readNativeBalance(address) : Promise.resolve(null),
    isCircleWalletConfigured
      ? getBalanceUsdc()
          .then((amount): CircleBalanceRead => ({ ok: true, amount }))
          .catch((error): CircleBalanceRead => ({ ok: false, reason: error instanceof Error ? error.message : String(error) }))
      : Promise.resolve(null),
    prisma.capitalCirclePosition.count({ where: { resolvedAt: null, status: { in: ["simulated", "executed"] } } }),
    prisma.capitalCirclePosition.aggregate({
      where: { resolvedAt: null, status: { in: ["simulated", "executed"] } },
      _sum: { sizeUsd: true },
    }),
  ]);

  const openExposureUsd = Number(openExposure._sum.sizeUsd ?? 0);
  const exposureHeadroomUsd = Math.max(0, MAX_TOTAL_EXPOSURE_USD - openExposureUsd);
  const roomForNewPositionsUsd = onchainCollateral?.ok ? Math.min(exposureHeadroomUsd, onchainCollateral.value) : exposureHeadroomUsd;

  const discrepancyUsd =
    onchainCollateral?.ok && circleCollateral?.ok ? computeDiscrepancyUsd(onchainCollateral.value, circleCollateral.amount) : null;

  return {
    configured: isCircleWalletConfigured,
    address,
    onchainCollateral,
    onchainNative,
    circleCollateral,
    discrepancyUsd,
    openExposureUsd,
    openPositionCount: openCount,
    portfolioLimitUsd: MAX_TOTAL_EXPOSURE_USD,
    roomForNewPositionsUsd,
    fetchedAtMs: Date.now(),
  };
}

/**
 * 30s TTL: every Capital Circle server action ends in a full-page redirect, so without a cache
 * every one of those costs a fresh RPC round trip and a fresh (rate-limited) Circle API call just
 * to re-render caps that didn't touch the balance. 30s is short enough that a real deposit shows
 * up within one natural page refresh, and the explicit refreshWalletOnchainData action below
 * covers impatience. revalidatePath alone does NOT bust this — a tag is required, which is why
 * binance-actions.ts / circle-withdraw-actions.ts / sweep-actions.ts each also call
 * revalidateTag(WALLET_ONCHAIN_TAG) alongside their existing revalidatePath.
 */
export const getWalletBalanceSnapshot = unstable_cache(loadWalletBalanceSnapshot, ["capital-circle-wallet-balance-snapshot"], {
  revalidate: 30,
  tags: [WALLET_ONCHAIN_TAG],
});
