import { cron, Patterns } from "@elysiajs/cron";
import { container } from "@/common/di/container";
import { logger } from "@/common/logger";
import { ResumeStorage } from "@/common/storage/resume.storage";

const HOUR_MS = 60 * 60 * 1000;
const MB = 1024 * 1024;

// Every cached PDF re-renders from Postgres on its next download, so eviction only costs time.
const CACHE_TTL_MS = 72 * HOUR_MS;
const CACHE_MAX_BYTES = 512 * MB;

async function prunePdfCache(): Promise<void> {
  const result = await container
    .get(ResumeStorage)
    .pruneGeneratedCache({ ttlMs: CACHE_TTL_MS, maxBytes: CACHE_MAX_BYTES });
  if (result.removed > 0) {
    logger.info(
      { ...result, freedMb: Math.round((result.freedBytes / MB) * 10) / 10 },
      "Pruned generated-PDF cache",
    );
  } else {
    logger.debug(result, "Generated-PDF cache prune: nothing to remove");
  }
}

/** Daily at 03:00 server time, so the generated-PDF cache cannot fill the disk. */
export const pdfCacheJob = cron({
  name: "prune-pdf-cache",
  pattern: Patterns.everyDayAt("03:00"),
  run() {
    prunePdfCache().catch((err) => logger.error({ err }, "Generated-PDF cache prune failed"));
  },
});
