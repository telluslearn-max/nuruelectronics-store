/**
 * Stand-in for the `server-only` package under vitest — see vitest.config.ts.
 * The real package throws on import outside a server bundle; that guard is
 * meaningful in Next's build and meaningless in a Node test process.
 */
export {};
