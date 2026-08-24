#!/usr/bin/env node
/**
 * Mechanical proxy for Ch. 16.3 ("comments belong in the code, not the commit log"): compares
 * the current commit's message length to how many comment lines it actually added. A long,
 * explanatory commit message paired with zero added comment lines is the book's own described
 * failure mode — the explanation went into the log instead of staying with the code where future
 * readers will actually see it.
 *
 * Report-only (see docs/quality/README.md): prints a warning to the CI job summary, never fails
 * the build — the threshold below is a starting guess, not a validated cutoff.
 */
import { execFileSync } from "node:child_process";

const COMMIT_MESSAGE_THRESHOLD = 400; // characters

function getLastCommitMessage() {
  return execFileSync("git", ["log", "-1", "--pretty=%B"], { encoding: "utf8" }).trim();
}

function getLastCommitAddedCommentLines() {
  const diff = execFileSync("git", ["show", "-U0", "--pretty=format:"], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  const addedLines = diff
    .split("\n")
    .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
    .map((l) => l.slice(1).trim());
  return addedLines.filter((l) => l.startsWith("//") || l.startsWith("/*") || l.startsWith("*")).length;
}

function main() {
  const message = getLastCommitMessage();
  const addedCommentLines = getLastCommitAddedCommentLines();
  if (message.length > COMMIT_MESSAGE_THRESHOLD && addedCommentLines === 0) {
    console.warn(
      `[quality:commit-comment-ratio] Commit message is ${message.length} chars but added 0 comment lines. ` +
        `Per Ch. 16.3, if this explanation matters to future readers, it belongs near the code, not only in the commit log.`,
    );
    process.exitCode = 0; // report-only — see docs/quality/README.md
    return;
  }
  console.log("[quality:commit-comment-ratio] ok");
}

main();
