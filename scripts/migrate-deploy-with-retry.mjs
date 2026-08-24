import { spawnSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

// Vercel builds several deployments close together (a PR's own preview build and its
// merge-to-master production build routinely overlap), and every one of them runs
// `prisma migrate deploy` against the same Neon database. `migrate deploy` takes a
// Postgres advisory lock before it touches anything, and Prisma's schema engine hard-codes
// that wait at 10s (P1002) — there's no CLI flag or env var to raise it. When two builds
// race, the loser fails outright even though it had nothing to migrate.
// The lock is only ever held for the few seconds the other build's migrate step takes, so
// retrying with backoff clears it reliably — this is not a real migration failure.
const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 5000;

for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
  const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  process.stdout.write(result.stdout ?? "");
  process.stderr.write(result.stderr ?? "");

  if (result.status === 0) process.exit(0);

  const isLockTimeout = /P1002/.test(result.stdout ?? "") || /P1002/.test(result.stderr ?? "");
  if (!isLockTimeout || attempt === MAX_ATTEMPTS) process.exit(result.status ?? 1);

  const delayMs = BASE_DELAY_MS * attempt;
  console.error(
    `migrate-deploy-with-retry: hit the advisory lock (P1002), another deploy is likely mid-migration — retrying in ${delayMs / 1000}s (attempt ${attempt + 1}/${MAX_ATTEMPTS})`,
  );
  await sleep(delayMs);
}
