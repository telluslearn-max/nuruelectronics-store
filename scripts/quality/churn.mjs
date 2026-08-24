#!/usr/bin/env node
/**
 * Computes the `tp` (time-weight) input for the Ch. 2.1 complexity formula: how many commits
 * touched each file under src/ in the trailing 6 months. This is the book's own proxy for
 * "the fraction of time developers spend working on that part" — commit-touch count, not lines
 * changed, since a file that gets opened and re-reasoned-about a lot is exactly what the formula
 * means even if each individual diff is small.
 *
 * Writes docs/quality/raw/churn.json: { [relativePath]: commitCount }, only for files under src/
 * that still exist on disk (renamed/deleted files are dropped rather than left as stale entries).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const OUT_PATH = "docs/quality/raw/churn.json";

function gitLogTouchedFiles() {
  const raw = execFileSync(
    "git",
    ["log", "--since=6 months ago", "--name-only", "--pretty=format:", "--", "src"],
    { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  return raw.split("\n").map((line) => line.trim()).filter(Boolean);
}

function main() {
  const counts = {};
  for (const path of gitLogTouchedFiles()) {
    if (!path.startsWith("src/")) continue;
    if (!existsSync(path)) continue; // dropped/renamed since — don't score a file that isn't there
    counts[path] = (counts[path] ?? 0) + 1;
  }
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(counts, null, 2) + "\n");
  console.log(`quality:churn — wrote ${Object.keys(counts).length} files to ${OUT_PATH}`);
}

main();
