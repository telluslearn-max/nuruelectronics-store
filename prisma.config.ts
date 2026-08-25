import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// Next.js conventionally uses .env.local (see .env.local.example); the Prisma
// CLI runs outside Next's process and doesn't load it automatically.
config({ path: ".env.local" });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node --experimental-strip-types prisma/seed.ts",
  },
  // `migrate deploy` takes a session-level Postgres advisory lock, which a transaction-mode
  // pooler (Neon's `-pooler` endpoint, used by DATABASE_URL for app traffic) doesn't support
  // reliably — the lock can be silently handed to a different backend, surfacing as a P1002
  // lock-wait timeout even with no other migration actually running concurrently. The CLI needs
  // the direct (unpooled) connection string instead; falls back to DATABASE_URL if unset so this
  // doesn't hard-break setups that haven't added the unpooled var yet.
  datasource: {
    url: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL,
  },
});
