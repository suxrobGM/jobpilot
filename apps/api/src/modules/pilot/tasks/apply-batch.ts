import { pilotInstructionsConfigSchema, type TaskPayload } from "@jobpilot/contracts/pilot";
import { conflict, HttpError } from "@/common/errors";
import type { Job, Prisma } from "@/generated/prisma/client";
import { AlreadyAppliedError, startApplying } from "@/modules/campaign/jobs/apply-guard";
import { countAppliedToday } from "../pilot.stats";

type BatchJob = TaskPayload<"job.applyBatch">["jobs"][number];

/** Bounds the in-flight count; a profile never has more than a handful of applies open. */
const MAX_IN_FLIGHT = 100;

export interface StartedBatch {
  /** The entries that moved into `applying`, which become the run's payload. */
  jobs: BatchJob[];
  started: Job[];
  /** Applied duplicates, for the caller to record as skipped once the transaction commits. */
  duplicates: AlreadyAppliedError[];
}

/**
 * Moves as many batch entries into `applying` as the budget allows, dropping any the guards refuse.
 *
 * The task list was built against a count that may be stale by now, so the cap is rechecked here
 * with in-flight applies counted: an `Application` row only lands when a result is written, so
 * counting rows alone would let a batch overshoot the daily cap by its own size.
 */
export async function startApplyBatch(
  tx: Prisma.TransactionClient,
  userId: string,
  entries: BatchJob[],
  now: Date,
): Promise<StartedBatch> {
  const state = await tx.pilotState.findUnique({
    where: { userId },
    select: { instructionsConfig: true },
  });
  const config = pilotInstructionsConfigSchema.parse(state?.instructionsConfig ?? {});
  const [appliedToday, inFlight] = await Promise.all([
    countAppliedToday(tx, userId, now),
    tx.job.count({ where: { status: "applying", campaign: { userId } }, take: MAX_IN_FLIGHT }),
  ]);
  const room = Math.min(
    config.maxConcurrentApplies - inFlight,
    config.dailyApplyCap - appliedToday - inFlight,
  );
  if (room <= 0) {
    throw conflict(
      `No apply budget: ${appliedToday} applied today and ${inFlight} in flight, against a cap of ${config.dailyApplyCap} and ${config.maxConcurrentApplies} at once.`,
    );
  }

  const batch: StartedBatch = { jobs: [], started: [], duplicates: [] };
  const refusals: string[] = [];
  for (const entry of entries) {
    if (batch.started.length === room) break;
    try {
      // Sequential on purpose: each move must see the entries already started, or two campaigns'
      // copies of one posting would both pass the in-flight duplicate check.
      batch.started.push(await startApplying(tx, userId, entry.campaignId, entry.jobKey));
      batch.jobs.push(entry);
    } catch (error) {
      if (!(error instanceof HttpError)) throw error;
      if (error instanceof AlreadyAppliedError) batch.duplicates.push(error);
      refusals.push(`${entry.campaignId}/${entry.jobKey}: ${error.message}`);
    }
  }
  if (batch.started.length === 0) {
    throw conflict(`No job in the batch could start. ${refusals.join(" ")}`);
  }
  return batch;
}
