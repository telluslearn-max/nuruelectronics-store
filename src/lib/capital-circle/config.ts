import "server-only";

/**
 * Phase A / Phase B gate — see the project's "Two Circles" plan doc. Circle
 * wallet spending policies require a mainnet agent wallet (no testnet), and
 * the owner hasn't completed Circle's KYB yet, so this can only be "false"
 * today. When true, executor-tool.ts will still refuse to place a real order
 * unless isCircleWalletConfigured is also true — this flag alone never
 * bypasses that check.
 */
export const CAPITAL_CIRCLE_LIVE = process.env.CAPITAL_CIRCLE_LIVE === "true";

/**
 * Conservative default per-position cap used while no CapitalCircleWallet
 * row has real Circle-configured caps yet. Mirrors what Risk/Sizing would
 * set as the wallet's real per-tx limit via `circle wallet limit set` in
 * Phase B — kept here so sizing logic is real and testable before funding.
 */
export const DEFAULT_PER_POSITION_CAP_USD = Number(process.env.CAPITAL_CIRCLE_DEFAULT_CAP_USD ?? 25);

/** Pinned explicitly rather than an alias, so a model swap is a deliberate change. */
export const CAPITAL_CIRCLE_MODEL = "gemini-2.5-flash";

export const MAX_TOOL_ITERATIONS = 5;
