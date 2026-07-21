import { cron, Patterns } from "@elysiajs/cron";
import { db } from "@/common/database";
import { logger } from "@/common/logger";
import { env } from "@/env";
import { runRetentionCleanup } from "./cleanup";

/** Daily job (03:30 server time, offset from prune-pdf-cache) that sweeps expired pilot/auth rows. */
export const cleanupJob = cron({
  name: "retention-cleanup",
  pattern: Patterns.everyDayAt("03:30"),
  run() {
    // No local DB: a dev host left running overnight would sweep every user's rows in the shared instance.
    if (env.NODE_ENV !== "production") {
      return;
    }

    runRetentionCleanup(db)
      .then((counts) => logger.info({ ...counts }, "Retention cleanup complete"))
      .catch((err) => logger.error({ err }, "Retention cleanup failed"));
  },
});
