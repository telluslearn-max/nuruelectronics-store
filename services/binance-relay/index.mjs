// Binance API relay — a transparent proxy that exists for exactly one reason: Vercel's Hobby
// plan only supports a single project-wide function region, and this app's is iad1 (Washington
// D.C.) — one of Binance's "Restricted Locations." Binance's API returns HTTP 451 for any request
// whose origin IP is in a restricted location, regardless of where the account itself is actually
// based (Kenya, for this app). Moving the whole Vercel project's region would fix Binance but push
// every other call (database, Vertex AI, Shopify, Circle, Polymarket) away from wherever they're
// actually hosted. This relay instead moves just the Binance calls, by running from a region
// Binance doesn't restrict.
//
// Deliberately dumb, same philosophy as the market watcher:
//   - Signing (HMAC with BINANCE_API_SECRET) still happens in Vercel, exactly as before. This
//     relay never sees, needs, or stores that secret — it only ever forwards an
//     already-signed request byte-for-byte. Losing this relay's own secret can't be used to sign
//     a new request; at worst it just moves where an already-authorized signature gets forwarded from.
//   - Gated by its OWN shared secret (RELAY_SECRET), unrelated to any Binance credential. Without
//     this, anyone who found this relay's URL could use it as a free anonymizing proxy to their
//     own Binance account, which is bad hygiene and abuse-prone even though it can't touch this
//     app's funds.
//   - Restricted to a hardcoded path allowlist — exactly the two Binance endpoints
//     binance-client.ts actually calls today. Not a general-purpose Binance proxy: a bug that sent
//     a request to the wrong path fails loudly here instead of being quietly forwarded to whatever
//     Binance endpoint it happened to name.
//
// Usage: node index.mjs
// Required env: RELAY_SECRET
// Optional env: PORT (Cloud Run sets this automatically)

import http from "node:http";
import https from "node:https";
import { timingSafeEqual } from "node:crypto";

const RELAY_SECRET = process.env.RELAY_SECRET;
const PORT = process.env.PORT ?? 8080;
const BINANCE_HOST = "api.binance.com";

if (!RELAY_SECRET) {
  console.error("RELAY_SECRET is required — without it this relay would forward anyone's Binance request to anyone.");
  process.exit(1);
}

/** Exactly the two endpoints binance-client.ts calls today. Extend deliberately, not by accident. */
const ALLOWED_PATHS = new Set(["/sapi/v1/capital/config/getall", "/sapi/v1/capital/withdraw/apply"]);

function constantTimeEqual(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  // Length itself is not secret (RELAY_SECRET's length isn't sensitive the way its content is),
  // but timingSafeEqual requires equal-length buffers, so mismatched lengths must fail before it.
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

const server = http.createServer((req, res) => {
  const providedSecret = req.headers["x-relay-secret"];
  if (typeof providedSecret !== "string" || !constantTimeEqual(providedSecret, RELAY_SECRET)) {
    res.writeHead(401, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Unauthorized" }));
    return;
  }

  const requestUrl = new URL(req.url ?? "/", `http://${BINANCE_HOST}`);
  if (!ALLOWED_PATHS.has(requestUrl.pathname)) {
    console.warn(`[relay] refused path not on the allowlist: ${requestUrl.pathname}`);
    res.writeHead(403, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: `Path "${requestUrl.pathname}" is not on this relay's allowlist.` }));
    return;
  }

  const apiKey = req.headers["x-mbx-apikey"];
  if (typeof apiKey !== "string") {
    res.writeHead(400, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Missing X-MBX-APIKEY header." }));
    return;
  }

  console.log(`[relay] forwarding ${req.method} ${requestUrl.pathname}`);

  const upstreamRequest = https.request(
    {
      hostname: BINANCE_HOST,
      path: requestUrl.pathname + requestUrl.search,
      method: req.method,
      headers: { "X-MBX-APIKEY": apiKey },
    },
    (upstreamResponse) => {
      res.writeHead(upstreamResponse.statusCode ?? 502, { "Content-Type": upstreamResponse.headers["content-type"] ?? "application/json" });
      upstreamResponse.pipe(res);
    },
  );

  upstreamRequest.on("error", (error) => {
    console.error("[relay] upstream request to Binance failed:", error.message);
    if (!res.headersSent) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: `Relay could not reach Binance: ${error.message}` }));
    }
  });

  // POST /capital/withdraw/apply carries its params in the query string, same as binance-client.ts's
  // own signedGet — there is no request body to forward either way, but piping it through costs
  // nothing and keeps this relay correct if a future endpoint ever does use one.
  req.pipe(upstreamRequest);
});

server.listen(PORT, () => console.log(`[startup] Binance relay listening on :${PORT}, forwarding to https://${BINANCE_HOST}`));

process.on("SIGTERM", () => {
  console.log("[shutdown] SIGTERM received, exiting.");
  server.close(() => process.exit(0));
});
