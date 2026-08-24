#!/usr/bin/env node
/**
 * Hard gate: fails only if `madge --circular` finds a cycle NOT present in the checked-in
 * baseline (docs/quality/circular-baseline.json). Circular imports are an unambiguous structural
 * symptom — two modules that can't be understood independently — so this is a correctness gate,
 * not a design judgment call, per Phase A of docs/quality/README.md.
 *
 * Fixing a pre-existing cycle is done by re-running `npm run quality:circular` to regenerate the
 * baseline as part of that same, reviewed change — never by editing the baseline file by hand.
 */
import { execSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";

const BASELINE_PATH = "docs/quality/circular-baseline.json";

function currentCycles() {
  // execSync (shell: true implicitly on a string command) rather than execFileSync("npx", ...) —
  // npx resolves to npx.cmd on Windows, which execFileSync won't invoke without a shell.
  const raw = execSync("npx madge --circular --json src", { encoding: "utf8" });
  return JSON.parse(raw);
}

function cycleKey(cycle) {
  return [...cycle].sort().join(" -> ");
}

function main() {
  if (!existsSync(BASELINE_PATH)) {
    console.error(
      `[quality:circular] No baseline at ${BASELINE_PATH}. Run: npx madge --circular --json src > ${BASELINE_PATH}`,
    );
    process.exit(1);
  }
  const baseline = new Set(JSON.parse(readFileSync(BASELINE_PATH, "utf8")).map(cycleKey));
  const current = currentCycles();
  const newCycles = current.filter((c) => !baseline.has(cycleKey(c)));

  if (newCycles.length > 0) {
    console.error(`[quality:circular] ${newCycles.length} NEW circular import(s) not in the baseline:`);
    for (const c of newCycles) console.error("  " + c.join(" -> "));
    console.error(
      `If this cycle is pre-existing and intentional, regenerate the baseline as part of a reviewed change: ` +
        `npx madge --circular --json src > ${BASELINE_PATH}`,
    );
    process.exit(1);
  }
  console.log(`[quality:circular] ok (${current.length} pre-existing cycle(s), 0 new)`);
}

main();
