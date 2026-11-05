import {
  type CreatePilotJournalInput,
  journalDetailSchema,
  type PilotJournalEntry,
  type PilotJournalRun,
  pilotCycleDetailSchema,
} from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { toInputJson } from "@/common/json";
import { publish } from "@/common/sse";
import type {
  PilotJournalEntry as PilotJournalEntryModel,
  Prisma,
} from "@/generated/prisma/client";

type JournalTransaction = Pick<Prisma.TransactionClient, "pilotJournalEntry" | "pilotState">;
type CycleTransaction = Pick<Prisma.TransactionClient, "pilotState">;

export type RunsById = ReadonlyMap<string, PilotJournalRun>;

const NO_RUNS: RunsById = new Map();

export function toJournalEntry(row: PilotJournalEntryModel, runs: RunsById): PilotJournalEntry {
  const run = row.runId ? (runs.get(row.runId) ?? null) : null;
  return { ...row, detail: journalDetailSchema.parse(row.detail), run };
}

/**
 * Counts finished pilot cycles: journaled or idle, each advances board rotation. A null sleep
 * (stuck recovery) leaves no wake planned.
 */
export function recordCycle(
  tx: CycleTransaction,
  userId: string,
  cycles: number,
  sleepSeconds: number | null,
  now: Date,
) {
  const nextWakeAt = sleepSeconds === null ? null : new Date(now.getTime() + sleepSeconds * 1000);
  return tx.pilotState.upsert({
    where: { userId },
    create: { userId, lastCycleAt: now, cycleCount: cycles, nextWakeAt },
    update: { lastCycleAt: now, cycleCount: { increment: cycles }, nextWakeAt },
  });
}

/** Runs inside the caller's transaction, so cycle accounting commits with the entries. */
export async function writeJournalEntries(
  tx: JournalTransaction,
  userId: string,
  body: CreatePilotJournalInput,
  now = new Date(),
): Promise<PilotJournalEntryModel[]> {
  const rows: PilotJournalEntryModel[] = body.entries.map((entry) => ({
    id: crypto.randomUUID(),
    userId,
    runId: body.runId ?? null,
    kind: entry.kind,
    summary: entry.summary,
    detail: entry.detail ?? {},
    subjectType: entry.subjectType ?? null,
    subjectId: entry.subjectId ?? null,
    createdAt: now,
  }));
  await tx.pilotJournalEntry.createMany({
    data: rows.map((row) => ({ ...row, detail: toInputJson(row.detail) })),
  });
  const cycles = rows.filter((entry) => entry.kind === "cycle");
  const last = cycles.at(-1);
  if (last) {
    const sleepSeconds = pilotCycleDetailSchema.safeParse(last.detail).data?.sleepSeconds ?? null;
    await recordCycle(tx, userId, cycles.length, sleepSeconds, now);
  }
  return rows;
}

export function publishJournalEntries(
  userId: string,
  rows: PilotJournalEntryModel[],
  runs: RunsById = NO_RUNS,
): PilotJournalEntry[] {
  const items = rows.map((row) => toJournalEntry(row, runs));
  for (const entry of items) {
    publish(pilotChannel, { userId }, { type: "journal.appended", entry });
  }
  return items;
}
