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
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
