#!/usr/bin/env node
/**
 * Implements Ch. 2.1's complexity formula literally: C = Σ cp·tp — the complexity of a part
 * weighted by the fraction of time developers spend working on it. Here `tp` is per-file commit
 * churn (docs/quality/raw/churn.json) and `cp` is a blend of duplication, import fan-in, and
 * (from the second run onward) the red-flag count the last audit found in that file.
 *
 * Every signal is combined by PERCENTILE RANK within this run's file set, not raw magnitude —
 * that's what makes a token count, an import count, and a flag count combinable without an
 * arbitrary unit conversion, and what makes the score reproducible run over run for the same
 * repo state. See docs/quality/README.md for the full rationale and the financial-risk-floor
 * exception (the one deliberate, named departure from pure churn×complexity ranking).
 *
 * Reads: docs/quality/raw/{churn,madge,red-flag-counts}.json, docs/quality/raw/jscpd/jscpd-report.json
 * Writes: docs/quality/complexity-score.json (ranked descending, with a severity band per file)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { listSourceFiles } from "./lib/walk-source-files.mjs";

const CHURN_PATH = "docs/quality/raw/churn.json";
const MADGE_PATH = "docs/quality/raw/madge.json";
const JSCPD_PATH = "docs/quality/raw/jscpd/jscpd-report.json";
const RED_FLAG_COUNTS_PATH = "docs/quality/raw/red-flag-counts.json"; // written by the code-quality-audit skill after each sweep
const OUT_PATH = "docs/quality/complexity-score.json";

const FINANCIAL_RISK_PATTERNS = [/^src\/lib\/capital-circle\//, /^src\/lib\/ledger\.ts$/, /-actions\.ts$/];

function readJsonSafe(path, fallback) {
  if (!existsSync(path)) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

/** Percentile rank (0..1) of each value within `values`, ties sharing the same rank. */
function percentileRanks(valuesByFile) {
  const entries = Object.entries(valuesByFile);
  const sorted = [...entries].sort((a, b) => a[1] - b[1]);
  const n = sorted.length;
  const ranks = {};
  sorted.forEach(([file], i) => {
    ranks[file] = n <= 1 ? 0 : i / (n - 1);
  });
  return ranks;
}

function dupTokenCountsByFile(jscpdReport) {
  const counts = {};
  for (const dup of jscpdReport?.duplicates ?? []) {
    for (const side of [dup.firstFile, dup.secondFile]) {
      if (!side?.name) continue;
      const file = side.name.split("\\").join("/");
      counts[file] = (counts[file] ?? 0) + (dup.tokens ?? dup.lines ?? 1);
    }
  }
  return counts;
}

function fanInCountsByFile(madgeGraph) {
  const counts = {};
  for (const deps of Object.values(madgeGraph ?? {})) {
    for (const dep of deps) {
      counts[dep] = (counts[dep] ?? 0) + 1;
    }
  }
  return counts;
}

function isFinancialRisk(file) {
  return FINANCIAL_RISK_PATTERNS.some((re) => re.test(file));
}

function severityBand(percentile) {
  if (percentile >= 0.9) return "Critical";
  if (percentile >= 0.75) return "High";
  if (percentile >= 0.5) return "Medium";
  return "Low";
}

function main() {
  const files = listSourceFiles();
  const churn = readJsonSafe(CHURN_PATH, {});
  const madge = readJsonSafe(MADGE_PATH, {});
  const jscpd = readJsonSafe(JSCPD_PATH, { duplicates: [] });
  const redFlagCounts = readJsonSafe(RED_FLAG_COUNTS_PATH, null); // null = bootstrap run, no prior audit yet

  const dupCounts = dupTokenCountsByFile(jscpd);
  const fanInCounts = fanInCountsByFile(madge);

  // Every file gets an entry (0 default) so percentile ranking is over the full file set, not just the ones with hits.
  const dupByFile = Object.fromEntries(files.map((f) => [f, dupCounts[f] ?? 0]));
  const fanInByFile = Object.fromEntries(files.map((f) => [f, fanInCounts[f] ?? 0]));
  const churnByFile = Object.fromEntries(files.map((f) => [f, churn[f] ?? 0]));
  const redFlagByFile = redFlagCounts
    ? Object.fromEntries(files.map((f) => [f, redFlagCounts[f] ?? 0]))
    : null;

  const dupPct = percentileRanks(dupByFile);
  const fanInPct = percentileRanks(fanInByFile);
  const tpPct = percentileRanks(churnByFile);
  const redFlagPct = redFlagByFile ? percentileRanks(redFlagByFile) : null;

  const scored = files.map((file) => {
    const cp = redFlagPct
      ? 0.4 * dupPct[file] + 0.3 * fanInPct[file] + 0.3 * redFlagPct[file]
      : 0.55 * dupPct[file] + 0.45 * fanInPct[file]; // bootstrap: no prior audit to draw a red-flag term from yet
    const tp = tpPct[file];
    return {
      file,
      rawScore: cp * tp,
      cp: Number(cp.toFixed(4)),
      tp: Number(tp.toFixed(4)),
      churnCount: churnByFile[file],
      dupTokens: dupByFile[file],
      fanIn: fanInByFile[file],
      financialRisk: isFinancialRisk(file),
    };
  });

  // Financial-risk floor: raise to at least the 75th-percentile score, even if raw churn×complexity ranks lower.
  const rawScores = Object.fromEntries(scored.map((s) => [s.file, s.rawScore]));
  const rawPct = percentileRanks(rawScores);
  const sortedRaw = [...scored].map((s) => s.rawScore).sort((a, b) => a - b);
  const p75Score = sortedRaw[Math.floor(0.75 * (sortedRaw.length - 1))] ?? 0;

  const finalScored = scored.map((s) => {
    const floored = s.financialRisk ? Math.max(s.rawScore, p75Score) : s.rawScore;
    return { ...s, score: Number(floored.toFixed(6)), scorePercentile: rawPct[s.file] };
  });

  finalScored.sort((a, b) => b.score - a.score);
  const finalPct = percentileRanks(Object.fromEntries(finalScored.map((s) => [s.file, s.score])));
  for (const s of finalScored) s.severity = severityBand(finalPct[s.file]);

  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(
    OUT_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        bootstrap: redFlagByFile === null,
        fileCount: finalScored.length,
        files: finalScored,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    `quality:score — ranked ${finalScored.length} files (${redFlagByFile === null ? "bootstrap" : "with prior red-flag data"}) → ${OUT_PATH}`,
  );
}

main();
