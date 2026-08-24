# Capital Circle Market Watcher

An always-on worker, separate from the Next.js app, that holds Polymarket's public
market WebSocket open and triggers `/api/cron/capital-circle-cycle` sooner than its
hourly schedule when a new market appears — verified live against the real endpoint
(`wss://ws-subscriptions-clob.polymarket.com/ws/market`, subscribing with an empty
asset list and `custom_feature_enabled: true` yields a global `new_market` feed, no
API key needed).

**What this does not do:** decide what to trade, size a position, or call Polymarket's
CLOB directly. It only calls the one HTTP endpoint that already does all of that —
screening, scoring, the edge gate, sizing, every existing circuit breaker. Widening how
often that pipeline runs changes latency, not what it's allowed to do.

Two trigger paths, so a WebSocket outage degrades to "still runs on a timer," not
"silently stops":
1. Every `POLL_INTERVAL_MS` (default 5 minutes), unconditionally.
2. On a `new_market` event, if `WS_TRIGGER_COOLDOWN_MS` (default 2 minutes) has passed
   since the last trigger. New markets have zero volume/liquidity at birth and will
   usually fail `candidate-filter.ts`'s own screening immediately — this is a real but
   modest latency win, not the primary mechanism.

## Run locally

```bash
cd services/market-watcher
npm install
CRON_URL="https://www.nuruelectronics.com/api/cron/capital-circle-cycle" \
CRON_SECRET="<the same value configured in Vercel>" \
npm start
```

Watch the logs — `[ws] connected`, then `[event]`-driven or periodic `[trigger]` lines.

## Deploy to Cloud Run

This needs **`--min-instances=1`** — Cloud Run's default scale-to-zero behavior would
kill the WebSocket connection between requests, since there are no inbound HTTP
requests to keep an instance alive. That means this is genuinely a small **ongoing**
cost, not the zero-cost "free tier" framing sometimes used for Cloud Run — a low-CPU,
low-memory instance idling on a single WebSocket connection is cheap, but it is not
$0. Check Cloud Run's current pricing for `min-instances` before deploying if that
matters to you.

```bash
cd services/market-watcher
gcloud run deploy capital-circle-market-watcher \
  --source . \
  --project nuruops \
  --region us-central1 \
  --no-allow-unauthenticated \
  --min-instances=1 \
  --max-instances=1 \
  --cpu=1 \
  --memory=256Mi \
  --set-env-vars="CRON_URL=https://www.nuruelectronics.com/api/cron/capital-circle-cycle" \
  --set-secrets="CRON_SECRET=capital-circle-cron-secret:latest"
```

Notes:
- `--no-allow-unauthenticated`: this service takes no inbound requests at all (it only
  makes outbound calls), so there is nothing to expose publicly.
- `--max-instances=1`: this worker holds one WebSocket connection and calls one
  endpoint — a second instance would just double-trigger, which the target route's own
  advisory lock already tolerates, but there's no reason to run two.
- `--set-secrets`: assumes you've stored `CRON_SECRET` in Secret Manager
  (`echo -n "<value>" | gcloud secrets create capital-circle-cron-secret --data-file=-`,
  matching the value already configured in Vercel — do not create a new one, it must
  be the *same* secret). Passing it via `--set-env-vars` instead works too but leaves
  it visible in `gcloud run services describe` output and deployment history.
- GCP Cloud Scheduler continues to hit the hourly endpoint independently of this
  worker — leave that job as-is; it's the reliable fallback if this worker is ever
  down.

## Configuration

| Env var | Required | Default | Purpose |
|---|---|---|---|
| `CRON_URL` | yes | — | The capital-circle-cycle endpoint to call. |
| `CRON_SECRET` | yes | — | Same bearer token the route already checks. |
| `POLL_INTERVAL_MS` | no | `300000` (5min) | Unconditional trigger interval — the reliable backbone. |
| `WS_TRIGGER_COOLDOWN_MS` | no | `120000` (2min) | Minimum gap between WS-triggered runs, so a burst of `new_market` events (measured live: 26 in 45s during a busy period) doesn't spam the pipeline. |
