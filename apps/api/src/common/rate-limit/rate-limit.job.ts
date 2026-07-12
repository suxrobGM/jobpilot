import { cron } from "@elysiajs/cron";
import { logger } from "@/common/logger";
import { sweepAllStores } from "./store";

/**
 * Buckets are otherwise only evicted when their key is hit again, so a one-shot key (a scanner's IP)
 * would sit in the table forever. Any bucket idle long enough to have fully refilled is
 * indistinguishable from a fresh one, so dropping it is free. Mirrors `resumeJob`.
 */
export const rateLimitJob = cron({
  name: "sweep-rate-limits",
  pattern: "*/5 * * * *",
  run() {
    const removed = sweepAllStores();
    if (removed > 0) {
      logger.debug({ removed }, "Swept idle rate-limit buckets");
    }
  },
});
