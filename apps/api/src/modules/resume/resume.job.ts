import { cron, Patterns } from "@elysiajs/cron";
import { logger } from "@/common/logger";
import { pruneGeneratedCache } from "@/common/storage";

const HOUR_MS = 60 * 60 * 1000;
const MB = 1024 * 1024;

// The generated-PDF cache (resumes-generated/) is a regenerable cache, not source
// state - every file can be re-rendered from the resume/variant JSON in Postgres.
// The daily job evicts files idle longer than the TTL, then caps the total size, so
// the cache can't fill the VPS disk. Evicted files are re-rendered on next download.
const CACHE_TTL_MS = 72 * HOUR_MS; // 3 days idle
const CACHE_MAX_BYTES = 512 * MB;

async function prunePdfCache(): Promise<void> {
  const result = await pruneGeneratedCache({ ttlMs: CACHE_TTL_MS, maxBytes: CACHE_MAX_BYTES });
  if (result.removed > 0) {
    logger.info(
      { ...result, freedMb: Math.round((result.freedBytes / MB) * 10) / 10 },
      "Pruned generated-PDF cache",
    );
  } else {
    logger.debug(result, "Generated-PDF cache prune: nothing to remove");
  }
}

/** Daily job (03:00 server time) that prunes the regenerable generated-PDF cache. */
export const resumeJob = cron({
  name: "prune-pdf-cache",
  pattern: Patterns.everyDayAt("03:00"),
  run() {
    prunePdfCache().catch((err) => logger.error({ err }, "Generated-PDF cache prune failed"));
  },
});
