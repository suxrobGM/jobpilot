import path from "node:path";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import { defineConfig } from "prisma/config";

const dbPath = path.resolve(__dirname, "prisma", "dev.db");
const dbUrl = `file:${dbPath}`;

export default defineConfig({
  schema: path.join("prisma", "schema"),
  datasource: { url: dbUrl },
  migrations: {
    seed: "bun run prisma/seed/default-boards.ts",
  },
  adapter: async () => new PrismaLibSql({ url: dbUrl }),
});
