import type { PrismaClient } from "@/generated/prisma/client";

/** One refresh's reads: every gather runs for one user at one instant. */
export interface GatherContext {
  prisma: PrismaClient;
  userId: string;
  now: Date;
}
