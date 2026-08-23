import { describe, expect, it, vi } from "vitest";
import { parseAllowlist, parseCategoryCaps } from "./x402-pay";

describe("parseAllowlist — the config a malformed env var could silently get wrong", () => {
  it("parses a plain category:host entry", () => {
    expect(parseAllowlist("news:api.example.com")).toEqual([{ host: "api.example.com", category: "news", pinnedPayTo: null }]);
  });

  it("parses a category:host=address entry, lowercasing both host and address", () => {
    expect(parseAllowlist("News:API.Example.com=0xABC123")).toEqual([{ host: "api.example.com", category: "news", pinnedPayTo: "0xabc123" }]);
  });

  it("parses multiple comma-separated entries, mixing categories and pinned/unpinned hosts", () => {
    const result = parseAllowlist("news:a.example.com,sports-odds:b.example.com=0xabc,news:c.example.com");
    expect(result).toEqual([
      { host: "a.example.com", category: "news", pinnedPayTo: null },
      { host: "b.example.com", category: "sports-odds", pinnedPayTo: "0xabc" },
      { host: "c.example.com", category: "news", pinnedPayTo: null },
    ]);
  });

  it("drops an entry with no category prefix rather than guessing one", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(parseAllowlist("api.example.com")).toEqual([]);
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });

  it("drops an entry with an empty category before the colon", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(parseAllowlist(":api.example.com")).toEqual([]);
    spy.mockRestore();
  });

  it("ignores blank entries from stray commas or whitespace", () => {
    expect(parseAllowlist("news:a.example.com,, ,sports:b.example.com")).toHaveLength(2);
  });

  it("returns an empty list for an empty string — the fail-closed default", () => {
    expect(parseAllowlist("")).toEqual([]);
  });
});

describe("parseCategoryCaps", () => {
  it("parses a single category:amount entry", () => {
    expect(parseCategoryCaps("news:0.05")).toEqual(new Map([["news", 0.05]]));
  });

  it("parses multiple entries and lowercases the category", () => {
    expect(parseCategoryCaps("News:0.05,Sports-Odds:0.75")).toEqual(
      new Map([
        ["news", 0.05],
        ["sports-odds", 0.75],
      ]),
    );
  });

  it("drops a non-numeric amount rather than silently producing NaN", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(parseCategoryCaps("news:not-a-number")).toEqual(new Map());
    spy.mockRestore();
  });

  it("drops a zero or negative cap — a category cannot be capped at nothing", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(parseCategoryCaps("news:0")).toEqual(new Map());
    expect(parseCategoryCaps("news:-1")).toEqual(new Map());
    spy.mockRestore();
  });

  it("returns an empty map for an empty string", () => {
    expect(parseCategoryCaps("")).toEqual(new Map());
  });
});
