# WebMCP layer

NURU exposes its product-intelligence and commerce capabilities to in-browser
AI agents (ChatGPT's browser, Chrome's WebMCP) via `navigator.modelContext`.
Built for [The WebMCP Challenge](https://webmcp.devpost.com/).

## How it's wired

| Piece | File |
|---|---|
| Tool definitions (name, schema, `fetch` handler) | `src/lib/webmcp/tool-defs.ts` |
| Binding to the WebMCP API (defensive across host variants) | `src/lib/webmcp/register.ts` |
| Mount point (storefront layout, every page) | `src/components/webmcp/webmcp-registrar.tsx` |

Every tool is a thin call onto the internal `/api/*` service layer — **no
business logic is duplicated** in the WebMCP layer (build brief §33). The same
endpoints back the storefront UI and the AI concierge.

## Tools

| Tool | Endpoint | Notes |
|---|---|---|
| `search_products` | `GET /api/products/search` | natural query or structured filters |
| `get_product` | `GET /api/products/:handle` | merged Shopify + intelligence view |
| `get_product_specs` | `GET /api/products/:handle/specs` | normalized, confidence-rated |
| `compare_products` | `GET /api/products/compare` | winners per attribute & component |
| `get_price` / `check_stock` | `GET /api/products/:handle` | projected fields |
| `get_warranty` | `GET /api/products/:handle/specs` | storewide policy + model term |
| `calculate_fit_score` | `GET /api/products/score` | personalized 0-100 |
| `explain_recommendation` | `GET /api/products/:handle/explain` | structured reasoning |
| `recommend_products` | `POST /api/products/recommend` | ranked, in-stock, with reasoning |
| `find_alternatives` | `POST /api/products/alternatives` | ≥90%-capability, in-stock |
| `add_to_cart` | `POST /api/cart/add` | cookie cart; nothing charged |
| `create_order` | `POST /api/cart/checkout` | assembles cart, returns checkout URL — the shopper completes it |
| `get_order_status` | `POST /api/orders/status` | number + email must match; rate-limited |

## Safety

- Read tools are unrestricted. The two cart tools only ever **assemble** the
  cart and return a checkout URL — a tool call never charges anyone.
- `get_order_status` uses the same identity check (order number + email) and
  the same per-IP rate limit as the AI concierge's existing lookup.
- No supplier costs, internal margins, admin functions, secrets, or other
  customers' data are reachable through any tool.

## Testing

- ChatGPT's in-app browser (WebMCP out of the box), or Chrome 149+ with WebMCP
  enabled, on any storefront page.
- Without a WebMCP host, the tools are also on `window.nuruWebMcp`:
  `await window.nuruWebMcp.call("search_products", { query: "best camera phone under 60k" })`.
