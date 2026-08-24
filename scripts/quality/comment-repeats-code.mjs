#!/usr/bin/env node
/**
 * Mechanical proxy for the "Comment Repeats Code" red flag (Ch. 13.2): flags single-line `//`
 * comments whose words are almost entirely a subset of the words in the declaration/statement on
 * the very next line — the book's own worked example is a comment that "reuses the words that
 * make up the name of the thing it is describing."
 *
 * This is lexical-overlap only, not semantic understanding, so real false positives are expected
 * (a comment can legitimately reuse a name while still adding real information). Writes a
 * candidate list to docs/quality/raw/comment-overlap.json for the weekly LLM sweep to confirm or
 * dismiss — see docs/quality/README.md. Never a scored violation on its own.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { listSourceFiles } from "./lib/walk-source-files.mjs";

const OUT_PATH = "docs/quality/raw/comment-overlap.json";
const OVERLAP_THRESHOLD = 0.8; // fraction of comment's meaningful words also present in the next line
const STOPWORDS = new Set(["the", "a", "an", "of", "to", "for", "in", "on", "is", "this", "and", "or", "if", "not"]);

function words(line) {
  return (line.toLowerCase().match(/[a-z][a-z0-9]{2,}/g) ?? []).filter((w) => !STOPWORDS.has(w));
}

function overlapRatio(commentWords, codeWords) {
  if (commentWords.length === 0) return 0;
  const codeSet = new Set(codeWords);
  const shared = commentWords.filter((w) => codeSet.has(w)).length;
  return shared / commentWords.length;
}

function main() {
  const findings = [];
  for (const file of listSourceFiles()) {
    const lines = readFileSync(file, "utf8").split("\n");
    for (let i = 0; i < lines.length - 1; i++) {
      const line = lines[i].trim();
      if (!line.startsWith("//") || line.startsWith("///")) continue;
      const commentText = line.replace(/^\/\/+/, "").trim();
      const nextLine = lines[i + 1];
      const cWords = words(commentText);
      const nWords = words(nextLine);
      if (cWords.length < 3) continue; // too short to judge overlap meaningfully
      const ratio = overlapRatio(cWords, nWords);
      if (ratio >= OVERLAP_THRESHOLD) {
        findings.push({ file, line: i + 1, comment: commentText, overlap: Number(ratio.toFixed(2)) });
      }
    }
  }
  mkdirSync(dirname(OUT_PATH), { recursive: true });
  writeFileSync(OUT_PATH, JSON.stringify(findings, null, 2) + "\n");
  console.log(`quality:comments — flagged ${findings.length} candidate comment(s) → ${OUT_PATH}`);
}

main();
