import { type CreatePilotJournalInput, type PilotJournalEntry } from "@jobpilot/contracts/pilot";
import { pilotChannel } from "@jobpilot/contracts/sse";
import { z } from "zod/v4";
import type {
  PilotJournalEntry as PilotJournalEntryModel,
  Prisma,
} from "@/generated/prisma/client";
import { toInputJson } from "./json";
import { publish } from "./sse";

type ActivityTransaction = Pick<Prisma.TransactionClient, "pilotJournalEntry" | "pilotState">;

/** Validates and maps a stored activity row to its wire DTO. */
export function toActivityEntry(row: PilotJournalEntryModel): PilotJournalEntry {
  return { ...row, detail: z.record(z.string(), z.json()).parse(row.detail) };
}

/** Writes activity entries with cycle accounting inside the caller's transaction. */
export async function writeActivity(
  tx: ActivityTransaction,
  userId: string,
  body: CreatePilotJournalInput,
  now = new Date(),
): Promise<PilotJournalEntryModel[]> {
  const rows: PilotJournalEntryModel[] = body.entries.map((entry) => ({
    id: crypto.randomUUID(),
    userId,
    cycleId: body.cycleId ?? null,
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
  const cycles = rows.filter((entry) => entry.kind === "cycle").length;
  if (cycles > 0) {
    await tx.pilotState.upsert({
      where: { userId },
      create: { userId, lastCycleAt: now, cycleCount: cycles },
      update: { lastCycleAt: now, cycleCount: { increment: cycles } },
    });
  }
  return rows;
}

/** Publishes committed activity rows and returns their wire DTOs. */
export function publishActivity(
  userId: string,
  rows: PilotJournalEntryModel[],
): PilotJournalEntry[] {
  const items = rows.map(toActivityEntry);
  for (const entry of items) {
    publish(pilotChannel, { userId }, { type: "journal.appended", entry });
  }
  return items;
}
