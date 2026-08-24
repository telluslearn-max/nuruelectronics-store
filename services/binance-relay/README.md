# Capital Circle Binance Relay

A transparent proxy to `api.binance.com`, deployed from a region Binance doesn't geo-block.

## Why this exists

Binance returns HTTP 451 (Unavailable For Legal Reasons) for API requests originating from a
"Restricted Location" — the US among them. This app's Vercel deployment runs in `iad1`
(Washington, D.C.) — Vercel Hobby plan only supports one project-wide function region, so there's
no way to move just the Binance-calling functions elsewhere without this relay (Pro plan supports
up to 5 regions and could avoid needing this at all — see the tradeoff discussion in the session
that built this).

The Binance account itself is not US-based; only the origin IP of the request is, which is what
this relay fixes.

## What this does not do

Signing is unchanged — `binance-client.ts` still computes the HMAC signature with
`BINANCE_API_SECRET` exactly as before. This relay never sees that secret, never signs anything,
and never stores a Binance credential of any kind. It only forwards an already-signed request
(method, path, query string, the `X-MBX-APIKEY` header) to `api.binance.com` and pipes the
response straight back. Losing this relay's own secret lets someone use it as a proxy for *their
own* signed requests — it cannot be used to forge a request against this app's Binance account.

Restricted to a hardcoded path allowlist (`/sapi/v1/capital/config/getall`,
`/sapi/v1/capital/withdraw/apply`) — exactly what `binance-client.ts` calls today. Not a
general-purpose Binance proxy.

## Run locally

```bash
cd services/binance-relay
RELAY_SECRET="some-test-value" PORT=8081 npm start
```

## Deploy to Cloud Run

Unlike the market watcher, this is request-driven, not a persistent background process — no
`--min-instances` needed, so it scales to zero and costs close to nothing when idle. Pick a region
Binance doesn't restrict; `europe-west1` (Belgium) is a reasonable default — closer to Kenya than
`us-central1`, and not one of Binance's listed Restricted Locations.

```bash
cd services/binance-relay
gcloud run deploy capital-circle-binance-relay \
  --source . \
  --project nuruops \
  --region europe-west1 \
  --allow-unauthenticated \
  --max-instances=3 \
  --cpu=1 \
  --memory=256Mi \
  --set-secrets="RELAY_SECRET=binance-relay-secret:latest"
```

Notes:
- `--allow-unauthenticated`: this service needs to accept calls from Vercel's own request path,
  which can't attach GCP IAM credentials — the `RELAY_SECRET` header is the actual gate, same
  role `CRON_SECRET` plays for the cron routes.
- `--set-secrets`: assumes you've stored `RELAY_SECRET` in Secret Manager
  (`echo -n "<a fresh random value, e.g. from openssl rand -hex 32>" | gcloud secrets create binance-relay-secret --data-file=-`).
  This should be a **new, dedicated** secret — not `CRON_SECRET` or any existing one, same
  reasoning as `MARKET_WATCHER_CRON_SECRET`: a credential scoped to one caller shouldn't force
  touching every other caller if it ever needs rotating.

## Wiring it into the app

Set two env vars in Vercel (Production):

```
BINANCE_RELAY_URL=https://<the Cloud Run service URL>
BINANCE_RELAY_SECRET=<the same RELAY_SECRET value>
```

`binance-client.ts` routes through the relay automatically once `BINANCE_RELAY_URL` is set —
leaving it unset falls back to calling `api.binance.com` directly, so this only ever changes
behavior when deliberately configured.
