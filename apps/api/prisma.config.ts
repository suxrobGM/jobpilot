import "dotenv/config";
import { defineConfig, env } from "prisma/config";

/** Prisma reads this default export itself. @knipignore */
export default defineConfig({
  schema: "./prisma/schema",
  migrations: {
    path: "./prisma/migrations",
    seed: "bun run prisma/seed/index.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
