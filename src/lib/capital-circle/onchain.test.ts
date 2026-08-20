import { HttpRequestError, TimeoutError } from "viem";
import { describe, expect, it } from "vitest";
import { classifyError } from "./onchain";

/**
 * Only classifyError is tested here — readCollateralBalance/readNativeBalance/readCollateralAllowance
 * do real network I/O via a module-cached viem client, and this repo has no vi.mock precedent to
 * fake that with. What's actually worth locking down is the error taxonomy itself: "couldn't load"
 * isn't an actionable message, and this is the logic that turns a raw viem exception into one.
 */
describe("classifyError", () => {
  it("classifies a viem TimeoutError as timeout", () => {
    const result = classifyError(new TimeoutError({ body: {}, url: "https://example.com" }));
    expect(result.code).toBe("timeout");
  });

  it("classifies an HTTP 429 as rate-limited", () => {
    const result = classifyError(new HttpRequestError({ status: 429, url: "https://example.com" }));
    expect(result.code).toBe("rate-limited");
    expect(result.message).toMatch(/POLYGON_RPC_URL/);
  });

  it("classifies a non-429 HTTP error as bad-response, naming the status", () => {
    const result = classifyError(new HttpRequestError({ status: 503, url: "https://example.com" }));
    expect(result.code).toBe("bad-response");
    expect(result.message).toContain("503");
  });

  it("falls back to unknown for a plain Error, preserving its message", () => {
    const result = classifyError(new Error("something else broke"));
    expect(result.code).toBe("unknown");
    expect(result.message).toBe("something else broke");
  });

  it("falls back to unknown for a non-Error throw without crashing", () => {
    const result = classifyError("a bare string throw");
    expect(result.code).toBe("unknown");
    expect(result.message).toBe("a bare string throw");
  });
});
