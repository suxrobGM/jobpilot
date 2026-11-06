import {
  type CreatePilotJournalInput,
  journalDetailSchema,
  type PilotJournalEntry,
  type PilotJournalRun,
} from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { toInputJson } from "@/common/json";
import { publish } from "@/common/sse";
import type {
  PilotJournalEntry as PilotJournalEntryModel,
  Prisma,
} from "@/generated/prisma/client";

type JournalTransaction = Pick<Prisma.TransactionClient, "pilotJournalEntry">;

export type RunsById = ReadonlyMap<string, PilotJournalRun>;

const NO_RUNS: RunsById = new Map();

export function toJournalEntry(row: PilotJournalEntryModel, runs: RunsById): PilotJournalEntry {
  const run = row.runId ? (runs.get(row.runId) ?? null) : null;
  return { ...row, detail: journalDetailSchema.parse(row.detail), run };
}

/** Runs inside the caller's transaction. */
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
