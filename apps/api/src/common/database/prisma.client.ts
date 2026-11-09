import { PrismaPg } from "@prisma/adapter-pg";
import { env } from "@/env";
import { PrismaClient } from "@/generated/prisma/client";

// Explicit pool bounds + timeouts: interactive transactions (feed /result,
// email approve, etc.) hold a pooled connection for their whole duration, so an
// unbounded default pool can starve under the feed apply loop.
const adapter = new PrismaPg({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

export const db = new PrismaClient({
  adapter,
  log: env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});
