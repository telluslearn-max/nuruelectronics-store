import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import jsdoc from "eslint-plugin-jsdoc";

// Vague-name denylist for the "Vague Name" red flag (A Philosophy of Software Design, Ch. 14.3).
// This is a deliberately noisy, recall-oriented tripwire — see docs/quality/README.md — not a
// quality-score input. A name like `data` from a destructured API response is often perfectly
// fine; the book's own vagueness test is contextual and can't be fully mechanized. `warn` only,
// and excluded from scripts/quality/quality-score.mjs on purpose.
const VAGUE_NAMES = ["data", "info", "temp", "tmp", "obj", "val", "item", "thing", "handler"];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "warn",
        ...VAGUE_NAMES.map((name) => ({
          selector: `Identifier[name="${name}"]`,
          message: `"${name}" is a vague name (Ch. 14.3) — candidate for the weekly quality sweep to judge in context, not a hard rule. Rename if a reader wouldn't know what it refers to without reading the surrounding code.`,
        })),
      ],
    },
  },
  {
    // Interface-comment presence for the library layer only (Ch. 13.1: "every method should have
    // an interface comment") — not every component, to stay practical. `warn` only: this checks
    // that *something* is there, not that it's a good comment: coverage, not quality.
    files: ["src/lib/**/*.ts"],
    ignores: ["src/lib/**/*.test.ts"],
    plugins: { jsdoc },
    rules: {
      "jsdoc/require-jsdoc": [
        "warn",
        {
          publicOnly: true,
          require: { FunctionDeclaration: true, MethodDefinition: false, ClassDeclaration: true },
        },
      ],
    },
  },
  {
    // .cjs files are intentionally CommonJS — the no-require-imports rule (aimed at app code that
    // should use ESM) doesn't apply to them.
    files: ["**/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Quality-collector scripts are plain Node scripts, not part of the app's TS project graph.
    "scripts/quality/**",
    // Bundled Claude Code skill content — third-party tooling assets, not app code this team maintains.
    ".claude/**",
  ]),
]);

export default eslintConfig;
