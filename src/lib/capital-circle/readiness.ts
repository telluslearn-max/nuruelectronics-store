import { formatPrice } from "../format";
import { addressesEqual, truncateAddress } from "./wallet-identity";
import type { OnchainResult } from "./onchain";

export type ReadinessState = "ok" | "warn" | "blocked";
export type ReadinessItem = { id: string; label: string; state: ReadinessState; detail: string; remedy: string | null };

/**
 * Neither threshold below is derived from anything — no real order's gas cost has been observed,
 * and no real approved wallet has been checked against this codebase yet. Both checks that use
 * them report "warn", never "blocked", specifically because a guessed number should never gate a
 * checklist item the way a fact (zero balance, mismatched address) does. Revisit once real data
 * exists.
 */
const MIN_NATIVE_GAS_BALANCE = 0.05; // POL
const MIN_WORKING_ALLOWANCE = 1; // collateral-token units

export type ReadinessWalletInput = {
  address: string | null;
  perTxCapUsd: number | null;
  dailyCapUsd: number | null;
  weeklyCapUsd: number | null;
  monthlyCapUsd: number | null;
};

export type ReadinessInput = {
  wallet: ReadinessWalletInput | null;
  /** From CIRCLE_WALLET_ADDRESS — the address Binance withdrawals and live trading actually use. */
  configuredWalletAddress: string | null;
  isTestnet: boolean;
  collateralBalance: OnchainResult<number> | null;
  nativeBalance: OnchainResult<number> | null;
  allowance: OnchainResult<number> | null;
  isLive: boolean;
};

/** Renders an OnchainResult into a checklist row, treating an unresolved read (RPC down, etc.) as
    "warn" rather than either extreme — it says nothing about the actual on-chain state. */
function balanceCheck(
  id: string,
  label: string,
  read: OnchainResult<number> | null,
  isBad: (value: number) => boolean,
  badState: "warn" | "blocked",
  formatOk: (value: number) => string,
  remedy: string,
): ReadinessItem {
  if (!read) return { id, label, state: "blocked", detail: "No wallet to check.", remedy: "Register a wallet first — see the check above." };
  if (!read.ok) return { id, label, state: "warn", detail: `Couldn't read from chain: ${read.error.message}`, remedy: "Retry, or check POLYGON_RPC_URL." };
  if (isBad(read.value)) return { id, label, state: badState, detail: formatOk(read.value), remedy };
  return { id, label, state: "ok", detail: formatOk(read.value), remedy: null };
}

/**
 * Pure — assembled from a Prisma wallet row, the balance-panel snapshot, and env facts by the
 * caller (wallet-section.tsx), so this stays independently testable with plain object literals.
 * The highest-value single row here is address-agrees: binance-client.ts withdraws to
 * CIRCLE_WALLET_ADDRESS while the deposit QR advertises wallet.address — diverge those and
 * deposits and trading point at different wallets with nothing else on this page saying so.
 */
export function evaluateReadiness(input: ReadinessInput): ReadinessItem[] {
  const address = input.wallet?.address ?? null;

  const walletRegistered: ReadinessItem = address
    ? { id: "wallet-registered", label: "Wallet registered", state: "ok", detail: `Registered at ${truncateAddress(address)}.`, remedy: null }
    : {
        id: "wallet-registered",
        label: "Wallet registered",
        state: "blocked",
        detail: "No wallet address on file.",
        remedy: 'Provision one with scripts/circle-wallet-setup.mjs, then use "Register a wallet" below.',
      };

  if (!address) {
    const naRemedy = "Register a wallet first — see the check above.";
    return [
      walletRegistered,
      { id: "address-agrees", label: "Address matches CIRCLE_WALLET_ADDRESS", state: "blocked", detail: "No address to compare.", remedy: naRemedy },
      {
        id: "mainnet",
        label: "Network is mainnet",
        state: input.isTestnet ? "blocked" : "ok",
        detail: input.isTestnet ? "Configured for Polygon Amoy (testnet)." : "Configured for Polygon mainnet.",
        remedy: input.isTestnet ? "Set CAPITAL_CIRCLE_WALLET_NETWORK to mainnet (or unset it) before trading real funds." : null,
      },
      { id: "collateral-balance", label: "Collateral balance", state: "blocked", detail: "No wallet to check.", remedy: naRemedy },
      { id: "gas-balance", label: "POL for gas", state: "blocked", detail: "No wallet to check.", remedy: naRemedy },
      { id: "allowance", label: "Polymarket exchange approval", state: "blocked", detail: "No wallet to check.", remedy: naRemedy },
      { id: "caps-recorded", label: "Spending caps recorded", state: "blocked", detail: "No wallet to check.", remedy: naRemedy },
      liveFlagItem(input.isLive),
    ];
  }

  const addressMatches = input.configuredWalletAddress ? addressesEqual(address, input.configuredWalletAddress) : null;
  const addressAgrees: ReadinessItem =
    addressMatches === null
      ? {
          id: "address-agrees",
          label: "Address matches CIRCLE_WALLET_ADDRESS",
          state: "warn",
          detail: "CIRCLE_WALLET_ADDRESS isn't set — can't cross-check.",
          remedy: "Set CIRCLE_WALLET_ADDRESS so the registered address and the one live trading/Binance actually use are verified to agree.",
        }
      : addressMatches
        ? { id: "address-agrees", label: "Address matches CIRCLE_WALLET_ADDRESS", state: "ok", detail: "Registered address matches CIRCLE_WALLET_ADDRESS.", remedy: null }
        : {
            id: "address-agrees",
            label: "Address matches CIRCLE_WALLET_ADDRESS",
            state: "blocked",
            detail: `Registered address (${truncateAddress(address)}) differs from CIRCLE_WALLET_ADDRESS (${truncateAddress(input.configuredWalletAddress!)}) — deposits and live trading point at different wallets.`,
            remedy: "Reconcile the two before relying on this wallet for anything real — this is the single highest-value check on this page.",
          };

  const mainnet: ReadinessItem = input.isTestnet
    ? {
        id: "mainnet",
        label: "Network is mainnet",
        state: "blocked",
        detail: "Configured for Polygon Amoy (testnet).",
        remedy: "Set CAPITAL_CIRCLE_WALLET_NETWORK to mainnet (or unset it) before trading real funds.",
      }
    : { id: "mainnet", label: "Network is mainnet", state: "ok", detail: "Configured for Polygon mainnet.", remedy: null };

  const collateralBalance = balanceCheck(
    "collateral-balance",
    "Collateral balance",
    input.collateralBalance,
    (value) => value <= 0,
    "blocked",
    (value) => `${formatPrice(String(value), "USD")} available.`,
    "Deposit collateral — see the deposit card below.",
  );

  const gasBalance = balanceCheck(
    "gas-balance",
    "POL for gas",
    input.nativeBalance,
    (value) => value < MIN_NATIVE_GAS_BALANCE,
    "warn",
    (value) => `${value.toFixed(4)} POL.`,
    `Below the ${MIN_NATIVE_GAS_BALANCE} POL floor used here (an unverified guess, not derived from real order gas costs) — send a small amount for gas.`,
  );

  const allowance = balanceCheck(
    "allowance",
    "Polymarket exchange approval",
    input.allowance,
    (value) => value < MIN_WORKING_ALLOWANCE,
    "warn",
    (value) => `${value.toFixed(2)} approved.`,
    "Approve the Polymarket exchange contract to spend the collateral token — required before a live order can settle. This threshold is a guess, flagged as such: treat as a nudge to verify, not a hard blocker.",
  );

  const hasCaps = Boolean(input.wallet!.perTxCapUsd || input.wallet!.dailyCapUsd || input.wallet!.weeklyCapUsd || input.wallet!.monthlyCapUsd);
  const capsRecorded: ReadinessItem = hasCaps
    ? { id: "caps-recorded", label: "Spending caps recorded", state: "ok", detail: "At least one cap is set on the wallet.", remedy: null }
    : {
        id: "caps-recorded",
        label: "Spending caps recorded",
        state: "warn",
        detail: "No caps recorded — sizing falls back to the code-level default.",
        remedy: "Record the real wallet-level caps in the form below so sizing agrees with the actual limit instead of a fallback.",
      };

  return [walletRegistered, addressAgrees, mainnet, collateralBalance, gasBalance, allowance, capsRecorded, liveFlagItem(input.isLive)];
}

/** Purely informational either way — running in simulation is the deliberate default, not a problem to fix. */
function liveFlagItem(isLive: boolean): ReadinessItem {
  return {
    id: "live-flag",
    label: "CAPITAL_CIRCLE_LIVE",
    state: "ok",
    detail: isLive ? "Enabled — trading with real funds." : "Disabled — every cycle runs in simulation.",
    remedy: null,
  };
}
