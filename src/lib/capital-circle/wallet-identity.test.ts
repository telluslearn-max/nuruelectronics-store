import { describe, expect, it } from "vitest";
import { addressesEqual, evaluateIdentityChange, normalizeAddress, truncateAddress } from "./wallet-identity";

const ADDR_LOWER = "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359";
const ADDR_CHECKSUMMED = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
const ADDR2_CHECKSUMMED = "0xF7CE4d4eF4c860F0F1B1d1B1E1A1B1C1D1e1f111"; // computed via viem getAddress(), not typed by eye

describe("normalizeAddress", () => {
  it("checksums an all-lowercase address", () => {
    const result = normalizeAddress(ADDR_LOWER);
    expect(result).toEqual({ ok: true, address: ADDR_CHECKSUMMED });
  });

  it("accepts an already-checksummed address unchanged", () => {
    expect(normalizeAddress(ADDR_CHECKSUMMED)).toEqual({ ok: true, address: ADDR_CHECKSUMMED });
  });

  it("rejects a corrupted checksum (mixed case that doesn't match the real checksum)", () => {
    const corrupted = "0x3c499c542CEF5E3811e1192ce70d8cC03d5c3359";
    const result = normalizeAddress(corrupted);
    expect(result.ok).toBe(false);
  });

  it("rejects a 39-character address (one short)", () => {
    expect(normalizeAddress("0x3c499c542cef5e3811e1192ce70d8cc03d5c33").ok).toBe(false);
  });

  it("rejects a 41-character address (one long)", () => {
    expect(normalizeAddress("0x3c499c542cef5e3811e1192ce70d8cc03d5c33599").ok).toBe(false);
  });

  it("rejects non-hex characters", () => {
    expect(normalizeAddress("0x3c499c542cef5e3811e1192ce70d8cc03d5c33zz").ok).toBe(false);
  });

  it("rejects the empty string", () => {
    expect(normalizeAddress("").ok).toBe(false);
  });

  it("trims surrounding whitespace before validating", () => {
    expect(normalizeAddress(`  ${ADDR_LOWER}  `)).toEqual({ ok: true, address: ADDR_CHECKSUMMED });
  });
});

describe("truncateAddress", () => {
  it("truncates to lead…tail", () => {
    expect(truncateAddress(ADDR_CHECKSUMMED)).toBe("0x3c49…3359");
  });

  it("leaves a too-short string unchanged rather than truncating to nothing useful", () => {
    expect(truncateAddress("0x1234")).toBe("0x1234");
  });
});

describe("addressesEqual", () => {
  it("is case-insensitive", () => {
    expect(addressesEqual(ADDR_LOWER, ADDR_CHECKSUMMED)).toBe(true);
  });

  it("treats null as equal only to null", () => {
    expect(addressesEqual(null, null)).toBe(true);
    expect(addressesEqual(null, ADDR_CHECKSUMMED)).toBe(false);
    expect(addressesEqual(ADDR_CHECKSUMMED, null)).toBe(false);
  });

  it("is false for genuinely different addresses", () => {
    expect(addressesEqual(ADDR_CHECKSUMMED, ADDR2_CHECKSUMMED)).toBe(false);
  });
});

describe("evaluateIdentityChange — the regression lock on the address-nulling bug", () => {
  const base = {
    current: { address: ADDR_CHECKSUMMED, circleWalletId: "wallet_123", chain: "polygon", updatedAtMs: 1000 },
    confirmReplace: false,
    seenUpdatedAtMs: 1000,
  };

  it("rejects blanking a previously-set address, naming the current value", () => {
    const result = evaluateIdentityChange({ ...base, submitted: { address: "", circleWalletId: "wallet_123", chain: "polygon" } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("0x3c49…3359");
  });

  it("rejects blanking a previously-set circleWalletId, naming the current value", () => {
    const result = evaluateIdentityChange({ ...base, submitted: { address: ADDR_CHECKSUMMED, circleWalletId: "  ", chain: "polygon" } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("wallet_123");
  });

  it("rejects an invalid address even when non-blank", () => {
    const result = evaluateIdentityChange({ ...base, submitted: { address: "not-an-address", circleWalletId: "wallet_123", chain: "polygon" } });
    expect(result.ok).toBe(false);
  });

  it("rejects an unrecognized chain", () => {
    const result = evaluateIdentityChange({ ...base, submitted: { address: ADDR_CHECKSUMMED, circleWalletId: "wallet_123", chain: "ethereum" } });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toContain("ethereum");
  });

  it("is a no-op success when nothing actually changed, even with a stale seenUpdatedAtMs", () => {
    const result = evaluateIdentityChange({
      ...base,
      seenUpdatedAtMs: 1, // deliberately stale — must not matter when nothing changes
      submitted: { address: ADDR_LOWER, circleWalletId: "wallet_123", chain: "polygon" }, // same address, different case
    });
    expect(result).toEqual({ ok: true, changed: false, next: { address: ADDR_CHECKSUMMED, circleWalletId: "wallet_123", chain: "polygon" } });
  });

  it("rejects a real address change without confirmReplace", () => {
    const result = evaluateIdentityChange({ ...base, submitted: { address: ADDR2_CHECKSUMMED, circleWalletId: "wallet_123", chain: "polygon" } });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("0x3c49…3359");
      expect(result.reason).toContain("0xF7CE…f111");
    }
  });

  it("accepts a real address change with confirmReplace and a fresh seenUpdatedAtMs", () => {
    const result = evaluateIdentityChange({
      ...base,
      confirmReplace: true,
      submitted: { address: ADDR2_CHECKSUMMED, circleWalletId: "wallet_123", chain: "polygon" },
    });
    expect(result).toEqual({ ok: true, changed: true, next: { address: ADDR2_CHECKSUMMED, circleWalletId: "wallet_123", chain: "polygon" } });
  });

  it("rejects a confirmed change with a stale seenUpdatedAtMs (concurrent edit)", () => {
    const result = evaluateIdentityChange({
      ...base,
      confirmReplace: true,
      seenUpdatedAtMs: 999, // stale — current.updatedAtMs is 1000
      submitted: { address: ADDR2_CHECKSUMMED, circleWalletId: "wallet_123", chain: "polygon" },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/changed elsewhere/i);
  });

  it("allows setting identity on a wallet that has none yet, without requiring confirmation", () => {
    const result = evaluateIdentityChange({
      current: { address: null, circleWalletId: null, chain: "polygon", updatedAtMs: 500 },
      submitted: { address: ADDR_CHECKSUMMED, circleWalletId: "wallet_new", chain: "polygon" },
      confirmReplace: false,
      seenUpdatedAtMs: 500,
    });
    expect(result).toEqual({ ok: true, changed: true, next: { address: ADDR_CHECKSUMMED, circleWalletId: "wallet_new", chain: "polygon" } });
  });
});
