import { describe, expect, it } from "vitest";
import { webMcpToolDefs } from "./tool-defs";

describe("webMcpToolDefs", () => {
  it("exposes the full brief §23 tool set with unique names", () => {
    const names = webMcpToolDefs.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const expected of [
      "search_products",
      "get_product",
      "get_product_specs",
      "compare_products",
      "get_price",
      "check_stock",
      "get_warranty",
      "calculate_fit_score",
      "explain_recommendation",
      "recommend_products",
      "find_alternatives",
      "add_to_cart",
      "create_order",
      "get_order_status",
    ]) {
      expect(names).toContain(expected);
    }
  });

  it("every tool has a description and an object input schema", () => {
    for (const tool of webMcpToolDefs) {
      expect(tool.description.length).toBeGreaterThan(20);
      expect(tool.inputSchema.type).toBe("object");
      expect(typeof tool.run).toBe("function");
    }
  });

  it("only the two cart tools hit a cart endpoint; everything else is read-only", () => {
    const transactional = webMcpToolDefs
      .filter((t) => t.run.toString().includes("/api/cart/"))
      .map((t) => t.name)
      .sort();
    expect(transactional).toEqual(["add_to_cart", "create_order"]);
  });
});
