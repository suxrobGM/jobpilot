import { cron, Patterns } from "@elysiajs/cron";
import { db } from "@/common/database";
import { logger } from "@/common/logger";
import { runRetentionCleanup } from "./cleanup";

/** Daily job (03:30 server time, offset from prune-pdf-cache) that sweeps expired pilot/auth rows. */
export const cleanupJob = cron({
  name: "retention-cleanup",
  pattern: Patterns.everyDayAt("03:30"),
  run() {
    runRetentionCleanup(db)
      .then((counts) => logger.info({ ...counts }, "Retention cleanup complete"))
      .catch((err) => logger.error({ err }, "Retention cleanup failed"));
  },
});
