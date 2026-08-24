// Capital Circle market watcher — a small, always-on process (Cloud Run with
// min-instances=1, or any host that stays up) that holds Polymarket's public market
// WebSocket open 24/7 and wakes the EXISTING /api/cron/capital-circle-cycle pipeline
// sooner than its hourly schedule when a new market appears.
//
// Deliberately dumb: this file makes no trading decisions and never touches a market
// price for pricing purposes. It only decides WHEN to call the one endpoint that does
// all of that — screening (candidate-filter.ts), scoring, the edge gate, Kelly sizing,
// every existing circuit breaker (drawdown halt, assignment-inversion halt, advisory
// lock against overlapping runs). Widening how often that pipeline gets a chance to
// run changes latency, not what it's allowed to do.
//
// Two independent trigger paths, so a WebSocket outage degrades to "still runs on a
// timer" rather than "silently stops discovering markets at all":
//   1. Every POLL_INTERVAL_MS, unconditionally (the reliable backbone).
//   2. On a Polymarket `new_market` event, if WS_TRIGGER_COOLDOWN_MS has elapsed since
//      the last trigger from either path — new markets have zero volume/liquidity at
//      birth and will usually fail candidate-filter.ts's own screening immediately, so
//      this is a real but modest latency win, not the primary mechanism.
//
// Usage: node index.mjs
// Required env: CRON_URL, CRON_SECRET
// Optional env: POLL_INTERVAL_MS (default 300000 = 5min), WS_TRIGGER_COOLDOWN_MS (default 120000 = 2min)

import WebSocket from "ws";

const CRON_URL = process.env.CRON_URL;
const CRON_SECRET = process.env.CRON_SECRET;
const POLL_INTERVAL_MS = Number(process.env.POLL_INTERVAL_MS ?? 300_000);
const WS_TRIGGER_COOLDOWN_MS = Number(process.env.WS_TRIGGER_COOLDOWN_MS ?? 120_000);
const WS_URL = "wss://ws-subscriptions-clob.polymarket.com/ws/market";
const PING_INTERVAL_MS = 10_000;
/** Cloud Run's own health check + a safety net if the socket goes silent without a clean close event. */
const STALE_CONNECTION_MS = 30_000;

if (!CRON_URL) {
  console.error("CRON_URL is required (e.g. https://www.nuruelectronics.com/api/cron/capital-circle-cycle).");
  process.exit(1);
}
if (!CRON_SECRET) {
  console.error("CRON_SECRET is required — the same value configured in Vercel for this route.");
  process.exit(1);
}

let lastTriggerAt = 0;
let triggerInFlight = false;

/**
 * Calls the existing cron route exactly the way GCP Cloud Scheduler already does —
 * same auth header, same endpoint. The route's own advisory lock (see
 * route.ts's runCycleWithLock) makes a second overlapping call a safe, cheap no-op,
 * so this never needs to coordinate with the hourly scheduler that's still running
 * independently of this worker.
 */
async function triggerCycle(reason) {
  if (triggerInFlight) {
    console.log(`[trigger] skipped (${reason}) — a previous trigger is still in flight.`);
    return;
  }
  triggerInFlight = true;
  lastTriggerAt = Date.now();
  console.log(`[trigger] calling capital-circle-cycle (${reason})...`);
  try {
    const response = await fetch(CRON_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${CRON_SECRET}` },
      // The pipeline itself can legitimately take minutes (see the route's own
      // maxDuration=300) — this is a background trigger, not a request anyone is
      // waiting on, so there is no reason to time this fetch out early.
      signal: AbortSignal.timeout(310_000),
    });
    const body = await response.text();
    console.log(`[trigger] response ${response.status}: ${body.slice(0, 500)}`);
  } catch (error) {
    console.error(`[trigger] failed:`, error instanceof Error ? error.message : error);
  } finally {
    triggerInFlight = false;
  }
}

function connect() {
  console.log(`[ws] connecting to ${WS_URL}...`);
  const ws = new WebSocket(WS_URL);
  let pingTimer;
  let lastMessageAt = Date.now();
  let staleCheckTimer;

  ws.on("open", () => {
    console.log("[ws] connected");
    // Empty assets_ids + custom_feature_enabled is the discovery mode — confirmed live
    // against the real endpoint that this yields a global new_market feed, not one
    // scoped to specific tokens (there is nothing to pre-subscribe to for markets that
    // don't exist yet).
    ws.send(JSON.stringify({ assets_ids: [], type: "market", custom_feature_enabled: true }));
    pingTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send("PING");
    }, PING_INTERVAL_MS);
    staleCheckTimer = setInterval(() => {
      if (Date.now() - lastMessageAt > STALE_CONNECTION_MS + PING_INTERVAL_MS) {
        console.warn("[ws] no message (including PONG) in too long — forcing reconnect.");
        ws.terminate();
      }
    }, PING_INTERVAL_MS);
  });

  ws.on("message", (data) => {
    lastMessageAt = Date.now();
    const text = data.toString();
    if (text === "PONG") return;

    let msg;
    try {
      msg = JSON.parse(text);
    } catch {
      return; // Not JSON and not PONG — ignore rather than crash the process on a malformed frame.
    }

    if (msg.event_type === "new_market") {
      const sinceLastTrigger = Date.now() - lastTriggerAt;
      if (sinceLastTrigger >= WS_TRIGGER_COOLDOWN_MS) {
        void triggerCycle(`new_market: ${msg.question ?? msg.id ?? "unknown"}`);
      }
      // Below cooldown: deliberately silent. Busy periods can emit dozens of new_market
      // events within seconds (measured live: 26 in 45s) — logging every suppressed one
      // would just be noise, and the periodic timer below is already going to catch up.
    }
  });

  ws.on("error", (error) => console.error("[ws] error:", error.message));

  ws.on("close", (code, reason) => {
    console.log(`[ws] closed (${code} ${reason.toString()}) — reconnecting in 5s.`);
    clearInterval(pingTimer);
    clearInterval(staleCheckTimer);
    setTimeout(connect, 5_000);
  });
}

console.log(`[startup] market watcher starting — poll every ${POLL_INTERVAL_MS}ms, WS trigger cooldown ${WS_TRIGGER_COOLDOWN_MS}ms.`);
connect();
setInterval(() => triggerCycle("periodic poll"), POLL_INTERVAL_MS);

// Cloud Run sends SIGTERM on shutdown/redeploy — exit cleanly rather than getting killed mid-line.
process.on("SIGTERM", () => {
  console.log("[shutdown] SIGTERM received, exiting.");
  process.exit(0);
});
