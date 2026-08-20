import { getAddress, isAddress } from "viem";

/**
 * viem's default (strict: true) accepts an all-lowercase address — nothing to check a checksum
 * against — but rejects a mixed-case address whose casing doesn't match its own checksum, which
 * is exactly the "corrupted paste" case worth catching on a field that decides where money goes.
 */
export function normalizeAddress(raw: string): { ok: true; address: string } | { ok: false; reason: string } {
  const trimmed = raw.trim();
  if (!isAddress(trimmed)) {
    return { ok: false, reason: `"${trimmed}" isn't a valid address — check the length and, if it's mixed-case, the checksum.` };
  }
  return { ok: true, address: getAddress(trimmed) };
}

export function truncateAddress(address: string, lead = 6, tail = 4): string {
  if (address.length <= lead + tail + 1) return address;
  return `${address.slice(0, lead)}…${address.slice(-tail)}`;
}

export function addressesEqual(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return a === b;
  return a.toLowerCase() === b.toLowerCase();
}

export const DEFAULT_ALLOWED_CHAINS = ["polygon", "polygon-amoy"] as const;

export type IdentityChangeResult =
  | { ok: true; changed: boolean; next: { address: string; circleWalletId: string; chain: string } }
  | { ok: false; reason: string };

/**
 * Every guard that must hold before a wallet's identity (address / circleWalletId / chain) is
 * allowed to change. Pulled out of the server action as a pure function specifically because
 * server actions are untestable in this repo (Prisma + redirect() throughout) — this is where
 * the actual bug that started this work gets locked down.
 *
 * The bug this closes: the old combined form wrote `address` unconditionally from whatever the
 * browser submitted, so a blank field silently nulled a real address. Every path through here
 * that would touch address or circleWalletId either keeps the existing value or requires an
 * explicit, confirmed replacement — there is no path from "set" to "blank".
 */
export function evaluateIdentityChange(input: {
  current: { address: string | null; circleWalletId: string | null; chain: string; updatedAtMs: number };
  submitted: { address: string; circleWalletId: string; chain: string };
  confirmReplace: boolean;
  seenUpdatedAtMs: number;
  allowedChains?: readonly string[];
}): IdentityChangeResult {
  const allowedChains = input.allowedChains ?? DEFAULT_ALLOWED_CHAINS;

  const rawAddress = input.submitted.address.trim();
  if (!rawAddress) {
    return {
      ok: false,
      reason: input.current.address
        ? `Address can't be blank — the wallet currently has ${truncateAddress(input.current.address)}. Leave it as-is or enter a real replacement.`
        : "Address is required.",
    };
  }
  const normalized = normalizeAddress(rawAddress);
  if (!normalized.ok) return { ok: false, reason: normalized.reason };

  const circleWalletId = input.submitted.circleWalletId.trim();
  if (!circleWalletId) {
    return {
      ok: false,
      reason: input.current.circleWalletId
        ? `Circle wallet id can't be blank — it currently has ${input.current.circleWalletId}.`
        : "Circle wallet id is required.",
    };
  }

  const chain = input.submitted.chain.trim();
  if (!allowedChains.includes(chain)) {
    return { ok: false, reason: `Unrecognized chain "${chain}" — must be one of: ${allowedChains.join(", ")}.` };
  }

  const addressChanged = !addressesEqual(input.current.address, normalized.address);
  const circleWalletIdChanged = input.current.circleWalletId !== circleWalletId;
  const chainChanged = input.current.chain !== chain;
  const changed = addressChanged || circleWalletIdChanged || chainChanged;
  const next = { address: normalized.address, circleWalletId, chain };

  // Nothing to protect against when nothing's actually changing — a stale tab resubmitting the
  // same values it already saw shouldn't be blocked by a concurrency check meant for real races.
  if (!changed) return { ok: true, changed: false, next };

  // Confirmation guards *replacing* a real value, not setting one for the first time — a wallet
  // row can legitimately have no identity yet (freshly created, or recovering from the exact
  // null-address bug this module exists to prevent), and requiring a "confirm you meant it"
  // checkbox to fill in a blank field protects nothing.
  const hadExistingIdentity = input.current.address !== null || input.current.circleWalletId !== null;
  if (hadExistingIdentity && !input.confirmReplace) {
    return {
      ok: false,
      reason:
        `This changes the wallet's identity — from ${input.current.address ? truncateAddress(input.current.address) : "unset"} / ` +
        `${input.current.circleWalletId ?? "unset"} to ${truncateAddress(normalized.address)} / ${circleWalletId}. ` +
        `Check "confirm" to proceed.`,
    };
  }

  if (input.seenUpdatedAtMs !== input.current.updatedAtMs) {
    return { ok: false, reason: "This wallet was changed elsewhere since this form loaded — reload and try again." };
  }

  return { ok: true, changed: true, next };
}
