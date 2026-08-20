import { describe, expect, it } from "vitest";
import { evaluateReadiness, type ReadinessInput, type ReadinessItem } from "./readiness";

const ADDRESS = "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359";
const OTHER_ADDRESS = "0xF7CE4d4eF4c860F0F1B1d1B1E1A1B1C1D1e1f111";

function ok(value: number) {
  return { ok: true as const, value, blockNumber: 1 };
}
function failed(message = "RPC timed out") {
  return { ok: false as const, error: { code: "unknown" as const, message } };
}

function baseInput(overrides: Partial<ReadinessInput> = {}): ReadinessInput {
  return {
    wallet: { address: ADDRESS, perTxCapUsd: 25, dailyCapUsd: null, weeklyCapUsd: null, monthlyCapUsd: null },
    configuredWalletAddress: ADDRESS,
    isTestnet: false,
    collateralBalance: ok(100),
    nativeBalance: ok(1),
    allowance: ok(50),
    isLive: false,
    ...overrides,
  };
}

function itemFor(items: ReadinessItem[], id: string): ReadinessItem {
  const item = items.find((i) => i.id === id);
  if (!item) throw new Error(`no readiness item with id "${id}"`);
  return item;
}

describe("evaluateReadiness — all-pass collapses to ok/warn, never a false blocked", () => {
  it("a fully healthy wallet has no blocked items", () => {
    const items = evaluateReadiness(baseInput());
    expect(items.every((i) => i.state !== "blocked")).toBe(true);
    expect(itemFor(items, "wallet-registered").state).toBe("ok");
    expect(itemFor(items, "address-agrees").state).toBe("ok");
    expect(itemFor(items, "mainnet").state).toBe("ok");
    expect(itemFor(items, "collateral-balance").state).toBe("ok");
  });

  it("always returns exactly 8 items, one per check, regardless of input", () => {
    expect(evaluateReadiness(baseInput()).length).toBe(8);
    expect(evaluateReadiness(baseInput({ wallet: null })).length).toBe(8);
  });
});

describe("evaluateReadiness — no wallet registered", () => {
  it("blocks wallet-registered and every downstream on-chain check for the same reason", () => {
    const items = evaluateReadiness(baseInput({ wallet: null }));
    expect(itemFor(items, "wallet-registered").state).toBe("blocked");
    expect(itemFor(items, "collateral-balance").state).toBe("blocked");
    expect(itemFor(items, "gas-balance").state).toBe("blocked");
    expect(itemFor(items, "allowance").state).toBe("blocked");
    expect(itemFor(items, "caps-recorded").state).toBe("blocked");
  });

  it("still reports the live-flag check even with no wallet at all", () => {
    const items = evaluateReadiness(baseInput({ wallet: null }));
    expect(itemFor(items, "live-flag").state).toBe("ok");
  });
});

describe("evaluateReadiness — address-agrees is the highest-value check", () => {
  it("blocks on a genuine mismatch, naming both truncated addresses", () => {
    const items = evaluateReadiness(baseInput({ configuredWalletAddress: OTHER_ADDRESS }));
    const item = itemFor(items, "address-agrees");
    expect(item.state).toBe("blocked");
    expect(item.detail).toContain("0x3c49…3359");
    expect(item.detail).toContain("0xF7CE…f111");
  });

  it("is case-insensitive — same address in different casing agrees", () => {
    const items = evaluateReadiness(baseInput({ configuredWalletAddress: ADDRESS.toLowerCase() }));
    expect(itemFor(items, "address-agrees").state).toBe("ok");
  });

  it("warns (not blocks) when CIRCLE_WALLET_ADDRESS is simply unset — nothing to compare against", () => {
    const items = evaluateReadiness(baseInput({ configuredWalletAddress: null }));
    expect(itemFor(items, "address-agrees").state).toBe("warn");
  });
});

describe("evaluateReadiness — network", () => {
  it("blocks when configured for testnet", () => {
    const items = evaluateReadiness(baseInput({ isTestnet: true }));
    expect(itemFor(items, "mainnet").state).toBe("blocked");
  });
});

describe("evaluateReadiness — balances", () => {
  it("blocks on zero collateral", () => {
    const items = evaluateReadiness(baseInput({ collateralBalance: ok(0) }));
    expect(itemFor(items, "collateral-balance").state).toBe("blocked");
  });

  it("warns, never blocks, on low gas — the threshold is a guess", () => {
    const items = evaluateReadiness(baseInput({ nativeBalance: ok(0.001) }));
    expect(itemFor(items, "gas-balance").state).toBe("warn");
  });

  it("warns, never blocks, on low allowance — the threshold is a guess", () => {
    const items = evaluateReadiness(baseInput({ allowance: ok(0) }));
    expect(itemFor(items, "allowance").state).toBe("warn");
  });

  it("warns (not blocks) when a chain read failed outright — it says nothing about the real state", () => {
    const items = evaluateReadiness(baseInput({ collateralBalance: failed("RPC down") }));
    const item = itemFor(items, "collateral-balance");
    expect(item.state).toBe("warn");
    expect(item.detail).toContain("RPC down");
  });
});

describe("evaluateReadiness — caps", () => {
  it("warns when no cap is set at all", () => {
    const items = evaluateReadiness(baseInput({ wallet: { address: ADDRESS, perTxCapUsd: null, dailyCapUsd: null, weeklyCapUsd: null, monthlyCapUsd: null } }));
    expect(itemFor(items, "caps-recorded").state).toBe("warn");
  });

  it("is ok when at least one cap is set", () => {
    const items = evaluateReadiness(baseInput({ wallet: { address: ADDRESS, perTxCapUsd: null, dailyCapUsd: 50, weeklyCapUsd: null, monthlyCapUsd: null } }));
    expect(itemFor(items, "caps-recorded").state).toBe("ok");
  });
});

describe("evaluateReadiness — CAPITAL_CIRCLE_LIVE is informational, never blocked or warned", () => {
  it("reports ok whether live trading is on or off", () => {
    expect(itemFor(evaluateReadiness(baseInput({ isLive: true })), "live-flag").state).toBe("ok");
    expect(itemFor(evaluateReadiness(baseInput({ isLive: false })), "live-flag").state).toBe("ok");
  });
});
