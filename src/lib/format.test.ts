import { describe, expect, it } from "vitest";
import { formatEatDate, formatEatDateTime } from "./format";

describe("formatEatDateTime", () => {
  it("shifts a UTC time forward by EAT's fixed +3h offset", () => {
    // 10:00 UTC -> 13:00 EAT, same day
    expect(formatEatDateTime(new Date("2026-08-21T10:00:00Z"))).toBe("Aug 21, 2026, 1:00 PM EAT");
  });

  it("rolls the date forward across UTC midnight — this is the case a naive UTC display gets wrong", () => {
    // 22:00 UTC on the 20th -> 01:00 EAT on the 21st
    expect(formatEatDateTime(new Date("2026-08-20T22:00:00Z"))).toBe("Aug 21, 2026, 1:00 AM EAT");
  });
});

describe("formatEatDate", () => {
  it("uses EAT's date, not UTC's, near the day boundary", () => {
    // 22:00 UTC on the 20th is already the 21st in EAT
    expect(formatEatDate(new Date("2026-08-20T22:00:00Z"))).toBe("Aug 21, 2026");
  });
});
