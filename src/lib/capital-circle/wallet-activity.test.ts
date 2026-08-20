import { describe, expect, it } from "vitest";
import {
  auditLogToActivityRow,
  mergeWalletActivity,
  positionToActivityRow,
  sweepToActivityRow,
  type WalletActivityRow,
} from "./wallet-activity";

describe("positionToActivityRow", () => {
  it("maps a position to an outbound row keyed by its id", () => {
    const row = positionToActivityRow({
      id: "pos_1",
      question: "Will it rain tomorrow?",
      sizeUsd: 25,
      status: "executed",
      txHash: "0xabc",
      createdAt: new Date("2026-08-20T12:00:00Z"),
    });
    expect(row).toMatchObject({ key: "position:pos_1", source: "position", direction: "out", amountUsd: 25, status: "executed", txHash: "0xabc" });
    expect(row.atMs).toBe(new Date("2026-08-20T12:00:00Z").getTime());
  });

  it("truncates a long market question", () => {
    const longQuestion = "Q".repeat(200);
    const row = positionToActivityRow({ id: "pos_2", question: longQuestion, sizeUsd: 10, status: "simulated", txHash: null, createdAt: new Date() });
    expect(row.label.length).toBeLessThanOrEqual(80);
    expect(row.label.endsWith("...")).toBe(true);
  });

  it("leaves a short question untouched", () => {
    const row = positionToActivityRow({ id: "pos_3", question: "Short one", sizeUsd: 10, status: "simulated", txHash: null, createdAt: new Date() });
    expect(row.label).toBe("Short one");
  });
});

describe("sweepToActivityRow", () => {
  const base = { id: "sweep_1", weekStart: new Date("2026-08-17T00:00:00Z") };

  it("returns null for a bare proposal — neither detected nor confirmed", () => {
    const row = sweepToActivityRow({ ...base, confirmedUsdcAmount: null, confirmedAt: null, detectedUsdcAmount: null, detectedAt: null, detectedTxHash: null });
    expect(row).toBeNull();
  });

  it("prefers confirmed data over detected when both are present", () => {
    const row = sweepToActivityRow({
      ...base,
      confirmedUsdcAmount: 500,
      confirmedAt: new Date("2026-08-19T00:00:00Z"),
      detectedUsdcAmount: 480,
      detectedAt: new Date("2026-08-18T00:00:00Z"),
      detectedTxHash: "0xdef",
    });
    expect(row).toMatchObject({ amountUsd: 500, status: "confirmed", txHash: "0xdef" });
    expect(row!.atMs).toBe(new Date("2026-08-19T00:00:00Z").getTime());
  });

  it("falls back to detected-but-unconfirmed when nothing is confirmed yet", () => {
    const row = sweepToActivityRow({ ...base, confirmedUsdcAmount: null, confirmedAt: null, detectedUsdcAmount: 480, detectedAt: new Date("2026-08-18T00:00:00Z"), detectedTxHash: "0xdef" });
    expect(row).toMatchObject({ amountUsd: 480, status: "detected (unconfirmed)" });
  });

  it("always reports direction 'in' — a sweep is money entering the wallet", () => {
    const row = sweepToActivityRow({ ...base, confirmedUsdcAmount: 100, confirmedAt: new Date(), detectedUsdcAmount: null, detectedAt: null, detectedTxHash: null });
    expect(row!.direction).toBe("in");
  });
});

describe("auditLogToActivityRow", () => {
  it("maps a Binance deposit success entry to an inbound row", () => {
    const row = auditLogToActivityRow({ id: "log_1", action: "capital-circle.binance-deposit.success", createdAt: new Date("2026-08-20T00:00:00Z"), metadata: { amountUsdc: 10 } });
    expect(row).toMatchObject({ key: "audit:log_1", source: "binance-in", direction: "in", amountUsd: 10, label: "Deposit from Binance" });
  });

  it("maps a Circle wallet withdrawal success entry to an outbound row", () => {
    const row = auditLogToActivityRow({ id: "log_2", action: "capital-circle.wallet-withdraw.success", createdAt: new Date(), metadata: { amountUsdc: 5 } });
    expect(row).toMatchObject({ source: "binance-out", direction: "out", amountUsd: 5, label: "Withdrawal to Binance" });
  });

  it("returns null for an unrelated audit action — not every log entry is wallet activity", () => {
    const row = auditLogToActivityRow({ id: "log_3", action: "capital-circle.wallet.caps-update", createdAt: new Date(), metadata: {} });
    expect(row).toBeNull();
  });

  it("parses metadata defensively — a missing or malformed amountUsdc becomes null, not a crash", () => {
    expect(auditLogToActivityRow({ id: "log_4", action: "capital-circle.binance-deposit.success", createdAt: new Date(), metadata: null })?.amountUsd).toBeNull();
    expect(auditLogToActivityRow({ id: "log_5", action: "capital-circle.binance-deposit.success", createdAt: new Date(), metadata: { amountUsdc: "not-a-number" } })?.amountUsd).toBeNull();
  });
});

describe("mergeWalletActivity", () => {
  function row(key: string, atMs: number): WalletActivityRow {
    return { key, source: "position", direction: "out", atMs, amountUsd: 1, label: key, status: "ok", txHash: null };
  }

  it("orders heterogeneous sources newest-first regardless of input order", () => {
    const merged = mergeWalletActivity([row("a", 100), row("b", 300), row("c", 200)], 10);
    expect(merged.map((r) => r.key)).toEqual(["b", "c", "a"]);
  });

  it("drops nulls (a sweep with nothing detected/confirmed, an unrelated audit entry)", () => {
    const merged = mergeWalletActivity([row("a", 100), null, row("b", 200), null], 10);
    expect(merged.map((r) => r.key)).toEqual(["b", "a"]);
  });

  it("truncates to the limit, keeping the newest", () => {
    const merged = mergeWalletActivity([row("old", 100), row("newer", 200), row("newest", 300)], 2);
    expect(merged.map((r) => r.key)).toEqual(["newest", "newer"]);
  });
});
