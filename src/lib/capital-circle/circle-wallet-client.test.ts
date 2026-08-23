import { describe, expect, it } from "vitest";
import { toBaseUnits } from "./circle-wallet-client";

describe("toBaseUnits — the only thing standing between a decimal USDC amount and a raw uint256 sent to a contract", () => {
  it("converts a whole-dollar amount at 6 decimals", () => {
    expect(toBaseUnits(1)).toBe("1000000");
    expect(toBaseUnits(25)).toBe("25000000");
  });

  it("converts a cents-precision amount", () => {
    expect(toBaseUnits(12.34)).toBe("12340000");
  });

  it("rounds rather than truncates a floating-point rounding artifact", () => {
    // 0.1 + 0.2 style artifact one hop upstream — must not floor away a whole base unit.
    expect(toBaseUnits(12.345601)).toBe("12345601");
  });

  it("supports a non-default decimals count", () => {
    expect(toBaseUnits(1, 18)).toBe("1000000000000000000");
  });

  it("rejects non-finite or negative amounts rather than silently sending a huge/negative uint256", () => {
    expect(() => toBaseUnits(-1)).toThrow();
    expect(() => toBaseUnits(NaN)).toThrow();
    expect(() => toBaseUnits(Infinity)).toThrow();
  });

  it("zero is valid (a caller might legitimately approve/wrap nothing)", () => {
    expect(toBaseUnits(0)).toBe("0");
  });
});
