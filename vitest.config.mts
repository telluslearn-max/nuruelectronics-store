import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Unit tests cover the pure decision math in src/lib/capital-circle/ — edge
 * gating, Kelly sizing, candidate screening, settlement payoff, calibration.
 * Those modules deliberately hold no Prisma, network, or LLM calls, so the
 * suite needs no database and no credentials.
 *
 * `server-only` is aliased to an empty module: it exists to throw when a
 * server module is pulled into a client bundle, which is exactly the check
 * that misfires under a plain Node test runner.
 *
 * `.mts` rather than `.ts` so Vite loads this as real ESM — the project's
 * package.json has no `"type": "module"`, so a `.ts` config gets loaded as
 * CommonJS and warns about its own import syntax.
 */
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  resolve: {
    alias: {
      "server-only": path.resolve(import.meta.dirname, "src/test/server-only-stub.ts"),
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
});
