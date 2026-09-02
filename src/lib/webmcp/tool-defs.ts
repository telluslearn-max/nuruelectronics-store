/**
 * NURU's WebMCP tool set — the same product-intelligence and commerce
 * capabilities the site's own UI and the AI concierge use, exposed to an
 * in-browser agent (ChatGPT's browser, Chrome's WebMCP) via
 * `navigator.modelContext`.
 *
 * Every tool is a thin call onto the internal `/api/*` service layer — no
 * business logic is duplicated here (build brief §33). Read tools are
 * unrestricted; the two that touch the cart only ever *assemble* it and hand
 * back a checkout URL for the shopper to complete — nothing is charged from a
 * tool call. This file is framework-agnostic; `register.ts` binds it to the
 * WebMCP API.
 */

export type WebMcpToolDef = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  /** Runs the tool. `args` is the validated argument object. Returns a JSON-serialisable result. */
  run: (args: Record<string, unknown>) => Promise<unknown>;
};

const PRIORITIES_SCHEMA = {
  type: "object",
  description:
    "The shopper's priorities as relative weights (0-10) across performance, camera, battery, display, build, features, software, value.",
  properties: {
    performance: { type: "number" },
    camera: { type: "number" },
    battery: { type: "number" },
    display: { type: "number" },
    build: { type: "number" },
    features: { type: "number" },
    software: { type: "number" },
    value: { type: "number" },
  },
} as const;

async function getJson(path: string): Promise<unknown> {
  const res = await fetch(path, { headers: { accept: "application/json" }, credentials: "same-origin" });
  return res.json();
}

async function postJson(path: string, body: unknown): Promise<unknown> {
  const res = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  return res.json();
}

function prioritiesParam(args: Record<string, unknown>): string {
  const p = args.priorities;
  if (p && typeof p === "object" && !Array.isArray(p)) {
    return Object.entries(p as Record<string, unknown>)
      .filter(([, v]) => typeof v === "number" && (v as number) > 0)
      .map(([k, v]) => `${k}:${v}`)
      .join(",");
  }
  return "";
}

function str(args: Record<string, unknown>, key: string): string {
  return typeof args[key] === "string" ? (args[key] as string) : "";
}

function num(args: Record<string, unknown>, key: string): number | undefined {
  return typeof args[key] === "number" ? (args[key] as number) : undefined;
}

export const webMcpToolDefs: WebMcpToolDef[] = [
  {
    name: "search_products",
    description:
      "Search NURU's catalog. Accepts a natural query ('best gaming phone under 40k') or explicit filters; returns products with price, stock, and NURU Score.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        category: { type: "string", description: "e.g. 'smartphone'" },
        budgetMin: { type: "number" },
        budgetMax: { type: "number" },
        brand: { type: "string" },
        limit: { type: "number" },
      },
    },
    run: (args) => {
      const qs = new URLSearchParams();
      if (str(args, "query")) qs.set("q", str(args, "query"));
      if (str(args, "category")) qs.set("category", str(args, "category"));
      if (num(args, "budgetMin") !== undefined) qs.set("budgetMin", String(num(args, "budgetMin")));
      if (num(args, "budgetMax") !== undefined) qs.set("budgetMax", String(num(args, "budgetMax")));
      if (str(args, "brand")) qs.set("brand", str(args, "brand"));
      if (num(args, "limit") !== undefined) qs.set("limit", String(num(args, "limit")));
      return getJson(`/api/products/search?${qs.toString()}`);
    },
  },
  {
    name: "get_product",
    description: "Full details for one product by its handle: price, stock, image, normalized specs, and NURU Score.",
    inputSchema: { type: "object", properties: { handle: { type: "string" } }, required: ["handle"] },
    run: (args) => getJson(`/api/products/${encodeURIComponent(str(args, "handle"))}`),
  },
  {
    name: "get_product_specs",
    description: "NURU's normalized, confidence-rated specification sheet for one product, plus its data completeness.",
    inputSchema: { type: "object", properties: { handle: { type: "string" } }, required: ["handle"] },
    run: (args) => getJson(`/api/products/${encodeURIComponent(str(args, "handle"))}/specs`),
  },
  {
    name: "compare_products",
    description:
      "Side-by-side comparison of 2-4 products (same category) by handle: per-attribute and per-component winners, plus a summary of who leads what.",
    inputSchema: {
      type: "object",
      properties: { handles: { type: "array", items: { type: "string" } } },
      required: ["handles"],
    },
    run: (args) => {
      const handles = Array.isArray(args.handles) ? args.handles.filter((h) => typeof h === "string") : [];
      return getJson(`/api/products/compare?handles=${handles.map(encodeURIComponent).join(",")}`);
    },
  },
  {
    name: "get_price",
    description: "The current NURU selling price for one product by handle.",
    inputSchema: { type: "object", properties: { handle: { type: "string" } }, required: ["handle"] },
    run: async (args) => {
      const view = (await getJson(`/api/products/${encodeURIComponent(str(args, "handle"))}`)) as {
        handle?: string;
        price?: unknown;
        error?: string;
      };
      return view.error ? view : { handle: view.handle, price: view.price };
    },
  },
  {
    name: "check_stock",
    description: "Whether one product is currently in stock at NURU, by handle.",
    inputSchema: { type: "object", properties: { handle: { type: "string" } }, required: ["handle"] },
    run: async (args) => {
      const view = (await getJson(`/api/products/${encodeURIComponent(str(args, "handle"))}`)) as {
        handle?: string;
        availableForSale?: boolean;
        error?: string;
      };
      return view.error ? view : { handle: view.handle, inStock: Boolean(view.availableForSale) };
    },
  },
  {
    name: "get_warranty",
    description:
      "Warranty cover for one product: NURU sells only genuine stock with the manufacturer's warranty (Ex-UK units carry a 1-year NURU warranty). Returns any model-specific warranty term NURU has on file.",
    inputSchema: { type: "object", properties: { handle: { type: "string" } }, required: ["handle"] },
    run: async (args) => {
      const specs = (await getJson(`/api/products/${encodeURIComponent(str(args, "handle"))}/specs`)) as {
        specs?: { key: string; value: string }[];
        error?: string;
      };
      const warranty = specs.specs?.find((s) => s.key === "warranty_months");
      return {
        policy:
          "All NURU products are genuine and carry the manufacturer's warranty. Ex-UK (imported, unboxed) units carry a 1-year NURU warranty.",
        modelSpecific: warranty ? `${warranty.value} months` : null,
        ...(specs.error ? { note: specs.error } : {}),
      };
    },
  },
  {
    name: "calculate_fit_score",
    description:
      "One product's personalized Fit Score (0-100) for a shopper's priorities, plus its NURU Score components.",
    inputSchema: {
      type: "object",
      properties: { handle: { type: "string" }, priorities: PRIORITIES_SCHEMA },
      required: ["handle", "priorities"],
    },
    run: (args) =>
      getJson(
        `/api/products/score?handle=${encodeURIComponent(str(args, "handle"))}&priorities=${encodeURIComponent(prioritiesParam(args))}`,
      ),
  },
  {
    name: "explain_recommendation",
    description:
      "Structured reasoning for one product against a shopper's priorities: which weighted components are strengths, which are weaknesses, and which drove the Fit Score.",
    inputSchema: {
      type: "object",
      properties: { handle: { type: "string" }, priorities: PRIORITIES_SCHEMA },
      required: ["handle", "priorities"],
    },
    run: (args) =>
      getJson(
        `/api/products/${encodeURIComponent(str(args, "handle"))}/explain?priorities=${encodeURIComponent(prioritiesParam(args))}`,
      ),
  },
  {
    name: "recommend_products",
    description:
      "Up to 3 ranked, in-stock products for a shopper's priorities (and optional budget/brand), each with a Fit Score and structured reasoning. Smartphones only today.",
    inputSchema: {
      type: "object",
      properties: {
        categoryId: { type: "string", description: "e.g. 'smartphone'" },
        priorities: PRIORITIES_SCHEMA,
        budgetMin: { type: "number" },
        budgetMax: { type: "number" },
        brand: { type: "string" },
      },
      required: ["categoryId", "priorities"],
    },
    run: (args) => {
      const p = args.priorities && typeof args.priorities === "object" ? args.priorities : {};
      return postJson("/api/products/recommend", {
        categoryId: str(args, "categoryId"),
        weights: p,
        budgetMin: num(args, "budgetMin"),
        budgetMax: num(args, "budgetMax"),
        brand: str(args, "brand") || undefined,
      });
    },
  },
  {
    name: "find_alternatives",
    description:
      "Up to 3 in-stock products that retain most of a target product's capability for a shopper — for when the target is out of stock or over budget.",
    inputSchema: {
      type: "object",
      properties: { handle: { type: "string" }, priorities: PRIORITIES_SCHEMA },
      required: ["handle"],
    },
    run: (args) => {
      const p = args.priorities && typeof args.priorities === "object" ? args.priorities : {};
      return postJson("/api/products/alternatives", { handle: str(args, "handle"), weights: p });
    },
  },
  {
    name: "add_to_cart",
    description:
      "Add one product variant to the shopper's cart. Use a variant id from a get_product result. Does not charge anything.",
    inputSchema: {
      type: "object",
      properties: { variantId: { type: "string" }, quantity: { type: "number" } },
      required: ["variantId"],
    },
    run: (args) => postJson("/api/cart/add", { variantId: str(args, "variantId"), quantity: num(args, "quantity") ?? 1 }),
  },
  {
    name: "create_order",
    description:
      "Assemble the cart (optionally adding the given items) and return a checkout URL for the shopper to complete themselves. Never charges — the shopper finishes checkout.",
    inputSchema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: { variantId: { type: "string" }, quantity: { type: "number" } },
            required: ["variantId"],
          },
        },
      },
    },
    run: (args) => postJson("/api/cart/checkout", { items: Array.isArray(args.items) ? args.items : [] }),
  },
  {
    name: "get_order_status",
    description:
      "Look up an order's status by its number and the email it was placed with (both must match). Read-only.",
    inputSchema: {
      type: "object",
      properties: { orderNumber: { type: "string" }, email: { type: "string" } },
      required: ["orderNumber", "email"],
    },
    run: (args) => postJson("/api/orders/status", { orderNumber: str(args, "orderNumber"), email: str(args, "email") }),
  },
];
