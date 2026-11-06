import { cron, Patterns } from "@elysiajs/cron";
import { container } from "@/common/di/container";
import { logger } from "@/common/logger";
import { env } from "@/env";
import { PrismaClient } from "@/generated/prisma/client";
import { applyRetention } from "./retention";

/** Daily at 03:30 server time, offset from prune-pdf-cache. */
export const retentionJob = cron({
  name: "retention-cleanup",
  pattern: Patterns.everyDayAt("03:30"),
  run() {
    // No local DB: a dev host left running overnight would trim every user's rows in the shared instance.
    if (env.NODE_ENV !== "production") {
      return;
    }

    applyRetention(container.get(PrismaClient), new Date())
      .then((counts) => logger.info({ ...counts }, "Retention cleanup complete"))
      .catch((err) => logger.error({ err }, "Retention cleanup failed"));
  },
});
