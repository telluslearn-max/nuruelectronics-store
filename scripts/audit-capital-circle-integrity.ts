// Pins down WHERE Capital Circle's forecasting record went wrong, rather than inferring it.
//
// The live dashboard reports a Brier score of 0.318 against a 0.250 base rate and a skill score of
// −0.272 over 500 scored predictions: the desk's stated probabilities carry less information than
// guessing the base rate every time. The bucket table says why that is not ordinary
// overconfidence. Every confidence band pairs with its mirror — counts within one of each other,
// actual rates summing to 1.00 — and the mid bands come back cleanly inverted: outcomes called
// ~35% happened 64% of the time, ones called ~65% happened 36%. That is 1−p to within a point.
// Bands either side of 0.5 look fine, which is exactly what you would expect, because flipping a
// probability near 0.5 barely moves it.
//
// A probability sitting on the wrong side of a market is the most expensive error this system can
// make. Edge is the gap between a probability and a price, so pairing one outcome's probability
// with its sibling's price manufactures the largest apparent edge on the board — and the selection
// stage is built to hunt for exactly that. It does not degrade the desk toward random; it aims
// capital at the wrong side of the book with conviction.
//
// Three different faults produce that same signature, and they need completely different fixes:
//
//   A. The model returned a probability against the wrong outcome (a scoring-stage mis-pairing).
//   B. Settlement wrote resolvedOutcome against the wrong token (a labeling fault).
//   C. Both are fine and the model is genuinely, symmetrically wrong (a forecasting problem).
//
// This script separates them by going back to Polymarket itself:
//
//   - It re-fetches each resolved market and checks the stored resolvedOutcome against the real
//     settled price. Disagreement there is fault B, and nothing else needs looking at.
//   - It reconstructs the price the model was shown when it priced each outcome — from the
//     recorded shownPrice where present, and otherwise from the CLOB's own price history at the
//     snapshot's timestamp — and asks whether each estimate sits closer to its own outcome's price
//     or to its sibling's. A record where estimates track the sibling's price is fault A.
//   - What survives both checks is fault C.
//
// Read-only: it writes nothing and takes no positions. Self-contained on purpose — src/lib/prisma
// and polymarket-client both import "server-only", which throws outside Next's bundler, so this
// carries its own client and its own fetches. calibration.ts is a pure module and is imported
// directly, so the numbers here are computed by the same code the desk runs on.
//
// Usage:
//   npx tsx scripts/audit-capital-circle-integrity.ts
//   npx tsx scripts/audit-capital-circle-integrity.ts --markets 200 --verbose

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { computeCalibration, detectAssignmentInversion, type CalibrationSample } from "../src/lib/capital-circle/calibration";

const GAMMA_API_BASE = "https://gamma-api.polymarket.com";
const CLOB_HOST = "https://clob.polymarket.com";

const args = process.argv.slice(2);
const verbose = args.includes("--verbose");
const marketLimit = Number(args[args.indexOf("--markets") + 1]) || 120;

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

/** Polite pacing — this walks a few hundred public endpoints and there is no hurry. */
const REQUEST_DELAY_MS = 120;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function toNum(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function parseJsonArray(value: unknown): string[] {
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

type SettledMarket = { tokens: { tokenId: string; outcome: string; price: number }[] };

/** `closed: "true"` is required — Gamma's condition_ids filter otherwise excludes closed markets. */
async function fetchSettledMarket(conditionId: string): Promise<SettledMarket | null> {
  const params = new URLSearchParams({ condition_ids: conditionId, closed: "true" });
  const response = await fetch(`${GAMMA_API_BASE}/markets?${params.toString()}`);
  if (!response.ok) return null;
  const body = await response.json();
  const raw = Array.isArray(body) ? body[0] : null;
  if (!raw || typeof raw !== "object") return null;

  const m = raw as Record<string, unknown>;
  const outcomes = parseJsonArray(m.outcomes);
  const prices = parseJsonArray(m.outcomePrices);
  const tokenIds = parseJsonArray(m.clobTokenIds);

  const tokens: SettledMarket["tokens"] = [];
  for (let i = 0; i < tokenIds.length; i++) {
    const price = Number(prices[i]);
    if (tokenIds[i] && outcomes[i] && Number.isFinite(price)) {
      tokens.push({ tokenId: tokenIds[i], outcome: outcomes[i], price });
    }
  }
  return tokens.length > 0 ? { tokens } : null;
}

/** The price a token traded at around `at` — how a pre-shownPrice snapshot recovers what the model saw. */
async function fetchPriceAt(tokenId: string, at: Date): Promise<number | null> {
  const ts = Math.floor(at.getTime() / 1000);
  const params = new URLSearchParams({
    market: tokenId,
    startTs: String(ts - 3600),
    endTs: String(ts + 3600),
    fidelity: "1",
  });
  try {
    const response = await fetch(`${CLOB_HOST}/prices-history?${params.toString()}`);
    if (!response.ok) return null;
    const body = await response.json();
    const points = Array.isArray(body) ? body : (body as { history?: unknown }).history;
    if (!Array.isArray(points) || points.length === 0) return null;
    const closest = points.reduce((best: { t: number; p: number }, point: { t: number; p: number }) =>
      Math.abs(point.t - ts) < Math.abs(best.t - ts) ? point : best,
    );
    return toNum(closest.p);
  } catch {
    return null;
  }
}

/**
 * The price the model was shown for one snapshot's outcome.
 *
 * Prefers the recorded value, and reconstructs it from the CLOB's price history at the
 * snapshot's timestamp when the row predates that column — which is what lets this audit
 * reach the historical record that raised the question in the first place.
 */
async function priceShownFor(row: { shownPrice: unknown; tokenId: string; createdAt: Date }): Promise<number | null> {
  if (row.shownPrice != null) return Number(row.shownPrice);
  const price = await fetchPriceAt(row.tokenId, row.createdAt);
  await sleep(REQUEST_DELAY_MS);
  return price;
}

function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function heading(text: string): void {
  console.log(`\n${text}\n${"─".repeat(text.length)}`);
}

async function main(): Promise<void> {
  const snapshots = await prisma.capitalCircleCandidateSnapshot.findMany({
    where: { resolvedOutcome: { not: null }, modelProbability: { not: null } },
    orderBy: { resolvedAt: "desc" },
    take: 2000,
  });

  if (snapshots.length === 0) {
    console.log("No resolved candidate snapshots yet — nothing to audit.");
    return;
  }

  // ---- 1. Restate the problem from the same code the desk runs on --------------------
  const samples: CalibrationSample[] = snapshots.map((snapshot) => ({
    probability: Number(snapshot.modelProbability),
    outcome: snapshot.resolvedOutcome === 1 ? 1 : 0,
    category: snapshot.category,
    shownPrice: snapshot.shownPrice != null ? Number(snapshot.shownPrice) : null,
  }));

  const calibration = computeCalibration(samples);
  const inversion = detectAssignmentInversion(calibration);

  heading(`Recorded track record (${calibration.sampleCount} scored predictions)`);
  console.log(`Brier ${calibration.brierScore} against a ${calibration.baseRateBrier} base rate (skill ${calibration.skillScore}).`);
  if (calibration.passthroughShare != null) {
    console.log(`${pct(calibration.passthroughShare)} of estimates carrying a shown price were that price, returned unchanged.`);
  } else {
    console.log(`No snapshot records the price the model was shown — shownPrice only exists on rows written after that column was added.`);
  }
  console.log(inversion.inverted ? `INVERSION SUSPECTED: ${inversion.detail}` : `No inversion signature (${inversion.sampleCount} off-centre samples considered).`);

  // ---- 2. Group into markets, which is where a mis-pairing is visible at all ----------
  const byMarket = new Map<string, typeof snapshots>();
  for (const snapshot of snapshots) {
    const list = byMarket.get(snapshot.marketId);
    if (list) list.push(snapshot);
    else byMarket.set(snapshot.marketId, [snapshot]);
  }

  const twoSided = [...byMarket.entries()].filter(([, rows]) => rows.length === 2).slice(0, marketLimit);
  heading(`Checking ${twoSided.length} two-sided markets against Polymarket`);

  let labelChecked = 0;
  let labelWrong = 0;
  let labelUnavailable = 0;
  let bothSidesSameLabel = 0;

  let nameChecked = 0;
  let nameMismatched = 0;

  let priceChecked = 0;
  let matchesOwnPrice = 0;
  let matchesSiblingPrice = 0;
  let priceUnavailable = 0;

  const examples: string[] = [];

  for (const [conditionId, rows] of twoSided) {
    const [first, second] = rows;

    // Both sides of a binary market cannot have won. If they carry the same label, the
    // labeling step is broken on its own terms, before Polymarket is even consulted.
    if (first.resolvedOutcome === second.resolvedOutcome) bothSidesSameLabel++;

    const settled = await fetchSettledMarket(conditionId);
    await sleep(REQUEST_DELAY_MS);

    if (!settled) {
      labelUnavailable++;
    } else {
      for (const row of rows) {
        const token = settled.tokens.find((t) => t.tokenId === row.tokenId);
        if (!token) continue;

        // The check that does NOT inherit this script's own assumptions.
        //
        // Both the live pipeline and the fetch above build tokens by zipping Gamma's parallel
        // clobTokenIds / outcomes / outcomePrices arrays by index. If those arrays are ordered
        // differently between an open-market response and a closed-market one, every consumer of
        // that zip is wrong in the same direction and re-deriving the label here would agree with
        // the stored one while both were wrong. Comparing the outcome NAME recorded at scoring
        // time against the name attached to the same token id at settlement is independent of the
        // zip, so it catches exactly that — a disagreement means the two responses do not agree
        // about which outcome a token id belongs to, and no downstream number can be trusted.
        if (row.outcomeLabel) {
          nameChecked++;
          const recorded = row.outcomeLabel.trim().toLowerCase();
          const settledName = token.outcome.trim().toLowerCase();
          if (recorded !== settledName) {
            nameMismatched++;
            if (examples.length < 8) {
              examples.push(
                `ALIGNMENT: "${row.question}" — token ${row.tokenId.slice(0, 10)}… was priced as "${row.outcomeLabel}" but settles as "${token.outcome}".`,
              );
            }
          }
        }

        labelChecked++;
        const truth = token.price >= 0.5 ? 1 : 0;
        if (truth !== row.resolvedOutcome) {
          labelWrong++;
          if (examples.length < 16) {
            examples.push(
              `LABEL: "${row.question}" / ${row.outcomeLabel ?? token.outcome} — stored ${row.resolvedOutcome}, Polymarket settled at ${token.price} (${truth}).`,
            );
          }
        }
      }
    }

    // Does each estimate sit nearer its own outcome's price at scoring time, or its sibling's?
    for (const row of rows) {
      const sibling = rows.find((other) => other.tokenId !== row.tokenId);
      if (!sibling) continue;

      const ownPrice = await priceShownFor(row);
      const siblingPrice = await priceShownFor(sibling);

      if (ownPrice == null || siblingPrice == null || Math.abs(ownPrice - siblingPrice) < 0.05) {
        // Prices too close together carry no signal: near 0.5 both hypotheses predict the same thing.
        priceUnavailable++;
        continue;
      }

      priceChecked++;
      const probability = Number(row.modelProbability);
      const toOwn = Math.abs(probability - ownPrice);
      const toSibling = Math.abs(probability - siblingPrice);
      if (toSibling + 0.02 < toOwn) {
        matchesSiblingPrice++;
        if (examples.length < 16) {
          examples.push(
            `PAIRING: "${row.question}" / ${row.outcomeLabel ?? row.tokenId.slice(0, 8)} — model said ${probability}, its own price was ${ownPrice}, the other side's was ${siblingPrice}.`,
          );
        }
      } else if (toOwn + 0.02 < toSibling) {
        matchesOwnPrice++;
      }
    }
  }

  // ---- 3. Verdict --------------------------------------------------------------------
  heading("Where the fault is");

  console.log(`Labels checked against Polymarket: ${labelChecked} (${labelWrong} disagreed, ${labelUnavailable} markets unavailable).`);
  console.log(
    `Token-to-outcome-name agreement between scoring time and settlement: ${nameChecked} checkable ` +
      `(${nameMismatched} disagreed)${nameChecked === 0 ? " — no row carries outcomeLabel yet, so this cannot be tested on the historical record" : ""}.`,
  );
  console.log(`Markets whose two sides carry the same win/loss label: ${bothSidesSameLabel}.`);
  console.log(
    `Estimates compared against the prices shown at scoring time: ${priceChecked} usable ` +
      `(${matchesOwnPrice} sat nearer their own outcome's price, ${matchesSiblingPrice} nearer the other side's; ${priceUnavailable} too close to call or unavailable).`,
  );

  const labelErrorRate = labelChecked > 0 ? labelWrong / labelChecked : 0;
  const siblingRate = priceChecked > 0 ? matchesSiblingPrice / priceChecked : 0;

  heading("Verdict");
  if (nameChecked >= 20 && nameMismatched / nameChecked > 0.1) {
    console.log(
      `FAULT D — GAMMA ARRAY MISALIGNMENT. ${pct(nameMismatched / nameChecked)} of token ids are attached to a different outcome\n` +
        `name at settlement than they were at scoring time. Everything that zips Gamma's parallel clobTokenIds / outcomes /\n` +
        `outcomePrices arrays by index is therefore unsafe — parseMarket in polymarket-client.ts above all — and both the labels\n` +
        `and the prices derived from it are suspect. Fix the parse to key on token id explicitly before trusting any other number here.`,
    );
  } else if (labelChecked > 0 && labelErrorRate > 0.1) {
    console.log(
      `FAULT B — SETTLEMENT LABELING. ${pct(labelErrorRate)} of stored outcomes disagree with how Polymarket actually settled the market.\n` +
        `The forecasts may be fine; what is scoring them is wrong. Fix labelSnapshotsForMarket in settlement.ts before drawing any conclusion about the model,\n` +
        `then re-run this audit — the calibration table cannot be read until the labels are trustworthy.`,
    );
  } else if (priceChecked >= 30 && siblingRate > 0.35) {
    console.log(
      `FAULT A — SCORING-STAGE MIS-PAIRING. ${pct(siblingRate)} of estimates sit closer to the OTHER side's price than to their own.\n` +
        `The probabilities are being recorded against the wrong outcome, which is what the ref/name verification in scoring-slate.ts now prevents\n` +
        `on every new cycle. Historical rows stay contaminated: exclude anything written before that change from calibration rather than trying to repair it.`,
    );
  } else if (inversion.inverted) {
    console.log(
      `INVERSION IS REAL BUT UNEXPLAINED by either mechanism this script can test.\n` +
        `Labels agree with Polymarket and estimates track their own outcome's price, yet the resolved record still fits 1−p.\n` +
        `Next place to look is the deep-dive stage: a position recorded against a different token than the thesis argued for would do this,\n` +
        `and record_position's approvedTrades lookup is the only thing standing between the model's arguments and the token actually bought.`,
    );
  } else {
    console.log(
      `FAULT C — NO INTEGRITY FAULT FOUND. Labels agree with Polymarket and estimates track their own outcome's price.\n` +
        `What is left is a genuine forecasting problem, and the honest response is a lower λ and a stricter edge bar, not a pipeline fix.`,
    );
  }

  if (verbose && examples.length > 0) {
    heading("Examples");
    for (const example of examples) console.log(`  ${example}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
