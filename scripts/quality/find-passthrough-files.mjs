#!/usr/bin/env node
/**
 * Mechanical proxy for the book's "Pass-Through Method" red flag (Ch. 7.1) and "classitis"
 * (Ch. 4.6): flags any small file whose only substantive export is a function that does nothing
 * but forward its arguments to a single call into another imported module.
 *
 * This is a heuristic (regex over the function body, not a full AST match), so it is deliberately
 * a candidate list for the weekly LLM sweep to confirm or dismiss — see docs/quality/README.md —
 * not a scored violation on its own. Writes docs/quality/raw/passthrough.json.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { listSourceFiles } from "./lib/walk-source-files.mjs";

const OUT_PATH = "docs/quality/raw/passthrough.json";
const MAX_FILE_LINES = 20;

function exportedFunctionCount(text) {
  const matches = text.match(/^export\s+(async\s+)?function\s+\w+/gm) ?? [];
  return matches.length;
}

/** True if the function body is essentially `return [await] someIdentifier(...)` with nothing else of substance. */
function looksLikePassThrough(body) {
  const statements = body
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("//") && !l.startsWith("*") && !l.startsWith("/*"));
  if (statements.length === 0 || statements.length > 2) return false;
  const last = statements[statements.length - 1];
  return /^return\s+(await\s+)?[A-Za-z_$][\w$]*\(.*\);?$/.test(last);
}

function findPassThroughFunctions(text) {
  const fnRegex = /export\s+(async\s+)?function\s+(\w+)\s*\([^)]*\)[^{]*\{([\s\S]*?)\n\}/g;
  const hits = [];
  let m;
  while ((m = fnRegex.exec(text))) {
    const [, , name, body] = m;
    if (looksLikePassThrough(body)) hits.push(name);
  }
  return hits;
}

function main() {
  const findings = [];
  for (const file of listSourceFiles()) {
    const text = readFileSync(file, "utf8");
    const lineCount = text.split("\n").length;
    if (lineCount > MAX_FILE_LINES) continue; // only interesting for genuinely small files
    if (exportedFunctionCount(text) !== 1) continue; // "only substantive export is *a* function"
    const passThroughFns = findPassThroughFunctions(text);
    if (passThroughFns.length > 0) {
      findings.push({ file, lineCount, functions: passThroughFns });
    }
  }
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(findings, null, 2) + "\n");
  console.log(`quality:passthrough — flagged ${findings.length} candidate file(s) → ${OUT_PATH}`);
}

main();
