# WebMCP Challenge — submission draft

Paste-ready copy for the Devpost form. Trim to fit the field limits.

---

## Project name

**NURU — an agent-native electronics store**

## Elevator pitch (≈200 chars)

NURU is a real Kenyan electronics store whose entire product-intelligence and
commerce engine is exposed to in-browser agents via WebMCP — an agent can
research, compare on real scores, personalise to a shopper's words, and build a
cart, all on the live site.

## Inspiration

Buying a phone online is still a dozen open tabs and a spec sheet you don't
trust. Comparison sites have the data but not the store; the store has the
checkout but not the intelligence. We wanted the shopper's own AI assistant to
do the whole job — on the real store, with real inventory and prices — instead
of scraping screenshots or guessing from a product title.

## What it does

NURU exposes 14 WebMCP tools on every storefront page (`document.modelContext`):

- **Discovery** — `search_products` (natural query or filters), `get_product`,
  `get_product_specs` (normalised, confidence-rated), `get_price`, `check_stock`,
  `get_warranty`
- **Intelligence** — `compare_products` (per-attribute and per-component winners
  for 2–4 phones, plus "the fork": what each one wins outright),
  `calculate_fit_score` (a 0–100 score personalised to the shopper's priorities),
  `explain_recommendation` (which weighted components are strengths/weaknesses),
  `recommend_products`, `find_alternatives` (≥90 %-of-capability, in stock)
- **Commerce** — `add_to_cart`, `create_order` (assembles the cart and returns a
  checkout URL — never charges), `get_order_status`

Every score is a **deterministic formula over normalised specs** — a fixed
0–100 band per numeric attribute, a hand-authored chipset performance index,
category weights. The model chooses the *weights* from the shopper's words
("camera and battery matter most"); it never invents a product fact or a score.
Missing data lowers a product's coverage, never its score.

An agent conversation becomes: *"compare the iPhone 17 Pro and the 14 for
someone who shoots a lot of video and travels"* → real component deltas, a
personalised Fit Score, the one reason to pick the cheaper phone, and a checkout
URL — without leaving the page.

## Why WebMCP is the right fit

- **Same engine, three surfaces.** The storefront UI, the site's Gemini
  concierge, and the WebMCP tools all call one internal `/api/products/*`
  service layer. No logic is reimplemented for agents and nothing drifts.
- **The store stays in control.** Prices, stock, warranty terms and scoring
  come from NURU's own data on every call. The agent can't hallucinate a price
  or a spec — it gets the same numbers a human sees.
- **No keys, no scraping, no partner onboarding.** Any WebMCP-capable browser
  gets the full capability set just by loading the page. The two commerce tools
  only ever *assemble* a cart and hand back a URL the shopper completes, so
  there's no "agent spent my money" risk.
- **Reads are free, writes are fenced.** Read tools are unrestricted;
  `get_order_status` reuses the site's existing identity check (order # + email)
  and per-IP rate limit.

## What people and agents can do together that wasn't possible before

A shopper can hand their assistant a vague, human sentence and get back a
*defensible* recommendation — winner-by-component, a personalised score, and an
explicit "choose the other one if X matters most" — grounded in the actual
catalogue, then act on it in the same breath. Previously that meant a comparison
site for the analysis, the retailer's site for the purchase, and the shopper
manually carrying the decision between them.

## How we built it

- **Next.js 16 / React 19 / TypeScript**, Prisma + Neon Postgres, deployed on
  Vercel. Live at <https://www.nuruelectronics.com>.
- **Product intelligence** — new Prisma models (`ProductProfile`, `SpecValue`,
  `NuruScore`), a normalisation engine (`"120 Hz"` / `"up to 120Hz"` → `120`),
  a Gemini grounded-search ingest pass with self-consistency reconciliation
  (a fact is kept only if two runs agree), source-derived confidence
  (verified / high / low), and a nightly reconcile cron.
- **Scoring** — pure functions, ~200 unit tests, no network or model in the
  loop. `computeNuruScore`, `computeFitScore`, `buildComparison`.
- **WebMCP layer** — `src/lib/webmcp/tool-defs.ts` (14 tool definitions, each a
  thin `fetch` onto `/api/*`), `src/lib/webmcp/register.ts` (binds them to
  `document.modelContext`, with `navigator.modelContext` and bulk-registration
  fallbacks, and a `window.nuruWebMcp` shim for hosts/tests without WebMCP).
- **Storefront `/compare`** rebuilt as the visual twin of the agent experience:
  the ruling, "the fork", a component radar, differences-only toggle, and a
  "tune for your priorities" box that runs the same Fit Score client-side.

## Challenges

- WebMCP's surface moved during the build (`navigator.modelContext` →
  `document.modelContext`); we target the settled spec and keep fallbacks.
- Keeping the model away from the math: the hard rule became "the model
  proposes weights, deterministic code disposes the score."
- Spec data with no manual data-entry: Gemini grounded search + a curated
  verified seed for the current iPhone line.

## What's next

- More categories (laptops, audio) on the same schema.
- More brands as the nightly ingest fills in profiles.
- A declarative-API pass for the form-shaped flows (checkout).

## Try it

1. Open <https://www.nuruelectronics.com> in ChatGPT's browser, or Chrome 149+
   with `chrome://flags/#enable-webmcp-testing` = Enabled.
2. In DevTools: `await document.modelContext.getTools()` lists the 14 tools.
3. Or without a WebMCP host:
   `await window.nuruWebMcp.call("compare_products", { handles: ["apple-iphone-17-pro","apple-iphone-14"] })`
4. Ask an agent: *"Compare the iPhone 17 Pro and iPhone 14 for someone who
   shoots a lot of video, then add the better one to my cart."*
