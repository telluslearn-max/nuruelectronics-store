import { describe, expect, it } from "vitest";
import { displayEmail, hasRealEmail, isSyntheticEmail, syntheticCustomerEmail } from "./customer-email";

describe("syntheticCustomerEmail", () => {
  it("slugifies the seed into a placeholder under the reserved-invalid domain", () => {
    expect(syntheticCustomerEmail("+254 712 345 678")).toBe("254-712-345-678@no-email.invalid");
  });

  it("is deterministic for the same seed", () => {
    expect(syntheticCustomerEmail("Jane Doe")).toBe(syntheticCustomerEmail("Jane Doe"));
  });

  it("falls back to a generic slug when the seed has no alphanumeric characters", () => {
    expect(syntheticCustomerEmail("!!!")).toBe("customer@no-email.invalid");
  });
});

describe("isSyntheticEmail / hasRealEmail", () => {
  it("recognizes a synthesized address as synthetic", () => {
    const email = syntheticCustomerEmail("Jane Doe");
    expect(isSyntheticEmail(email)).toBe(true);
    expect(hasRealEmail(email)).toBe(false);
  });

  it("treats a real address as real", () => {
    expect(isSyntheticEmail("jane@example.com")).toBe(false);
    expect(hasRealEmail("jane@example.com")).toBe(true);
  });

  it("treats null/empty as not real", () => {
    expect(hasRealEmail(null)).toBe(false);
    expect(hasRealEmail(undefined)).toBe(false);
    expect(hasRealEmail("")).toBe(false);
  });

  it("is case-insensitive on the domain", () => {
    expect(isSyntheticEmail("jane@NO-EMAIL.INVALID")).toBe(true);
  });
});

describe("displayEmail", () => {
  it("returns the real email unchanged", () => {
    expect(displayEmail("jane@example.com")).toBe("jane@example.com");
  });

  it("hides a synthetic email", () => {
    expect(displayEmail(syntheticCustomerEmail("Jane Doe"))).toBeNull();
  });

  it("returns null for null/empty", () => {
    expect(displayEmail(null)).toBeNull();
    expect(displayEmail("")).toBeNull();
  });
});
