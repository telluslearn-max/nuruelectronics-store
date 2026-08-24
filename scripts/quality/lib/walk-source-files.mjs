/**
 * Shared file-listing helper for the quality-collector scripts. Every collector needs the same
 * "every non-test .ts/.tsx file under src/" list — factored out once here rather than each
 * script re-walking the tree its own way (would itself be exactly the Repetition red flag this
 * whole tool exists to catch elsewhere).
 */
import { readdirSync, statSync } from "node:fs";
import { join } from "node:path";

export function listSourceFiles(root = "src", acc = []) {
  for (const entry of readdirSync(root)) {
    const full = join(root, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      listSourceFiles(full, acc);
    } else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      acc.push(full.split("\\").join("/"));
    }
  }
  return acc;
}
