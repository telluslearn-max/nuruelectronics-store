# NURU Electronics — Platform

A production e-commerce platform for [NURU Electronics](https://www.nuruelectronics.com), a Kenyan electronics retailer, built on Next.js 16 + Shopify. It's one codebase with four distinct products living inside it:

1. **Storefront** — the Shopify-backed shop itself (catalog, cart, checkout handoff, BNPL financing, customer accounts).
2. **AI Concierge** — a Gemini tool-calling shopping assistant with real authority: it can look up orders, search the catalog semantically, and autonomously approve/deny returns and refunds under a fixed policy.
3. **Admin ERP** — a full lightweight back office for running the business: orders, invoices, receipts, expenses, payroll, petty cash, a real double-entry ledger, and P&L/balance sheet/trial balance reports (with a Google Sheets sync for external reporting).
4. **Capital Circle** — an autonomous trading agent that researches Polymarket prediction markets with Gemini, sizes positions under hard-coded risk caps, and (once explicitly enabled) executes real trades from a Circle USDC wallet — with every money-movement step either capped in code or requiring a human to confirm it.

Built for the **Build with Gemini XPRIZE**.

## Why this shape

This isn't a demo storefront with an AI chatbot bolted on. It's a real small business's actual operating system: NURU's owner uses `/admin` daily to invoice customers, track expenses, and run payroll, and Capital Circle exists to autonomously grow a trading fund from a percentage of the store's real weekly profit. The AI concierge and Capital Circle share the same architecture — a bounded Gemini tool-calling loop with a fixed system prompt and an explicit dispatch table of allowed actions — applied to two very different domains (customer support vs. financial trading).

## Tech stack

- **Next.js 16** (App Router, Server Actions/Functions), **React 19**, **TypeScript**
- **Prisma 7** + **Postgres** (Neon) for the admin ERP's ledger, documents, and Capital Circle's positions/wallets
- **Shopify** Storefront API (catalog/cart) + Admin API (order sync, inventory)
- **Google Vertex AI (Gemini)** for the concierge, Capital Circle's research/reasoning, and semantic product search
- **Circle Developer-Controlled Wallets** (USDC) + **Polymarket CLOB** for Capital Circle's trading
- **Resend** (transactional email/PDF documents), **Google Sheets API** (P&L export), **Firestore** (signed-in shopper conversation memory)
- Deployed on **Vercel**, with Vercel Cron driving the P&L sync, weekly profit sweep, and Capital Circle's trading cycle

## Getting started

```bash
npm install
cp .env.local.example .env.local   # fill in what you need — see below
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Admin back office is at `/admin` (needs `ADMIN_USERNAME`/`ADMIN_PASSWORD`/`ADMIN_SESSION_SECRET`).

### Environment variables

`.env.local.example` is the source of truth — every variable is documented inline with what it does and what stays hidden/disabled until it's set. Nothing is required to run the app in a degraded-but-working state: unset a feature's credentials and that feature's UI hides itself rather than erroring (no Shopify tokens → catalog pages 404 gracefully; no Gemini credentials → concierge widget doesn't render; no Circle wallet → Capital Circle stays in simulation mode). Broad strokes:

| Area | Needs |
|---|---|
| Storefront + cart | `SHOPIFY_STORE_DOMAIN`, `SHOPIFY_STOREFRONT_ACCESS_TOKEN` |
| Admin ERP | `DATABASE_URL`, `ADMIN_USERNAME`/`ADMIN_PASSWORD`/`ADMIN_SESSION_SECRET`, `SHOPIFY_ADMIN_API_ACCESS_TOKEN` |
| AI Concierge | `GOOGLE_SERVICE_ACCOUNT_EMAIL`/`PRIVATE_KEY`, `GOOGLE_CLOUD_PROJECT`/`LOCATION` |
| Capital Circle (simulated) | same Vertex AI credentials as above — no separate setup, runs in simulation with no funds at risk |
| Capital Circle (live trading) | `CAPITAL_CIRCLE_LIVE=true` **and** `CIRCLE_API_KEY`/`CIRCLE_ENTITY_SECRET`/`CIRCLE_WALLET_ID`/`CIRCLE_WALLET_ADDRESS` — any one missing keeps every cycle in simulation |
| Emailed documents | `RESEND_API_KEY`, `DOCUMENT_EMAIL_FROM` |
| P&L → Google Sheets sync | reuses the Vertex AI service account, plus `PNL_SHEET_ID`/`PNL_SHEET_TAB` |

## Project structure

```
src/app/(storefront)/     Shop: catalog, cart, checkout, search, BNPL
src/app/admin/            Back office: orders, invoices, ledger, reports, payroll, Capital Circle dashboard
src/app/ex-uk/            "Ex-UK" — a swipeable, chat-per-product discovery mode for the same catalog
src/app/api/cron/         Vercel Cron targets (P&L sync, profit sweep, Capital Circle trading cycle)
src/app/api/webhooks/     Signed-webhook receivers (Circle wallet deposit notifications)
src/lib/shopify/          Storefront + Admin API clients
src/lib/concierge/        Gemini tool-calling loop, catalog/support tools, system prompt
src/lib/capital-circle/   Research, sizing/risk caps, execution, wallet client, weekly sweep
src/lib/reports/          P&L, trial balance, balance sheet, cash book computation
src/lib/ledger.ts         Double-entry journal posting shared by every money-touching action
prisma/                   Schema + migrations for the ERP and Capital Circle data models
scripts/                  One-off verification/setup scripts (Circle wallet provisioning, testnet checks)
```

## How the AI agents are kept safe

Both Gemini-driven agents in this codebase follow the same principle: **the model proposes, code disposes.**

- **Concierge returns/refunds**: `decideReturnCase()` applies a fixed, human-written policy (not an LLM judgment call) to decide eligibility; the model's job is to gather facts (order lookup, condition description) and call the decision tool, not invent the rule. Rate-limited per IP.
- **Capital Circle trading**: position sizing is capped in code — per-transaction, daily, weekly, and monthly USD limits (`sizePosition()`) — independent of whatever the model requests. Wallet withdrawals have a hard per-transaction cap and a fixed, non-caller-supplied destination address. The weekly profit sweep only ever *proposes* a number; converting and funding it is a manual step a human confirms. Circle's webhook notifications are ECDSA-signature-verified before being trusted, and even then only pre-fill a pending sweep — never move money on their own.
- **Everything logs**: every state-changing action — a trade, a refund, an expense, a payment — writes to an audit log and (where money is involved) a balanced double-entry ledger entry, so the books are always reconstructable.

## Admin ERP at a glance

`/admin` covers: orders (manual + synced from Shopify), estimates/invoices/receipts/delivery notes (PDF-generated, emailable), expenses, bills, payroll (employees + runs), petty cash, a real chart-of-accounts general ledger, and reports (P&L, income statement, balance sheet, trial balance, cash book, debtors/creditors, tax, fixed assets, sales, payroll, AI-attribution, riders' delivery impact). Every write path is gated behind a signed, HMAC session cookie checked independently on both the edge (`src/proxy.ts`) and every individual Server Action — so an admin page is never protected by routing alone.
